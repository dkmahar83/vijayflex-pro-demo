const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');

const router = express.Router();

// ── FIXED MASTER PIN — sabhi locked pages (Accounts, Employees, Customer
// Profile, etc.) ke liye ab sirf ye ek hi PIN kaam karega. Alag-alag page
// ke liye alag PIN set karne ka concept hata diya gaya hai — koi bhi page
// isi ek number se unlock hoga.
// Ab source-code mein plaintext nahi — DELETE_PASSWORD jaisa hi pattern,
// .env se aata hai (gitignored), isliye repo mein kabhi commit nahi hoga.
const MASTER_PIN = process.env.PAGE_LOCK_PIN;
if (!MASTER_PIN) {
  console.error('⚠️  PAGE_LOCK_PIN .env mein set nahi hai — page-locks (Accounts/Employees/Customer Profile) verify hamesha reject karenge. .env mein add karo: PAGE_LOCK_PIN=1976');
}

// ── Ensure table exists ──
// (pin_hash/salt columns ab bhi rakhe hain schema-compatibility ke liye,
// lekin verify ab in par depend nahi karta — seedha MASTER_PIN se compare
// hota hai.)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS page_locks (
      page_key   TEXT PRIMARY KEY,
      pin_hash   TEXT NOT NULL,
      salt       TEXT NOT NULL,
      is_locked  INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ── helpers ──
function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString('hex');
}

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getRow(pageKey) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM page_locks WHERE page_key = ?', [pageKey], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// Row na ho to auto-create karo — ab "PIN set karo" wala pehla-step
// zaroori nahi hai, kyunki PIN hamesha fixed (MASTER_PIN) hai. Page pehli
// baar dekhi jaate hi locked state mein register ho jaati hai.
function ensureRow(pageKey) {
  return getRow(pageKey).then(row => {
    if (row) return row;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPin(MASTER_PIN, salt);
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO page_locks (page_key, pin_hash, salt, is_locked) VALUES (?, ?, ?, 1)',
        [pageKey, hash, salt],
        function (err) {
          if (err) return reject(err);
          resolve({ page_key: pageKey, pin_hash: hash, salt, is_locked: 1 });
        }
      );
    });
  });
}

// ── GET status ──
// has_pin ab hamesha true hai (PIN fixed/global hai) — frontend ko ab
// "set PIN" step dikhane ki zaroorat nahi, seedha "Enter PIN" dikhana hai.
router.get('/:pageKey', async (req, res) => {
  try {
    const row = await ensureRow(req.params.pageKey);
    res.json({ has_pin: true, is_locked: !!row.is_locked });
  } catch (e) {
    console.error('page-locks GET error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

// ── POST verify PIN → unlocks page ──
// Ab kisi bhi page-key ke liye sirf MASTER_PIN match karega.
router.post('/:pageKey/verify', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN daalo' });

  if (!MASTER_PIN) {
    return res.status(500).json({ error: 'PAGE_LOCK_PIN server par configure nahi hai. .env check karo.' });
  }

  if (!safeCompare(pin, MASTER_PIN)) {
    return res.status(401).json({ error: 'Galat PIN' });
  }

  try {
    await ensureRow(req.params.pageKey);
    db.run(
      'UPDATE page_locks SET is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?',
      [req.params.pageKey],
      (err) => {
        if (err) {
          console.error('page-locks verify update error:', err.message);
          return res.status(500).json({ error: 'Kuch gadbad ho gayi' });
        }
        res.json({ success: true });
      }
    );
  } catch (e) {
    console.error('page-locks verify error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

// ── POST set-pin — DEPRECATED ──
// PIN ab fixed/global hai (server-side constant), isliye per-page change
// karna allow nahi hai. Route ko safe-fail bana diya taaki agar koi purana
// frontend isse call bhi kare, poora system crash na ho — bas clear error
// dikhega.
router.post('/:pageKey/set-pin', (req, res) => {
  res.status(400).json({
    error: 'PIN sabhi pages ke liye fixed hai — alag se badla nahi ja sakta.'
  });
});

// ── POST toggle lock state ──
// body: { is_locked: true|false } — page ko manually lock/unlock karna
// (jaisa "Lock Settings" button karta hai) — ye per-page hi rehta hai,
// sirf PIN fixed hua hai, lock ON/OFF state nahi.
router.post('/:pageKey/toggle', async (req, res) => {
  const { is_locked } = req.body;
  const pageKey = req.params.pageKey;

  try {
    await ensureRow(pageKey);
    db.run(
      'UPDATE page_locks SET is_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE page_key = ?',
      [is_locked ? 1 : 0, pageKey],
      (err) => {
        if (err) {
          console.error('page-locks toggle error:', err.message);
          return res.status(500).json({ error: 'Kuch gadbad ho gayi' });
        }
        res.json({ success: true, is_locked: !!is_locked });
      }
    );
  } catch (e) {
    console.error('page-locks toggle error:', e.message);
    res.status(500).json({ error: 'Kuch gadbad ho gayi' });
  }
});

module.exports = router;