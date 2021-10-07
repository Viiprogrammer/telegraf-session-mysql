const Telegraf = require('telegraf')
const MySQLSession = require('../lib/session')

const telegraf = new Telegraf(process.env.BOT_TOKEN)

const session = new MySQLSession({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'telegraf_sessions'
})
telegraf.use(session.middleware());

(async() => {
  await session.connect()

  telegraf.on('text', (ctx, next) => {
    ctx.session.counter = ctx.session.counter || 0
    ctx.session.counter++
    return next()
  })

  telegraf.hears('/stats', (ctx) => {
    return ctx.reply(`${ctx.session.counter} messages from ${ctx.from.username}`)
  })

  telegraf.startPolling(30)
})()
