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
const updatedTo = module.context.collection('updatedTo')

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

router.get('/:objKey/provenance', restrict(), function (req, res) {
  // Get the provenance chain of an object
  // Given an object, find all other objects connected to it via the `updatedTo` edge
  // const query = (aql` `)
  res.send([])
})
  .summary('Get the provenance chain of all other objects that have a previous version to the given object')

// GET objects
// Get all accessible objects
router.get(restrict(), function (req, res) {
  // If a user is signed in, then additionally find all objects for private workspaces they can view/edit
  // If a user is not signed in, then we just return all objects for all public workspaces
  // - Traverse over every accessible workspace
  //   - Traverse over every object in the workspace
  //   - Traverse to all other objects linked with `updatedTo`
  // Query that gets all objects (plus provenance chain) for a workspace
  const objQuery = (`
    FOR obj IN 1..1 OUTBOUND ws._id ${contains.name()}
      FOR _obj IN 0..100 INBOUND obj._id ${updatedTo.name()}
        LIMIT 100
        RETURN {_id: _obj._id, name: _obj.name, version: _obj.version || 0}
  `)
  let query
  if (req.user) {
    query = (`
      LET viewableIDs = (
        FOR perm IN ${hasPerm.name()}
          FILTER perm._from == @userID && perm.name == "canView"
          RETURN perm._to
      )
      LET editableIDs = (
        FOR perm IN ${hasPerm.name()}
          FILTER perm._from == @userID && perm.name == "canEdit"
          RETURN perm._to
      )
      FOR ws IN ${workspaces.name()}
        FILTER ws.isPublic || ws._id IN viewableIDs || ws._id IN editableIDs
        ${objQuery}
    `)
  } else {
    query = (aql`
      FOR ws IN ${workspaces.name()}
        FILTER ws.isPublic
        ${objQuery}
    `)
  }
  const results = db._query({
    query: query,
    bindVars: {
      userID: req.user._id
    }
  }).toArray()
  res.send(results)
})
  .response(joi.array(responseSchema), 'Workspace objects.')
  .summary('Get all accessible objects in the entire system.')
