const {db, aql} = require('@arangodb')
const joi = require('joi')
// const httpError = require('http-errors')
// const status = require('statuses')
// const errors = require('@arangodb').errors
const createRouter = require('@arangodb/foxx/router')
const restrict = require('../lib/restrict')

// const objects = module.context.collection('objects')
const contains = module.context.collection('contains')
const workspaces = module.context.collection('workspaces')
const hasPerm = module.context.collection('hasPerm')

// const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code
// const HTTP_CONFLICT = status('conflict')
// const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code
// const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code
// const HTTP_NOT_FOUND = status('not found')

const router = createRouter()
module.exports = router
router.tag('object')

const responseSchema = joi.object({
  name: joi.string(),
  _id: joi.string(),
  _key: joi.string(),
  _rev: joi.string()
})

// GET objects
// Get all accessible objects
router.get(restrict(), function (req, res) {
  // If a user is signed in, then additionally find all objects for private workspaces they can view/edit
  // If a user is not signed in, then we just return all objects for all public workspaces
  const u = req.user
  let query
  if (req.user) {
    query = (aql`
      LET viewableIDs = (
        FOR perm IN ${hasPerm}
          FILTER perm._from == ${u._id} && perm.name == "canView"
          RETURN perm._to
      )
      LET editableIDs = (
        FOR perm IN ${hasPerm}
          FILTER perm._from == ${u._id} && perm.name == "canEdit"
          RETURN perm._to
      )
      FOR ws IN ${workspaces}
        FILTER ws.isPublic || ws._id IN viewableIDs || ws._id IN editableIDs
        FOR obj IN 1..1 OUTBOUND ws._id ${contains}
          LIMIT 100
          RETURN {_id: obj._id, name: obj.name, version: obj.version || 0}
    `)
  } else {
    query = (aql`
      FOR ws IN ${workspaces}
        FILTER ws.isPublic
        FOR obj IN 1..1 OUTBOUND ws._id ${contains}
          LIMIT 100
          RETURN {_id: obj._id, name: obj.name, version: obj.version || 0}
    `)
  }
  const results = db._query(query).toArray()
  res.send(results)
})
  .response(joi.array(responseSchema), 'Workspace objects.')
  .summary('Get all accessible objects in the entire system.')
