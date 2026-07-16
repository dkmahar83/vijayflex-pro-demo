const express = require('express')
const router = express.Router()
const db = require('../db/database')

// GET /api/settings/:key
router.get('/:key', (req, res) => {
  db.get(`SELECT value FROM app_settings WHERE key = ?`, [req.params.key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ key: req.params.key, value: row ? row.value : null })
  })
})

// PUT /api/settings/:key   body: { value: 'true' | 'false' }
router.put('/:key', (req, res) => {
  const { value } = req.body
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' })

  const updatedAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ')

  db.run(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `, [req.params.key, String(value), updatedAt], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ key: req.params.key, value: String(value) })
  })
})

module.exports = router