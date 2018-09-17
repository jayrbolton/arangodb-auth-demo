const {db, aql} = require('@arangodb')
const joi = require('joi')
const createRouter = require('@arangodb/foxx/router')
const restrict = require('../lib/restrict')
const checkPermission = require('../lib/check-permission')
const canViewWorkspace = require('../lib/can-view-workspace')

// Initialize a bunch of collection instances, which we will use in many places below
const workspaces = module.context.collection('workspaces')
const hasPerm = module.context.collection('hasPerm')
const contains = module.context.collection('contains')
const users = module.context.collection('users')
const objects = module.context.collection('objects')
const updatedTo = module.context.collection('updatedTo')

const router = createRouter()
module.exports = router
router.tag('workspace')

// Reused schema for workspace data in the response
const responseSchema = joi.object({
  name: joi.string(),
  _key: joi.string(),
  _id: joi.string(),
  _rev: joi.string()
})

// POST workspaces
// Create a workspace
router.post(restrict(), function (req, res) {
  const workspace = req.body
  console.log('workspace!', workspace)
  // `meta` is any extra data that we get back from the db after saving
  const meta = workspaces.save(workspace)
  Object.assign(workspace, meta)
  const perms = hasPerm.save({
    _from: req.user._id,
    _to: workspace._id,
    name: 'canEdit'
  })
  console.log('new hasPerm:', perms)
  res.status(201)
  res.send(workspace)
})
  .summary('Create a new workspace')
  .body(joi.object({
    name: joi.string().required()
  }).required(), 'The workspace data to create')
  .response(responseSchema, 'Created workspace')

// PUT workspaces/:key
// Edit a workspace
router.put('/:key', restrict(), function (req, res) {
  const key = req.pathParams.key
  const id = `${workspaces.name()}/${key}`
  if (!checkPermission(req.user, ['canEdit'], id)) {
    res.throw(403, 'Cannot edit workspace ' + id)
  }
  const saveData = req.body
  // `meta` is any extra data that we get back from the db after saving
  const ws = workspaces.update(id, saveData)
  Object.assign(ws, workspaces.document(id))
  res.status(200)
  res.send(ws)
})
  .summary('Update an existing workspace')
  .body(joi.object({
    name: joi.string(),
    isPublic: joi.boolean()
  }).required(), 'The workspace data to update')
  .response(responseSchema, 'Updated workspace')

// GET workspaces
// Fetch all accessible workspaces
router.get(function (req, res) {
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
        LIMIT 100
        SORT ws.name
        RETURN ws
    `)
  } else {
    query = (aql`
      FOR ws IN ${workspaces}
        FILTER ws.isPublic
        LIMIT 100
        SORT ws.name
        RETURN ws
    `)
  }
  const results = db._query(query).toArray()
  res.send(results)
})
  .summary('List all accessible workspaces')
  .response(
    joi.array(joi.object({
      _id: joi.string(),
      name: joi.string()
    })),
    'A list of all viewable or editable workspaces'
  )

// POST workspaces/:key/viewer
// Add a viewer to a workspace
router.post('/:key/viewer', restrict(), function (req, res) {
  const key = req.pathParams.key
  const id = `${workspaces.name()}/${key}`
  checkPermission(req.user, ['canEdit'], id)
  const ws = workspaces.document(id)
  const email = req.body
  const userID = users.firstExample({email})._id
  const perms = hasPerm.save({
    _from: userID,
    _to: ws._id,
    name: 'canView'
  })
  console.log('new hasPerm:', perms)
  res.send(ws)
})
  .body(joi.string().required(), 'The new viewer\'s email address.')
  .summary('Add a viewer to a workspace.')
  .response(responseSchema, 'Workspace data.')

// POST workspaces/:key/editor
// Add an editor to a workspace
router.post('/:key/editor', restrict(), function (req, res) {
  const key = req.pathParams.key
  const id = `${workspaces.name()}/${key}`
  checkPermission(req.user, ['canEdit'], id)
  const ws = workspaces.document(id)
  const email = req.body
  const userID = users.firstExample({email})._id
  const perms = hasPerm.save({
    _from: userID,
    _to: ws._id,
    name: 'canEdit'
  })
  console.log('new hasPerm:', perms)
  res.send(ws)
})
  .body(joi.string().required(), 'The new editor\'s email address.')
  .summary('Add an editor to a workspace.')
  .response(responseSchema, 'Workspace data.')

// POST workspaces/:key/copy
// Copy a workspace (also copies `contains` edges to all objects in the old ws)
router.post('/:key/copy', restrict(), function (req, res) {
  const key = req.pathParams.key
  const id = `${workspaces.name()}/${key}`
  const oldWs = workspaces.document(id)
  const meta = workspaces.save({
    name: oldWs.name + ' (copy)'
  })
  const newWs = workspaces.document(meta._id)
  // Insert `contains` edges from the new workspace to all the objects in the old ws
  let query = (aql`
    FOR cont IN ${contains}
      FILTER cont._from == ${oldWs._id}
      INSERT {_from: ${newWs._id}, _to: cont._to} INTO ${contains}
  `)
  db._query(query)
  // Insert a `canEdit` edge between the user and the new workspace
  const edge = hasPerm.save({
    _from: req.user._id,
    _to: newWs._id,
    name: 'canEdit'
  })
  console.log('new hasPerm:', edge)
  res.send(newWs)
})
  .summary('Copy a workspace.')
  .description('Creates a new, private workspace with the same name as the old one. It also copies references to all the objects in the old workspace. It does not copy any editor or viewer permissions to the new workspace.')
  .response(responseSchema, 'Copied workspace data.')

// GET workspaces/:key/objects
// Get all objects within a specific workspace
router.get('/:key/objects', function (req, res) {
  const key = req.pathParams.key
  const ws = workspaces.document(key)
  if (!canViewWorkspace(req.user, ws)) {
    res.throw(403, 'Cannot view workspace ' + key)
  }
  // Get all the objects for the workspace
  const query = (aql`
    FOR obj IN 1..1 OUTBOUND ${ws._id} ${contains}
      RETURN {_id: obj._id, name: obj.name, version: obj.version || 0}
  `)
  const results = db._query(query).toArray()
  res.send(results)
})
  .response(joi.array(joi.object({_id: joi.string(), name: joi.string()})), 'Name and ID of objects.')
  .summary('Get all objects within a single workspace.')

// POST workspace/:wsKey/objects
// Create a new object within a workspace
router.post('/:wsKey/objects', restrict(), function (req, res) {
  const wsID = `${workspaces.name()}/${req.pathParams.wsKey}`
  if (!checkPermission(req.user, ['canEdit'], wsID)) {
    res.throw(403, 'Cannot edit workspace ' + req.pathParams.wsKey)
  }
  const object = req.body
  object.version = 0
  // `meta` is any extra data that we get back from the db after saving
  const meta = objects.save(object)
  Object.assign(object, meta)
  // Add a `contains` edge from the workspace to the object
  const edge = contains.save({
    _from: wsID,
    _to: object._id
  })
  console.log('contains edge:', edge)
  res.status(201)
  res.send(object)
})
  .body(joi.object({name: joi.string().required()}).required(), 'The object to create with a workspace ID')
  .response(201, responseSchema, 'The created object.')
  .summary('Create a new object')

// PUT workspaces/:wsKey/objects/:objKey
// Edit an object, which creates a new copy with a new version
router.put('/:wsKey/objects/:objKey', restrict(), function (req, res) {
  const wsID = `${workspaces.name()}/${req.pathParams.wsKey}`
  // User must be able to edit the associated workspace
  if (!checkPermission(req.user, ['canEdit'], wsID)) {
    res.throw(403, 'Cannot edit workspace ' + req.body.workspaceID)
  }
  const objID = `${objects.name()}/${req.pathParams.objKey}`
  // The object must have a `contains` edge with the workspace
  const containsEdge = contains.firstExample({_from: wsID, _to: objID})
  if (!containsEdge) {
    res.throw(400, `Workspace ${wsID} does not contain object ${objID}`)
  }
  const oldObj = objects.document(objID)
  const newObj = {
    name: req.body.name,
    version: oldObj.version + 1
  }
  const newMeta = objects.save(newObj)
  Object.assign(newObj, newMeta)
  // Create a new object with new `contains` edges to the same workspace
  contains.save({_from: wsID, _to: newObj._id})
  // Create an `updatedTo` edge between the old object and the new object
  updatedTo.save({_from: objID, _to: newObj._id})
  res.send(newObj)
})
  .body(joi.object({name: joi.string().required()}).required(), 'The object to update')
  .response(responseSchema, 'The updated object')
  .summary('Edit an object (creating a new copy).')
  .description('Must have edit permissions on the workspace for the object.')
