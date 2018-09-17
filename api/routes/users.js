const joi = require('joi')
const httpError = require('http-errors')
const status = require('statuses')
const errors = require('@arangodb').errors
const createRouter = require('@arangodb/foxx/router')
const restrict = require('../lib/restrict')

const users = module.context.collection('users')
users.ensureIndex({
  type: 'hash',
  fields: ['email'],
  unique: true
})

const keySchema = joi.string().required().description('The key of the user')

// const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code
// const HTTP_CONFLICT = status('conflict')

// const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code
const HTTP_NOT_FOUND = status('not found')
const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code

const router = createRouter()
module.exports = router

// Schema of a user object returned by any endpoint
const returnSchema = joi.object({
  email: joi.string(),
  _id: joi.string()
})

router.tag('user')

// GET /basic/users
// Fetch a list of all users. Requires sysadmin permission
router.get(restrict('sysadmin'), function (req, res) {
  res.send(users.all())
}, 'list')
  .response([returnSchema], 'A list of users.')
  .summary('List all users.')
  .description('Retrieves a list of all orgs.')

// DELETE /basic/users/:key
// Delete a user. Requires sysadmin permission.
router.delete(':key', restrict('sysadmin'), function (req, res) {
  const key = req.pathParams.key
  try {
    users.remove(key)
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message)
    }
    throw e
  }
}, 'delete')
  .pathParam('key', keySchema)
  .response(null)
  .summary('Remove a user.')
  .description('Deletes a user from the database.')

// GET /basic/users/:key/
// Fetch the details of a single user. Requires sysadmin permission
// TODO non-sysadmins: current user must match requested user
router.get(':key', restrict('sysadmin'), function (req, res) {
  const key = req.pathParams.key
  let user
  try {
    user = users.document(key)
  } catch (e) {
    if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
      throw httpError(HTTP_NOT_FOUND, e.message)
    }
    throw e
  }
  res.send(user)
}, 'detail')
  .pathParam('key', keySchema)
  .response(returnSchema, 'The user.')
  .summary('Fetch a user.')
  .description('Retrieves a user by its key.')
