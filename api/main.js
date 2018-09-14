const sessionsMiddleware = require('@arangodb/foxx/sessions')

const sessions = sessionsMiddleware({
  storage: module.context.collection('sessions'),
  transport: ['header', 'cookie']
})

module.context.use(sessions)

// For all requests, initialize the data for the current user, if present
const users = module.context.collection('users')
module.context.use(function (req, res, next) {
  /* TODO try this:
  if (req.user) {
    next()
  } else if (req.session.uid) {
    const currentUser = users.document(req.session.uid)
    if (currentUser) {
      req.user = currentUser
    } else {
      req.session.uid = null
      req.sessionStorage.save()
    }
  }
  */
  try {
    req.user = users.document(req.session.uid)
  } catch (e) {
    req.session.uid = null
    req.sessionStorage.save()
  }
  next()
})

module.context.use('/users', require('./routes/users'), 'users')
module.context.use('/auth', require('./routes/auth'), 'auth')
module.context.use('/workspaces', require('./routes/workspaces'), 'workspaces')
module.context.use('/objects', require('./routes/objects'), 'objects')

// module.context.use('/groups', require('./routes/groups'), 'groups')

// Serve the Swagger API docs under /_db/_system/basic/docs
module.context.use('/docs', module.context.createDocumentationRouter(), 'docs')
