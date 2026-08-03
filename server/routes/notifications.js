const express = require('express');
const router = express.Router();
const db = require('../db/database');
const util = require('util');

const dbAllAsync = util.promisify(db.all).bind(db);
const dbGetAsync = util.promisify(db.get).bind(db);
function dbRunAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

function todayIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}

// table_name → human category label (dashboard.js ki getLowStockAlerts()
// jaisa hi mapping, taaki dono jagah same labels dikhein)
const CATEGORY_LABELS = {
  inventory_flex: 'Flex Roll',
  inventory_frames: 'Photo Frame',
  inventory_stamps: 'Stamp',
  inventory_chemicals: 'Chemical',
  inventory_ink: 'Ink/Solvent',
  inventory_dynamic_items: 'Inventory Item',
};

// dashboard.js ke getLowStockAlerts() jaisa hi, bas yahan har row ka
// table+id bhi return karte hain — taaki har alert ke liye ek STABLE,
// unique notification-key ban sake (dashboard wala version sirf display
// ke liye hai, id nahi deta).
async function getLowStockForNotifications() {
  const [flexLow, framesLow, stampsOut, chemLow, inkLow, dynLow] = await Promise.all([
    dbAllAsync(`SELECT id, brand, size_ft, quantity FROM inventory_flex WHERE quantity <= 1`),
    dbAllAsync(`SELECT id, frame_type, size, design, quantity FROM inventory_frames WHERE quantity < 5`),
    dbAllAsync(`SELECT id, stamp_type, size, quantity FROM inventory_stamps WHERE quantity = 0`),
    dbAllAsync(`SELECT id, chemical_name, quantity, unit, minimum_stock FROM inventory_chemicals WHERE quantity = 0 OR (minimum_stock > 0 AND quantity <= minimum_stock)`),
    dbAllAsync(`SELECT id, item_name, item_type, quantity, unit, minimum_level FROM inventory_ink WHERE quantity = 0 OR (minimum_level > 0 AND quantity <= minimum_level)`),
    dbAllAsync(`
      SELECT d.id, d.item_name, d.attr1, d.attr2, d.quantity, d.unit, c.label as category_label
      FROM inventory_dynamic_items d
      JOIN inventory_categories c ON d.category_id = c.id
      WHERE d.quantity = 0 OR (d.minimum_stock > 0 AND d.quantity <= d.minimum_stock)
    `)
  ]);

  return [
    ...flexLow.map(f => ({
      table: 'inventory_flex', id: f.id, category: CATEGORY_LABELS.inventory_flex,
      item_name: `${f.brand} ${f.size_ft}ft`, quantity: f.quantity, unit: 'roll',
      status: f.quantity === 0 ? 'out' : 'low'
    })),
    ...framesLow.map(f => ({
      table: 'inventory_frames', id: f.id, category: CATEGORY_LABELS.inventory_frames,
      item_name: `${f.frame_type}${f.size ? ' ' + f.size : ''}${f.design ? ' ' + f.design : ''}`,
      quantity: f.quantity, unit: 'pcs', status: f.quantity === 0 ? 'out' : 'low'
    })),
    ...stampsOut.map(s => ({
      table: 'inventory_stamps', id: s.id, category: CATEGORY_LABELS.inventory_stamps,
      item_name: `${s.stamp_type}${s.size ? ' ' + s.size : ''}`,
      quantity: s.quantity, unit: 'pcs', status: 'out'
    })),
    ...chemLow.map(c => ({
      table: 'inventory_chemicals', id: c.id, category: CATEGORY_LABELS.inventory_chemicals,
      item_name: c.chemical_name, quantity: c.quantity, unit: c.unit,
      status: c.quantity === 0 ? 'out' : 'low'
    })),
    ...inkLow.map(i => ({
      table: 'inventory_ink', id: i.id, category: i.item_type === 'solvent' ? 'Solvent' : 'Ink',
      item_name: i.item_name, quantity: i.quantity, unit: i.unit,
      status: i.quantity === 0 ? 'out' : 'low'
    })),
    ...dynLow.map(d => ({
      table: 'inventory_dynamic_items', id: d.id, category: d.category_label,
      item_name: `${d.item_name}${d.attr1 ? ' ' + d.attr1 : ''}${d.attr2 ? ' ' + d.attr2 : ''}`,
      quantity: d.quantity, unit: d.unit, status: d.quantity === 0 ? 'out' : 'low'
    })),
  ];
}

// GET /api/notifications — teeno source combine karke ek list deta hai.
// Har item ki "key" mein aaj ki date bhi hoti hai, isliye "read" state
// har din khud-ba-khud reset ho jaata hai (jab tak underlying cheez —
// jaise balance due ya low stock — resolve na ho jaaye, tab tak roz
// fresh reminder ki tarah wapas aata rahega).
router.get('/', async (req, res) => {
  const today = todayIST();

  // Purane "read" markers ka best-effort cleanup — non-blocking, error ignore
  db.run(`DELETE FROM notification_reads WHERE notif_date < date('now', '-14 days')`, () => {});

  try {
    const items = [];

    // 1. FOLLOW-UPS — aaj due ya overdue, aur balance abhi bhi due hai
    const followUps = await dbAllAsync(`
      SELECT orders.id as order_id, orders.description, orders.balance_due,
        orders.follow_up_date, customers.id as customer_id, customers.firm_name
      FROM orders
      JOIN customers ON orders.customer_id = customers.id AND customers.deleted_at IS NULL
      WHERE orders.balance_due > 0
        AND orders.follow_up_date IS NOT NULL
        AND orders.follow_up_date <= ?
        AND orders.deleted_at IS NULL
      ORDER BY orders.follow_up_date ASC
    `, [today]);

    followUps.forEach(o => {
      const isOverdue = o.follow_up_date < today;
      items.push({
        key: `followup-${o.order_id}-${today}`,
        type: 'followup',
        severity: isOverdue ? 'high' : 'medium',
        title: isOverdue ? `Overdue follow-up — ${o.firm_name}` : `Follow-up today — ${o.firm_name}`,
        subtitle: `${o.description || 'Order'} · Balance ₹${o.balance_due}`,
        link: `/customers/${o.customer_id}`,
      });
    });

    // 2. LOW STOCK — saari inventory tables se combined
    const lowStock = await getLowStockForNotifications();
    lowStock.forEach(item => {
      items.push({
        key: `lowstock-${item.table}-${item.id}-${today}`,
        type: 'lowstock',
        severity: item.status === 'out' ? 'high' : 'medium',
        title: item.status === 'out' ? `Out of stock — ${item.item_name}` : `Low stock — ${item.item_name}`,
        subtitle: `${item.category} · ${item.quantity} ${item.unit} remaining`,
        link: '/inventory',
      });
    });

    // 3. ATTENDANCE — sirf 10 AM IST ke baad, agar koi active employee ka
    // aaj ka attendance abhi tak mark nahi hua
    const istHour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false
    }).format(new Date()));

    if (istHour >= 10) {
      const unmarked = await dbGetAsync(`
        SELECT COUNT(*) as cnt FROM employees
        WHERE is_active = 1
          AND id NOT IN (SELECT employee_id FROM attendance WHERE date = ?)
      `, [today]);
      if (unmarked.cnt > 0) {
        items.push({
          key: `attendance-${today}`,
          type: 'attendance',
          severity: 'medium',
          title: 'Mark today\u2019s attendance',
          subtitle: `${unmarked.cnt} employee${unmarked.cnt !== 1 ? 's' : ''} not marked yet`,
          link: '/employees',
        });
      }
    }

    // Read-state merge — aaj ke liye kaunse keys already read-mark hain
    const readRows = await dbAllAsync(`SELECT notification_key FROM notification_reads WHERE notif_date = ?`, [today]);
    const readSet = new Set(readRows.map(r => r.notification_key));
    const notifications = items.map(n => ({ ...n, read: readSet.has(n.key) }));

    res.json({
      date: today,
      unread_count: notifications.filter(n => !n.read).length,
      notifications,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read — ek notification ko read mark karo
router.post('/read', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  try {
    await dbRunAsync(
      `INSERT INTO notification_reads (notification_key, notif_date) VALUES (?, ?)
       ON CONFLICT(notification_key) DO NOTHING`,
      [key, todayIST()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all — ek saath saari (ya di hui) keys read mark karo
router.post('/read-all', async (req, res) => {
  const { keys } = req.body;
  if (!Array.isArray(keys)) return res.status(400).json({ error: 'keys array is required' });
  try {
    const today = todayIST();
    for (const key of keys) {
      await dbRunAsync(
        `INSERT INTO notification_reads (notification_key, notif_date) VALUES (?, ?)
         ON CONFLICT(notification_key) DO NOTHING`,
        [key, today]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;