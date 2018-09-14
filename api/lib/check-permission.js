const {db, aql} = require('@arangodb')
const hasPerm = module.context.collection('hasPerm')
const memberOf = module.context.collection('memberOf')

module.exports = checkPermission

/**
 * Check whether the user has permissions.
 * - Check if the user itself has the general permission based on name (user.perms)
 * - Check if the user is a member of a group that has general permissions based on name
 *   (group.perms)
 * - Check if the user has a `hasPerm` edge between itself and the given objectID with the
 *   permission name
 * - Check if the user is in any group that has a `hasPerm` edge between the user and the given
 *   object
 *
 * Params:
 *   user - (required) user document object
 *   name - (required) permission name
 *   objectID - (optional) id of object for checking permission edges
 */
function checkPermission (user, names, objectID) {
  if (!user) {
    return false
  }
  if (!names || !names.length) {
    // If no permission name is passed, then we are just checking that a user is present
    return true
  }
  // Check if the user has any general permissions matching the name (user.perms)
  if (user.perms.includes(names)) {
    return true
  }
  // Check if the user is a member of any groups with the general permission (group.perms)
  const groupHasPermAql = (aql`
    FOR group IN 1..100 OUTBOUND ${user._id} ${memberOf}
    FILTER ${names} IN group.perms
    LIMIT 1
    RETURN true
  `)
  const groupHasPerm = Boolean(db._query(groupHasPermAql).next())
  if (groupHasPerm) {
    return true
  }
  // If neither the user nor any groups have general permission, then we must have a permission
  // edge to the object ID. If no object ID is provided, then there are no permissions
  if (!objectID) {
    return false
  }
  // Check if there is a permission-granting edge between the user and the given object
  let query = (aql`
    FOR perm IN ${hasPerm}
      FILTER perm.name IN ${names}
      FILTER perm._from == ${user._id} && perm._to == ${objectID}
      LIMIT 1
      RETURN true
  `)
  const hasPermEdge = Boolean(db._query(query).next())
  if (hasPermEdge) {
    return true
  }
  // Finally, check if there is a permission edge between any user groups and the given object
  const groupHasPermEdgeAql = (aql`
    LET groupIds = (
      FOR group in 1..100 OUTBOUND ${user._id} ${memberOf}
      RETURN group._id
    )
    FOR perm IN ${hasPerm}
      FILTER perm.name IN ${names}
        && perm._from IN groupIds
        && perm._to == ${objectID}
      LIMIT 1
      RETURN true
  `)
  return Boolean(db._query(groupHasPermEdgeAql).next())
}
