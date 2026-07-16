// Demo-data seeder — sirf tab chalta hai jab:
//   1. .env mein SEED_DEMO_DATA=true ho (production folder mein ye kabhi na ho)
//   2. orders table khaali ho (matlab fresh/reset DB hai — idempotent hai,
//      dobara seed nahi karega agar already data hai)
const util = require('util');
const db = require('./db/database');
const logger = require('./utils/logger');

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}
const getAsync = util.promisify(db.get).bind(db);

function fmtDate(d) {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}
function fmtDateTime(d) {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

async function seedDemoData() {
  if (process.env.SEED_DEMO_DATA !== 'true') return;

  try {
    const existing = await getAsync(`SELECT COUNT(*) as c FROM orders`);
    if (existing.c > 0) {
      logger.info('Demo seed skipped — orders already exist.');
      return;
    }

    logger.info('Seeding demo data...');
    const year = new Date().getFullYear();

    // ── CUSTOMERS ──
    const customersData = [
      { key: 'sharma', firm_name: 'Sharma Traders', contact_name: 'Ramesh Sharma', phone: '9876543210' },
      { key: 'patel', firm_name: 'Patel General Store', contact_name: 'Kishore Patel', phone: '9823456701' },
      { key: 'gupta', firm_name: 'Gupta Enterprises', contact_name: 'Anil Gupta', phone: '9812345678', opening_balance: 2000, opening_balance_date: fmtDate(daysAgo(60)), opening_balance_notes: 'Pichle saal ka bakaya' },
      { key: 'verma', firm_name: 'Verma Print Solutions', contact_name: 'Suresh Verma', phone: '9898989898' },
      { key: 'singh', firm_name: 'Singh Hardware', contact_name: 'Jaswinder Singh', phone: '9765432109' },
      { key: 'mehta', firm_name: 'Mehta Stationery', contact_name: 'Priya Mehta', phone: '9654321098', opening_balance: 500, opening_balance_date: fmtDate(daysAgo(45)), opening_balance_notes: 'Pichle saal ka bakaya' },
    ];
    const cid = {};
    for (const c of customersData) {
      const r = await runAsync(
        `INSERT INTO customers (firm_name, contact_name, phone, opening_balance, opening_balance_date, opening_balance_notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [c.firm_name, c.contact_name, c.phone, c.opening_balance || 0, c.opening_balance_date || null, c.opening_balance_notes || null]
      );
      cid[c.key] = r.lastID;
    }

    // ── EMPLOYEES ──
    const employeesData = [
      { key: 'ravi', name: 'Ravi Kumar', phone: '9111122223', monthly_salary: 12000, join_date: fmtDate(daysAgo(180)) },
      { key: 'sunita', name: 'Sunita Devi', phone: '9222233334', monthly_salary: 10000, join_date: fmtDate(daysAgo(120)) },
      { key: 'manoj', name: 'Manoj Yadav', phone: '9333344445', monthly_salary: 15000, join_date: fmtDate(daysAgo(240)) },
    ];
    const eid = {};
    for (const e of employeesData) {
      const r = await runAsync(
        `INSERT INTO employees (name, phone, monthly_salary, join_date, is_active) VALUES (?, ?, ?, ?, 1)`,
        [e.name, e.phone, e.monthly_salary, e.join_date]
      );
      eid[e.key] = r.lastID;
    }
    // Attendance — last 5 days, mostly present
    for (const key of Object.keys(eid)) {
      for (let i = 0; i < 5; i++) {
        const status = (key === 'sunita' && i === 2) ? 'absent' : 'present';
        await runAsync(
          `INSERT OR IGNORE INTO attendance (employee_id, date, status) VALUES (?, ?, ?)`,
          [eid[key], fmtDate(daysAgo(i)), status]
        );
      }
    }

    // ── VENDORS ──
    const vendorsData = [
      { key: 'bansal', name: 'Bansal Flex Supplies', phone: '9444455556', shop_type: 'Flex Roll Supplier', city: 'Jaipur' },
      { key: 'city_chem', name: 'City Chemicals', phone: '9555566667', shop_type: 'Chemical Supplier', city: 'Jaipur' },
      { key: 'national', name: 'National Frame Works', phone: '9666677778', shop_type: 'Frame Manufacturer', city: 'Delhi' },
    ];
    const vid = {};
    for (const v of vendorsData) {
      const r = await runAsync(
        `INSERT INTO vendors (name, phone, shop_type, city, total_purchased, total_paid, balance_due) VALUES (?, ?, ?, ?, 0, 0, 0)`,
        [v.name, v.phone, v.shop_type, v.city]
      );
      vid[v.key] = r.lastID;
    }
    const vendorTxns = [
      { key: 'bansal', type: 'purchase', amount: 5000, description: 'Flex rolls 500GSM x10', date: daysAgo(10) },
      { key: 'bansal', type: 'payment', amount: 3000, description: 'Partial payment', payment_method: 'cash', date: daysAgo(8) },
      { key: 'city_chem', type: 'purchase', amount: 1200, description: 'Solvent + cleaning chemicals', date: daysAgo(6) },
      { key: 'national', type: 'purchase', amount: 2500, description: 'Photo frames bulk order', date: daysAgo(4) },
    ];
    for (const t of vendorTxns) {
      await runAsync(
        `INSERT INTO vendor_transactions (vendor_id, type, amount, transaction_date, description, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vid[t.key], t.type, t.amount, fmtDate(t.date), t.description, t.payment_method || null, fmtDateTime(t.date)]
      );
    }
    await runAsync(`UPDATE vendors SET total_purchased = 5000, total_paid = 3000, balance_due = 2000 WHERE id = ?`, [vid.bansal]);
    await runAsync(`UPDATE vendors SET total_purchased = 1200, total_paid = 0, balance_due = 1200 WHERE id = ?`, [vid.city_chem]);
    await runAsync(`UPDATE vendors SET total_purchased = 2500, total_paid = 0, balance_due = 2500 WHERE id = ?`, [vid.national]);

    // ── ORDERS (with items + payments) ──
    async function makeOrder({ customerKey, description, status, items, advancePaid, advancePaymentMode, discountAmount, discountNote, followUpDays, createdDaysAgo, orderNum, extraPayments }) {
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const balanceDue = total - advancePaid - (discountAmount || 0) - (extraPayments || []).reduce((s, p) => s + p.amount, 0);
      const created = daysAgo(createdDaysAgo);
      const r = await runAsync(
        `INSERT INTO orders (customer_id, description, status, total_amount, advance_paid, balance_due, follow_up_date, advance_payment_mode, discount_amount, discount_note, order_number, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cid[customerKey], description, status, total, advancePaid, balanceDue,
         followUpDays !== undefined ? fmtDate(daysFromNow(followUpDays)) : null,
         advancePaid > 0 ? advancePaymentMode : null, discountAmount || 0, discountNote || null,
         orderNum, fmtDateTime(created)]
      );
      const orderId = r.lastID;
      for (const it of items) {
        await runAsync(
          `INSERT INTO order_items (order_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`,
          [orderId, it.item_name, it.quantity, it.unit_price, it.quantity * it.unit_price]
        );
      }
      for (const p of (extraPayments || [])) {
        await runAsync(
          `INSERT INTO payments (order_id, customer_id, amount, payment_date, note, payment_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, cid[customerKey], p.amount, fmtDate(p.date), p.note || null, p.mode || 'cash', fmtDateTime(p.date)]
        );
      }
      return orderId;
    }

    await makeOrder({
      customerKey: 'sharma', description: 'Shop banner flex', status: 'in_progress',
      items: [{ item_name: 'Flex 180GSM banner', quantity: 40, unit_price: 25 }, { item_name: 'Eyelets', quantity: 20, unit_price: 5 }],
      advancePaid: 500, advancePaymentMode: 'cash', followUpDays: 3, createdDaysAgo: 5, orderNum: `VF-${year}-000001`
    });
    await makeOrder({
      customerKey: 'sharma', description: 'Visiting cards', status: 'delivered',
      items: [{ item_name: 'Visiting Card Printing', quantity: 500, unit_price: 2 }],
      advancePaid: 1000, advancePaymentMode: 'cash', createdDaysAgo: 15, orderNum: `VF-${year}-000002`
    });
    await makeOrder({
      customerKey: 'patel', description: 'Shop Signboard', status: 'ready',
      items: [{ item_name: 'Flex 300GSM', quantity: 60, unit_price: 30 }, { item_name: 'Frame + Fitting', quantity: 1, unit_price: 500 }],
      advancePaid: 1000, advancePaymentMode: 'cash', followUpDays: 2, createdDaysAgo: 7, orderNum: `VF-${year}-000003`,
      extraPayments: [{ amount: 800, date: daysAgo(3), note: 'Part payment', mode: 'cash' }]
    });
    await makeOrder({
      customerKey: 'gupta', description: 'Wedding card printing', status: 'pending',
      items: [{ item_name: 'Wedding Card', quantity: 200, unit_price: 15 }],
      advancePaid: 0, advancePaymentMode: null, followUpDays: 1, createdDaysAgo: 2, orderNum: `VF-${year}-000004`
    });
    await makeOrder({
      customerKey: 'verma', description: 'Office stamp + letterhead', status: 'delivered',
      items: [{ item_name: 'Rubber Stamp', quantity: 2, unit_price: 150 }, { item_name: 'Letterhead Printing', quantity: 100, unit_price: 3 }],
      advancePaid: 600, advancePaymentMode: 'upi', createdDaysAgo: 10, orderNum: `VF-${year}-000005`
    });
    await makeOrder({
      customerKey: 'singh', description: 'Hoarding flex 20x10', status: 'in_progress',
      items: [{ item_name: 'Flex 500GSM', quantity: 200, unit_price: 35 }],
      advancePaid: 3000, advancePaymentMode: 'cash', followUpDays: 5, createdDaysAgo: 4, orderNum: `VF-${year}-000006`,
      extraPayments: [{ amount: 2000, date: daysAgo(1), note: 'Part payment', mode: 'cash' }]
    });
    await makeOrder({
      customerKey: 'mehta', description: 'Notebook printing', status: 'pending',
      items: [{ item_name: 'Custom Notebook', quantity: 100, unit_price: 40 }],
      advancePaid: 1500, advancePaymentMode: 'cash', followUpDays: 0, createdDaysAgo: 3, orderNum: `VF-${year}-000007`
    });
    await makeOrder({
      customerKey: 'sharma', description: 'Diwali offer banner', status: 'delivered',
      items: [{ item_name: 'Flex 200GSM', quantity: 30, unit_price: 28 }],
      advancePaid: 0, advancePaymentMode: null, discountAmount: 40, discountNote: 'Round-off',
      followUpDays: -2, createdDaysAgo: 12, orderNum: `VF-${year}-000008`
    });

    // ── CHEQUES ──
    const cheques = [
      { customerKey: 'patel', cheque_number: '445521', bank_name: 'SBI', amount: 1500, status: 'cleared', date: daysAgo(9) },
      { customerKey: 'singh', cheque_number: '778890', bank_name: 'PNB', amount: 2500, status: 'received', date: daysAgo(2) },
      { customerKey: 'gupta', cheque_number: '112233', bank_name: 'HDFC', amount: 800, status: 'bounced', date: daysAgo(15) },
    ];
    for (const c of cheques) {
      await runAsync(
        `INSERT INTO cheques (cheque_number, firm_name, customer_id, bank_name, amount, received_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.cheque_number, customersData.find(x => x.key === c.customerKey).firm_name, cid[c.customerKey], c.bank_name, c.amount, fmtDate(c.date), c.status]
      );
    }

    // ── UPI TRANSACTIONS (standalone) ──
    const upiTxns = [
      { customerKey: 'gupta', upi_account: 'Demo UPI Account 1', amount: 250, date: daysAgo(6) },
      { customerKey: null, upi_account: 'Demo UPI Account 2', customer_name: 'Walk-in Customer', amount: 180, date: daysAgo(3) },
    ];
    for (const u of upiTxns) {
      await runAsync(
        `INSERT INTO upi_transactions (upi_account, customer_name, customer_id, amount, transaction_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [u.upi_account, u.customer_name || (u.customerKey ? customersData.find(x => x.key === u.customerKey).firm_name : null), u.customerKey ? cid[u.customerKey] : null, u.amount, fmtDate(u.date), fmtDateTime(u.date)]
      );
    }

    // ── CASH INCOME (standalone) ──
    const cashIncomes = [
      { customerKey: 'mehta', amount: 300, notes: 'Extra material sale', mode: 'cash', date: daysAgo(4) },
      { customerKey: 'verma', amount: 150, notes: 'Misc income', mode: 'cash', date: daysAgo(2) },
    ];
    for (const ci of cashIncomes) {
      await runAsync(
        `INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [cid[ci.customerKey], ci.amount, fmtDate(ci.date), ci.notes, ci.mode, fmtDateTime(ci.date)]
      );
    }

    // ── EXPENSES ──
    const expenses = [
      { category: 'Rent', amount: 8000, description: 'Shop rent - monthly', date: daysAgo(20) },
      { category: 'Electricity Bill', amount: 1500, description: null, date: daysAgo(15) },
      { category: 'Chai Pani', amount: 100, description: null, date: daysAgo(1) },
      { category: 'Commission', amount: 500, description: 'Commission wapas', customerKey: 'sharma', date: daysAgo(5) },
      { category: 'Fuel/Transport', amount: 300, description: null, date: daysAgo(3) },
    ];
    for (const ex of expenses) {
      await runAsync(
        `INSERT INTO expenses (category, amount, expense_date, description, payment_mode, customer_id, customer_name) VALUES (?, ?, ?, ?, 'cash', ?, ?)`,
        [ex.category, ex.amount, fmtDate(ex.date), ex.description,
         ex.customerKey ? cid[ex.customerKey] : null,
         ex.customerKey ? customersData.find(x => x.key === ex.customerKey).firm_name : null]
      );
    }

    // ── INVENTORY ──
    await runAsync(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit) VALUES ('Flex King', 8, 12, 'roll')`);
    await runAsync(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit) VALUES ('Flex King', 10, 3, 'roll')`);
    await runAsync(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit) VALUES ('SuperPrint', 6, 0, 'roll')`);

    await runAsync(`INSERT INTO inventory_stamps (stamp_type, size, design_type, quantity) VALUES ('Self-Inking', 'Small', 'Round', 15)`);
    await runAsync(`INSERT INTO inventory_stamps (stamp_type, size, design_type, quantity) VALUES ('Rubber', 'Medium', 'Rectangle', 2)`);

    await runAsync(`INSERT INTO inventory_chemicals (chemical_name, quantity, unit, minimum_stock) VALUES ('Solvent Ink Cleaner', 8, 'litre', 5)`);
    await runAsync(`INSERT INTO inventory_chemicals (chemical_name, quantity, unit, minimum_stock) VALUES ('Lamination Solution', 1, 'litre', 3)`);

    await runAsync(`INSERT INTO inventory_frames (frame_type, size, design, quantity) VALUES ('Wooden', '12x18', 'Classic', 10)`);
    await runAsync(`INSERT INTO inventory_frames (frame_type, size, design, quantity) VALUES ('Plastic', '8x10', 'Modern', 0)`);

    await runAsync(`INSERT INTO inventory_ink (item_name, item_type, quantity, unit, minimum_level) VALUES ('Cyan Ink', 'ink', 4, 'litre', 2)`);
    await runAsync(`INSERT INTO inventory_ink (item_name, item_type, quantity, unit, minimum_level) VALUES ('Black Solvent', 'solvent', 1, 'litre', 2)`);

    // ── SETTINGS ──
    // Note-wise Cash Tracking demo mein OFF rakh raha hoon (default) — taaki
    // pehli baar demo explore karne wale ko amount-fields locked na milein.
    // Toggle karke woh khud dekh sakte hain feature kaise kaam karta hai.
    await runAsync(
      `INSERT INTO app_settings (key, value) VALUES ('note_tracking_enabled', 'false')
       ON CONFLICT(key) DO UPDATE SET value = 'false'`
    );

    logger.info('✅ Demo data seeded successfully — 6 customers, 8 orders, 3 employees, 3 vendors, inventory, cheques, expenses.');
  } catch (err) {
    logger.error('Demo seed failed: ' + err.message);
  }
}

module.exports = { seedDemoData };