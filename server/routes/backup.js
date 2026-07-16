// server/routes/backup.js
const express  = require('express')
const router   = express.Router()
const fs       = require('fs')
const path     = require('path')
const { runBackup, getBackupList, BACKUP_DIR } = require('../backup')

// GET /api/backup/list
router.get('/list', (req, res) => {
  const backups = getBackupList()
  res.json({ backups, count: backups.length })
})

// POST /api/backup/run
router.post('/run', (req, res) => {
  try {
    runBackup()
    const backups = getBackupList()
    res.json({ success: true, message: 'Backup complete!', latest: backups[0] || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/backup/download/:filename
router.get('/download/:filename', (req, res) => {
  const { filename } = req.params
  if (!filename.startsWith('VijayFlexPro-Backup-') || !filename.endsWith('.db')) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  const filePath = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup file nahi mila' })
  }
  res.download(filePath, filename)
})

module.exports = router