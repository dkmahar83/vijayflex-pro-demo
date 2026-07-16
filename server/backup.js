// server/backup.js
// VijayFlex Pro — Automatic Daily Backup System
// Poora SQLite database copy karta hai — orders, payments, customers, sab kuch

const fs   = require('fs')
const path = require('path')
const cron = require('node-cron')  // ← tera existing DB module (DB_PATH yahan se lega)

// ─── Paths ────────────────────────────────────────────────────────────────────
// DB_PATH tera existing db module export karta hai — agar nahi karta to niche hardcode karo:
// const DB_PATH = path.join(__dirname, 'db', 'flexshop.db')
const DB_PATH   = path.join(__dirname, 'db', 'flexshop.db')
const BACKUP_DIR = path.join(__dirname, 'backups')

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    console.log('[Backup] backups/ folder banaya gaya')
  }
}

// YYYY-MM-DD format (IST)
function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

// Human-readable datetime (IST)
function nowStr() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

// ─── Core Backup ──────────────────────────────────────────────────────────────
function runBackup() {
  ensureBackupDir()

  const dateStr    = todayStr()
  const filename   = `VijayFlexPro-Backup-${dateStr}.db`
  const backupPath = path.join(BACKUP_DIR, filename)
  const logPath    = path.join(BACKUP_DIR, 'backup_log.txt')

  try {
    if (!fs.existsSync(DB_PATH)) {
      console.error('[Backup] ❌ Database file nahi mili:', DB_PATH)
      return
    }

    fs.copyFileSync(DB_PATH, backupPath)

    const sizeMB = (fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)
    console.log(`[Backup] ✅ ${nowStr()} — Backup complete! (${sizeMB} MB)`)
    console.log(`[Backup] 📁 ${filename}`)

    fs.appendFileSync(logPath, `${nowStr()} | ${filename} | ${sizeMB} MB | SUCCESS\n`)

    cleanOldBackups(30)

  } catch (err) {
    console.error('[Backup] ❌ Failed:', err.message)
    fs.appendFileSync(logPath, `${nowStr()} | FAILED | ${err.message}\n`)
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
function cleanOldBackups(days) {
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    let deleted  = 0

    fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('VijayFlexPro-Backup-') && f.endsWith('.db'))
      .forEach(f => {
        const fp = path.join(BACKUP_DIR, f)
        if (fs.statSync(fp).mtimeMs < cutoff) {
          fs.unlinkSync(fp)
          deleted++
        }
      })

    if (deleted > 0)
      console.log(`[Backup] 🗑️  ${deleted} purana/purane backup delete hue (>${days} din)`)
  } catch (err) {
    console.error('[Backup] Cleanup error:', err.message)
  }
}

// ─── List Backups (API ke liye) ───────────────────────────────────────────────
function getBackupList() {
  ensureBackupDir()
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('VijayFlexPro-Backup-') && f.endsWith('.db'))
      .map(f => {
        const fp   = path.join(BACKUP_DIR, f)
        const stat = fs.statSync(fp)
        return {
          filename   : f,
          size_mb    : (stat.size / 1024 / 1024).toFixed(2),
          created_at : stat.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          date       : f.replace('VijayFlexPro-Backup-', '').replace('.db', '')
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))  // newest first
  } catch {
    return []
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
function startBackupScheduler() {
  ensureBackupDir()
  console.log('[Backup] ⏰ Scheduler start — har raat 11:00 PM IST pe backup hoga')

  // Har raat 11 PM IST
  cron.schedule('0 23 * * *', () => {
    console.log('[Backup] ⏰ 11:00 PM — Auto backup shuru...')
    runBackup()
  }, { timezone: 'Asia/Kolkata' })

  // Startup pe aaj ka backup check karo
  const todayFile = path.join(BACKUP_DIR, `VijayFlexPro-Backup-${todayStr()}.db`)
  if (!fs.existsSync(todayFile)) {
    console.log('[Backup] 📦 Aaj ka backup nahi mila — abhi le raha hoon...')
    runBackup()
  } else {
    console.log(`[Backup] ✅ Aaj ka backup already hai: VijayFlexPro-Backup-${todayStr()}.db`)
  }
}

module.exports = { startBackupScheduler, runBackup, getBackupList, BACKUP_DIR }