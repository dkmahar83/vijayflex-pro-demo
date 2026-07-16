const express = require('express')
const router = express.Router()
const db = require('../db/database')
const requireAuth = require('../middleware/auth')

// GET /api/upi-qr-history
router.get('/', requireAuth, (req, res) => {
  db.all(`SELECT * FROM upi_qr_history ORDER BY created_at DESC LIMIT 200`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

// POST /api/upi-qr-history
router.post('/', requireAuth, (req, res) => {
  const { upi_account, upi_id, payee_name, amount, remarks } = req.body
  if (!upi_account || !upi_id || !amount) {
    return res.status(400).json({ error: 'upi_account, upi_id aur amount required hain.' })
  }
  db.run(
    `INSERT INTO upi_qr_history (upi_account, upi_id, payee_name, amount, remarks, paid)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [upi_account, upi_id, payee_name || '', amount, remarks || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get(`SELECT * FROM upi_qr_history WHERE id = ?`, [this.lastID], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message })
        res.json(row)
      })
    }
  )
})

// PUT /api/upi-qr-history/:id/toggle-paid
router.put('/:id/toggle-paid', requireAuth, (req, res) => {
  db.get(`SELECT paid FROM upi_qr_history WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'Entry nahi mili.' })
    const newPaid = row.paid ? 0 : 1
    db.run(`UPDATE upi_qr_history SET paid = ? WHERE id = ?`, [newPaid, req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message })
      res.json({ id: Number(req.params.id), paid: !!newPaid })
    })
  })
})

// DELETE /api/upi-qr-history/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.run(`DELETE FROM upi_qr_history WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

// DELETE /api/upi-qr-history (clear all)
router.delete('/', requireAuth, (req, res) => {
  db.run(`DELETE FROM upi_qr_history`, [], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

module.exports = router