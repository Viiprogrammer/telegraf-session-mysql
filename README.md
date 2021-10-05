[![Build Status](https://travis-ci.org/hnaderi/telegraf-session-mysql.svg?branch=master)](https://travis-ci.org/hnaderi/telegraf-session-mysql)
[![NPM Version](https://img.shields.io/npm/v/telegraf-session-mysql.svg?style=flat-square)](https://www.npmjs.com/package/telegraf-session-mysql)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

# MySQL session middleware for Telegraf

MySQL powered session middleware for [Telegraf](https://github.com/telegraf/telegraf). forked from Redis session project for telegraf.
Saves session both on mysql and in memory and use memory where possible.

## Installation

```js
$ npm install telegraf-session-mysql
```
## Setup

Module can auto create table in database, but if you want to create manually, use this request

```SQL
CREATE TABLE `sessions` (
  `id` varchar(100) NOT NULL,
  `session` longtext NOT NULL,
  PRIMARY KEY (`id`))
```

## Example

```js
const Telegraf = require('telegraf')
const MySQLSession = require('telegraf-session-mysql')

const telegraf = new Telegraf(process.env.BOT_TOKEN)

const session = new MySQLSession({
  host: 'localhost',
  user: 'user',
  password: 'pass',
  database: 'telegraf_sessions'
})

telegraf.use(session.middleware())

telegraf.on('text', (ctx) => {
  ctx.session.counter = ctx.session.counter || 0
  ctx.session.counter++
  console.log('Session', ctx.session)
})

telegraf.startPolling()
```

When you have stored the session key beforehand, you can access a
session without having access to a context object. This is useful when
you perform OAUTH or something similar, when a REDIRECT_URI is called
on your bot server.

```js
const mysqlSession = new MySQLSession(...)

// Retrieve session state by session key
getSession (userID, chatID)
  .then((session) => {
    console.log('Session state', session)
  })

// Save session state
mysqlSession.saveSession(userID, chatID, session)
```

If you want get session without `userID` or `chatID` (`userProperty` or `chatProperty` enabled), you must pass `0` (zero) into field

For example:

```js
const mysqlSession = new MySQLSession(...)

// Retrieve session state by session key
getSession (userID, 0)
  .then((session) => {
    console.log('Session state', session)
  })

// Save session state
mysqlSession.saveSession(userID, 0,  session)
```

## API

### Database options 

* `host`:  hostname of mysql server
* `user`: username
* `password`: user password
* `database`:  Database name

### Options

* `property`: context property name (default: `session`)
* `userProperty`: context property name for user session (default: not used)
* `chatProperty`: context property name for chat session (default: not used)
* `table`: name of database table (default: `session`)
* `lifetime`: Sessions life time (default: `300` seconds)
* `interval`: Garbage collector call interval (deleting sessions with expired lifetime, default: `300000` ms)
* `getSessionKey`: session key function `(ctx) => any`
  
Default implementation of `getSessionKey`:

```js
function getSessionKey(ctx) {
  if (ctx.updateType === 'callback_query') {
    ctx = ctx.update.callback_query.message
  }
  if (!ctx.from || !ctx.chat) {
    return
  }

  return [ctx.from.id, ctx.chat.id]
}
```

Useing userProperty/chatProperty:

```js

const mysqlSession = new MySQLSession(..., {
  chatProperty: 'chatSession',
  userProperty: 'userSession'
})

telegraf.on('text', (ctx) => {
  ctx.chatSession = {foo: 'bar'}; //Session data stored for chat (not related to user)
  ctx.userSession = {foo: 'bar'}; //Session data stored for user (not related to chat)
  ctx.session = {foo: 'bar'}; //Default session for chat & user
})
```

### Destroying a session

To destroy a session simply set it to `null`.

```js
telegraf.on('text', (ctx) => {
  ctx.session = null
})
```

To destroy sessions data and close databse connection, use `destroy` method.

```js
const mysqlSession = new MySQLSession();
...
mysqlSession.destroy();
```
