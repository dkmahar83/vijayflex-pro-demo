const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../routes/auth')

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' })
  }
}

module.exports = requireAuth