const Telegraf = require('telegraf')
const should = require('should')
const MySQLSession = require('../lib/session')
const options = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'telegraf_sessions'
}

describe('Telegraf Session', function () {
  it('should retrieve and save session', function (done) {
    const mySQLSession = new MySQLSession(options)
    const key = 'session.key'
    mySQLSession.getSession(key)
      .then((session) => {
        should.exist(session)
        session.foo = 42
        return mySQLSession.saveSession(key, session)
      })
      .then(() => {
        return mySQLSession.getSession(key)
      })
      .then((session) => {
        should.exist(session)
        session.should.be.deepEqual({ foo: 42 })
      })
      .then(done)
  })

  it('should be defined', function (done) {
    const app = new Telegraf()
    const session = new MySQLSession(options)
    app.on('text',
      session.middleware(),
      (ctx) => {
        should.exist(ctx.session)
        ctx.session.foo = 42
        done()
      })
    app.handleUpdate({message: {chat: {id: 1}, from: {id: 1}, text: 'hey'}})
  })

  it('should handle existing session', function (done) {
    const app = new Telegraf()
    const session = new MySQLSession(options)
    app.on('text',
      session.middleware(),
      (ctx) => {
        should.exist(ctx.session)
        ctx.session.should.have.property('foo')
        ctx.session.foo.should.be.equal(42)
        done()
      })
    app.handleUpdate({message: {chat: {id: 1}, from: {id: 1}, text: 'hey'}})
  })

  it('should handle not existing session', function (done) {
    const app = new Telegraf()
    const session = new MySQLSession(options)
    app.on('text',
      session.middleware(),
      (ctx) => {
        should.exist(ctx.session)
        ctx.session.should.not.have.property('foo')
        done()
      })
    app.handleUpdate({message: {chat: {id: 1}, from: {id: 999}, text: 'hey'}})
  })

  it('should handle session reset', function (done) {
    const app = new Telegraf()
    const session = new MySQLSession(options)
    app.on('text',
      session.middleware(),
      (ctx) => {
        ctx.session = null
        should.exist(ctx.session)
        ctx.session.should.not.have.property('foo')
        done()
      })
    app.handleUpdate({message: {chat: {id: 1}, from: {id: 1}, text: 'hey'}})
  })
})
