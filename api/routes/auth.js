const joi = require('joi')
const createRouter = require('@arangodb/foxx/router')
const auth = require('../lib/auth')
const status = require('statuses')
const httpError = require('http-errors')
const errors = require('@arangodb').errors

const users = module.context.collection('users')

const HTTP_CONFLICT = status('conflict')
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code

const router = createRouter()
router.tag('auth')
module.exports = router

// POST /basic/auth/login
// Sign in a user
router.post('/login', function (req, res) {
  const email = req.body.email
  const user = users.firstExample({email})
  if (!user) {
    res.throw('unauthorized')
  }
  const valid = auth.verify(user.authData, req.body.password)
  if (!valid) {
    res.throw('unauthorized')
  }
  req.session.uid = user._key
  req.sessionStorage.save(req.session)
  res.send({success: true})
})
  .body(joi.object({
    email: joi.string().required(),
    password: joi.string().required()
  }).required(), 'Credentials')
  .summary('Signs in a registered user.')

// POST /basic/auth/logout
// Sign out the current user, if present
router.post('/logout', function (req, res) {
  if (req.session.uid) {
    req.session.uid = null
    req.sessionStorage.save(req.session)
  }
  res.send({success: true})
})
  .summary('Signs out the current user.')

// POST /basic/auth/signup
// Register a new user
router.post('/signup', function (req, res) {
  const user = {
    email: req.body.email,
    perms: [],
    authData: auth.create(req.body.password)
  }
  let meta
  try {
    meta = users.save(user)
  } catch (e) {
    // Catch a duplicate email registration
    if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
      throw httpError(HTTP_CONFLICT, e.message)
    }
    throw e
  }
  Object.assign(user, meta)
  req.session.uid = user._key
  req.sessionStorage.save(req.session)
  res.send({success: true})
})
  .body(joi.object({
    email: joi.string().required(),
    password: joi.string().required()
  }).required(), 'User data to register.')
  .summary('Creates a new user and logs them in.')

// GET /basic/auth/whoami
// Fetch the currently active user's email, if present
router.get('/whoami', function (req, res) {
  let user
  try {
    user = users.document(req.session.uid)
  } catch (e) {
    return res.send({email: null})
  }
  res.send({email: user.email})
})
  .summary('Returns the currently active user email.')
