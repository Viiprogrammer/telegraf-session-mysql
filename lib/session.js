const mysql = require('mysql2/promise')
const debug = require('debug')('telegraf:session-redis')

class MySQLSession {
  constructor (connection, options = {}) {
    this.connection = connection

    this.options = Object.assign({
      property: 'session',
      userProperty: '',
      chatProperty: '',
      table: 'sessions',
      interval: 300000,
      lifetime: 300,
      getSessionKey: (ctx) => {
        if (ctx.updateType === 'callback_query') {
          ctx = ctx.update.callback_query.message
        }
        if (!ctx.from || !ctx.chat) {
          return
        }
        return [ctx.from.id, ctx.chat.id]
      }
    }, options)

    this.sessions = {}
    this.sessionsDts = {}

    this.interval = setInterval(() => {
      const currentTime = Math.floor(new Date() / 1000)

      Object.keys(this.sessionsDts).forEach((key) => {
        if (currentTime - this.sessionsDts[key] >= this.options.lifetime) {
          delete this.sessions[key]
          delete this.sessionsDts[key]
        }
      })
    }, this.options.interval)
  }

  async connect () {
    this.client = mysql.createPool(this.connection)

    return this.client.execute(
      `CREATE TABLE IF NOT EXISTS ${this.options.table}
      (
        user_id BIGINT(20) NOT NULL,
        chat_id BIGINT(20) NOT NULL,
        session LONGTEXT NOT NULL,
        UNIQUE KEY user_id (user_id, chat_id)
      )
      engine=innodb
      DEFAULT charset=utf8;`
    )
      .catch((err) => {
        throw new Error(`Can't create table for sessions ${err}`)
      })
  }

  async getSession (userID, chatID) {
    const key = userID + ':' + chatID

    if (!this.sessions[key]) {
      try {
        const [rows] = await this.client.query(`
        SELECT session
        FROM ${this.options.table}
        WHERE user_id = ?
        AND chat_id = ?`, [userID, chatID])

        if (rows && rows.length) {
          try {
            this.sessions[key] = JSON.parse(rows[0].session)
          } catch (err) {
            console.error("Can't parse session state", err)
            this.sessions[key] = {}
          }
        } else {
          this.sessions[key] = {}
        }
      } catch (err) {
        console.error("Can't get user session:", err)
        this.sessions[key] = {}
      }

      this.sessionsDts[key] = Math.floor(new Date() / 1000)
    }
    debug('session state', key, this.sessions[key])
    return this.sessions[key]
  }

  async saveSession (userID, chatID, session) {
    debug('save session', userID + ':' + chatID, session)
    if (!session || Object.keys(session).length === 0) {
      try {
        await this.client.query(`
          DELETE FROM ${this.options.table}
          WHERE  user_id = ?
          AND chat_id = ?
        `, [userID, chatID])
      } catch (err) {
        console.error("Can't delete (save) user session:", err)
        return false
      }
    }

    try {
      const sessionString = JSON.stringify(session)
      return await this.client.query(`
        INSERT INTO ${this.options.table} (user_id, chat_id, session) value (?, ?, ?) ON DUPLICATE KEY UPDATE session = ?
    `, [userID, chatID, sessionString, sessionString])
    } catch (err) {
      console.error("Can't save user session:", err)
      return false
    }
  }

  destroy () {
    this.client.end()
    this.client = null

    delete this.options
    this.options = null

    clearInterval(this.interval)
    this.interval = null

    delete this.sessions
    this.sessions = null

    delete this.sessionsDts
    this.sessionsDts = null

    debug('destroy sessions')
  }

  middleware () {
    return async (ctx, next) => {
      const [userID, chatID] = this.options.getSessionKey(ctx)

      if (!userID || !chatID) {
        return next()
      }

      let session = null
      if (this.options.property) {
        session = await this.getSession(userID, chatID)

        Object.defineProperty(ctx, this.options.property, {
          get: function () {
            return session
          },
          set: function (newValue) {
            session = Object.assign({}, newValue)
          }
        })
      }

      let userSession = null

      if (this.options.userProperty) {
        userSession = await this.getSession(userID, 0)

        Object.defineProperty(ctx, this.options.userProperty, {
          get: function () {
            return userSession
          },
          set: function (newValue) {
            userSession = Object.assign({}, newValue)
          }
        })
      }

      let chatSession = null

      if (this.options.chatProperty) {
        chatSession = await this.getSession(0, chatID)

        Object.defineProperty(ctx, this.options.chatProperty, {
          get: function () {
            return chatSession
          },
          set: function (newValue) {
            chatSession = Object.assign({}, newValue)
          }
        })
      }

      debug(`session snapshot for Chat: ${chatID || 'None'} User: ${userID || 'None'}`, session)
      return next().then(async() => {
        if (session) {
          await this.saveSession(userID, chatID, session)
        }
        if (userSession) {
          await this.saveSession(userID, 0, userSession)
        }
        if (chatSession) {
          await this.saveSession(0, chatID, chatSession)
        }
      })
    }
  }
}

module.exports = MySQLSession
