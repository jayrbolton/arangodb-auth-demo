const checkPermission = require('./check-permission')

module.exports = canViewWorkspace

function canViewWorkspace (user, workspace) {
  if (workspace.isPublic) {
    return true
  }
  return checkPermission(user, ['canView', 'canEdit'], workspace._id)
}
