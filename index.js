'use strict'

console.log()
console.log()
console.log('--- PROCESS INITIALIZED ---')
console.log('Time:', Date.now())

global.__base = __dirname + '/'
console.log("__base:", __base)

const express = require('express'),
  ejs = require('ejs'),
  app = express(),
  bodyParser = require('body-parser'),
  mongoose = require('mongoose'),
  moment = require('moment'),
  compression = require('compression'),
  http = require('http'),
  https = require('https'),
  spdy = require('spdy'),
  port = 80,

  logsRouter = require('./routers/logs'),
  memberRouter = require('./routers/member'),
  hackathonRouter = require('./routers/hackathon'),

  config = require('./config.json')

function getTimeFormatted() {
  return moment().format('MMMM Do YYYY, h:mm:ss a') + ' (' + Date.now() + ')'
}

console.log('Constants made at:', getTimeFormatted())

mongoose.connect('mongodb://127.0.0.1/test', (err) => {
  console.log('Database live on port', port, 'at', getTimeFormatted())
})

app.set('view engine', 'ejs')
app.set('views', __dirname + '/views')
app.set('env', 'development')
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('static'))
app.use(compression())
app.use(logRequests)
app.use(logErrors)
app.use(clientErrorHandler)



// letsencrypt-express
var LEX = require('letsencrypt-express')

var DOMAIN = config['domain']
console.log("DOMAIN:", DOMAIN)
var EMAIL = config['email']
console.log("EMAIL:", EMAIL)

var lex = LEX.create({
  configDir: require('os').homedir() + '/letsencrypt/etc'
, approveRegistration: function (hostname, approve) { // leave `null` to disable automatic registration
    if (hostname === DOMAIN) { // Or check a database or list of allowed domains
      approve(null, {
        domains: [DOMAIN]
      , email: EMAIL
      , agreeTos: true
      })
    }
  }
})

// use routers
app.use('/logs', logsRouter)
app.use('/member', memberRouter)
app.use('/hackathon', hackathonRouter)


// '/' router
app.get('/about', function (req, res) {
  res.render('pages/about')
})

app.get('/photos', function (req, res) {
  res.render('pages/photos')
})

app.get('/', function (req, res) {
  res.render('pages/index')
})

app.get('*', function (req, res, next) {
  res.status(404)
  res.errCode = 404
  next('URL ' + req.originalUrl + ' Not Found')
})


// functions
function logRequests(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  console.log()
  console.log('--- NEW REQUEST ---')
  console.log('Time:', moment().format('MMMM Do YYYY, h:mm:ss a'), '(' + Date.now() + ')')
  console.log('IP: ', ip)
  console.log('Request:', req.originalUrl)
  next()
}

app.use(errorHandler)

function logErrors(err, req, res, next) {
  console.error(err.stack)
  next(err)
}

function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    res.status(500).render('pages/error', { statusCode: 500, error: 'Something failed!' })
  } else {
    next(err)
  }
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }
  res.status(res.errCode || err.status || 500)
  res.render('pages/error', { statusCode: res.errCode || err.status || 500, error: err })
}

// create server
if (config['httpsCapable']==="true") {

  http.createServer(LEX.createAcmeResponder(lex, function redirectHttps(req, res) {
      res.setHeader('Location', 'https://' + req.headers.host + req.url);
      res.statusCode = 302; // use 307 if you want to redirect requests with POST, DELETE or PUT action.
      res.end('<!-- Hello Developer Person! Please use HTTPS instead -->');
    })).listen(80);

    spdy.createServer(lex.httpsOptions, LEX.createAcmeResponder(lex, app)).listen(443);
} else {
  lex.onRequest = app

  lex.listen([80], [443, 5001], function () {
    const protocol = ('requestCert' in this) ? 'https': 'http'
    console.log("Listening at " + protocol + '://' + config['domain'] + ':' + this.address().port)
  })
}
