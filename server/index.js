// Permanent fix: whatsapp-web.js + puppeteer ka known bug — disconnect ke baad
// library internally detached frame mein script inject karne ki koshish karti hai,
// jo uncaught exception throw karta hai aur pura process crash kar deta hai.
// Yeh handler sirf process ko zinda rakhta hai, hamara apna disconnect/reinit logic
// (whatsapp.js mein) waise hi chalta rehta hai.
require('dotenv').config();
const logger = require('./utils/logger');

process.on('uncaughtException', (err) => {
  if (err && err.message && err.message.includes('detached Frame')) {
    logger.warn('WhatsApp Chrome frame detached (non-fatal, ignored): ' + err.message)
    return
  }
  logger.error('Uncaught Exception: ' + err.stack || err)
})

process.on('unhandledRejection', (reason) => {
  if (reason && reason.message && reason.message.includes('detached Frame')) {
    logger.warn('WhatsApp Chrome frame detached (non-fatal, ignored): ' + reason.message)
    return
  }
  logger.error('Unhandled Rejection: ' + (reason?.stack || reason))
})
const db = require('./db/database');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true
}))
app.use(express.json());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ROUTES ──
const authRoutes      = require('./routes/auth')
const customerRoutes  = require('./routes/customers')
const orderRoutes     = require('./routes/orders')
const paymentRoutes   = require('./routes/payments')
const employeeRoutes  = require('./routes/employees')
const dashboardRoutes = require('./routes/dashboard')
const dailyRoutes     = require('./routes/daily')
const expenseRoutes   = require('./routes/expenses')
const chequeRoutes    = require('./routes/cheques')
const upiRoutes       = require('./routes/upi')
const vendorRoutes    = require('./routes/vendors')
const inventoryRoutes = require('./routes/inventory')
const pdfRoutes       = require('./routes/pdf')
const whatsappRoutes  = require('./routes/whatsapp')
const commissionRoutes = require('./routes/commission')
const pageLockRoutes = require('./routes/pageLocks')
const backupRoutes = require('./routes/backup')
const settingsRoutes = require('./routes/settings')
const { startBackupScheduler } = require('./backup')




// ── AUTH MIDDLEWARE ──
const requireAuth = require('./middleware/auth')

// ── WHATSAPP ──
const { initWhatsApp } = require('./whatsapp')

// ── PUBLIC ROUTES ──
app.use('/api/auth', authRoutes)

// ── PROTECTED ROUTES ──
app.use('/api/customers',  requireAuth, customerRoutes)
app.use('/api/orders',     requireAuth, orderRoutes)
app.use('/api/payments',   requireAuth, paymentRoutes)
app.use('/api/employees',  requireAuth, employeeRoutes)
app.use('/api/dashboard',  requireAuth, dashboardRoutes)
app.use('/api/daily',      requireAuth, dailyRoutes)
app.use('/api/expenses',   requireAuth, expenseRoutes)
app.use('/api/cheques',    requireAuth, chequeRoutes)
app.use('/api/upi',        requireAuth, upiRoutes)
app.use('/api/vendors',    requireAuth, vendorRoutes)
app.use('/api/inventory',  requireAuth, inventoryRoutes)
app.use('/api/pdf',        requireAuth, pdfRoutes)
app.use('/api/whatsapp',   requireAuth, whatsappRoutes)
app.use('/api/commission', requireAuth, commissionRoutes)
app.use('/api/page-locks', requireAuth, pageLockRoutes)
app.use('/api/backup', requireAuth, backupRoutes)
app.use('/api/settings', requireAuth, settingsRoutes)
app.use('/api/upi-qr-history', requireAuth, require('./routes/upiQrHistory'))

app.get('/', (req, res) => {
  res.json({ message: 'VijayFlex Pro API is running!' })
})
// Global error handler — catches multer errors etc, always returns JSON
app.use((err, req, res, next) => {
  logger.error(`Server error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

const { seedDemoData } = require('./seed_demo')

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  // Demo/Render deployment mein WhatsApp init nahi chalana — Puppeteer/Chromium
  // Render ke default environment mein available nahi hota (extra buildpack
  // chahiye), aur QR-scan bhi demo-user ke liye practical nahi hai. .env mein
  // DISABLE_WHATSAPP=true set karo demo ke liye; asli production .env mein
  // ye unset/false rakhna, normal behavior chalega.
  if (process.env.DISABLE_WHATSAPP !== 'true') {
    setTimeout(initWhatsApp, 3000)
  } else {
    logger.info('WhatsApp init skipped (DISABLE_WHATSAPP=true)')
  }
  startBackupScheduler()
  // Demo-data seeding — sirf SEED_DEMO_DATA=true hone par aur DB khaali hone
  // par chalega (idempotent). Production .env mein ye variable kabhi na rakho.
  setTimeout(seedDemoData, 2000)
})

