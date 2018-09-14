const checkPermission = require('./check-permission')

module.exports = restrict

function restrict (permName) {
  return function (req, res, next) {
    if (!req.user) {
      res.throw(403, 'Please log in first')
    }
    if (!checkPermission(req.user, permName)) {
      res.throw(403, 'Not authorized')
    }
    next()
  }
}
