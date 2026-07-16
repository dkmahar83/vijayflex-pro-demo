const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const rateLimit = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 galat/sahi attempts per IP per window
  message: { error: 'Bahut zyada login attempts. 15 minute baad try karo.' },
  standardHeaders: true,
  legacyHeaders: false
})

// Single user credentials — change PASSWORD to whatever you want
const USERS = [
  {
    id: 1,
    username: 'flexshop',
    passwordHash: '$2b$10$GqZeCJBXUAWj9z1CRBLgLeLNN7NCTlxrSSosrlzpG2JhNpL3l3AnW',
    name: 'FlexShop Manager'
  }
]

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET .env mein set nahi hai — server start nahi hoga bina iske.')
  console.error('   .env mein add karo: JWT_SECRET=<koi bhi lambi random string>')
  process.exit(1)
}
const JWT_EXPIRES = '7d' // token valid for 7 days

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  const user = USERS.find(u => u.username === username.toLowerCase())

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  const isValid = bcrypt.compareSync(password, user.passwordHash)

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name },
    message: 'Login successful'
  })
})

// POST /api/auth/verify
router.post('/verify', (req, res) => {
  const { token } = req.body
  if (!token) return res.status(401).json({ valid: false })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    res.json({ valid: true, user: decoded })
  } catch {
    res.status(401).json({ valid: false })
  }
})

module.exports = router
module.exports.JWT_SECRET = JWT_SECRET