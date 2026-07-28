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

// ── RANDOMIZATION HELPERS — har seed run pe alag dummy data ──
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function weightedMode(cashProb = 0.8) { return Math.random() < cashProb ? 'cash' : 'upi'; }

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

    // Tracks total CASH actually collected (advance-cash + extra-cash-payments +
    // cash_income) so we can size expenses safely below this and never let the
    // Cash Drawer go negative.
    let totalCashCollected = 0;

    // ── CUSTOMERS ──
    const customersData = [
      { key: 'sharma', firm_name: 'Sharma Traders', contact_name: 'Ramesh Sharma', phone: '9876543210' },
      { key: 'patel', firm_name: 'Patel General Store', contact_name: 'Kishore Patel', phone: '9823456701' },
      { key: 'gupta', firm_name: 'Gupta Enterprises', contact_name: 'Anil Gupta', phone: '9812345678', opening_balance: randInt(1000, 3000), opening_balance_date: fmtDate(daysAgo(60)), opening_balance_notes: 'Pichle saal ka bakaya' },
      { key: 'verma', firm_name: 'Verma Print Solutions', contact_name: 'Suresh Verma', phone: '9898989898' },
      { key: 'singh', firm_name: 'Singh Hardware', contact_name: 'Jaswinder Singh', phone: '9765432109' },
      { key: 'mehta', firm_name: 'Mehta Stationery', contact_name: 'Priya Mehta', phone: '9654321098', opening_balance: randInt(300, 800), opening_balance_date: fmtDate(daysAgo(45)), opening_balance_notes: 'Pichle saal ka bakaya' },
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
    // Attendance — last 5 days, randomly ek-do absent
    for (const key of Object.keys(eid)) {
      const absentDay = randInt(0, 6); // kabhi kabhi koi absent day hi nahi (6 = out of range)
      for (let i = 0; i < 5; i++) {
        const status = (i === absentDay) ? 'absent' : 'present';
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
    // Vendor amounts thoda randomize — ye "outgoing to vendor" hai, shop ke apne
    // cash drawer ko directly touch nahi karta (jab tak expense na ho), isliye safe hai
    const bansalPurchase = randInt(4000, 6500);
    const bansalPaid = Math.round(bansalPurchase * randFloat(0.5, 0.75));
    const cityChemPurchase = randInt(900, 1600);
    const nationalPurchase = randInt(1800, 3200);

    const vendorTxns = [
      { key: 'bansal', type: 'purchase', amount: bansalPurchase, description: 'Flex rolls 500GSM x10', date: daysAgo(10) },
      { key: 'bansal', type: 'payment', amount: bansalPaid, description: 'Partial payment', payment_method: 'cash', date: daysAgo(8) },
      { key: 'city_chem', type: 'purchase', amount: cityChemPurchase, description: 'Solvent + cleaning chemicals', date: daysAgo(6) },
      { key: 'national', type: 'purchase', amount: nationalPurchase, description: 'Photo frames bulk order', date: daysAgo(4) },
    ];
    for (const t of vendorTxns) {
      await runAsync(
        `INSERT INTO vendor_transactions (vendor_id, type, amount, transaction_date, description, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vid[t.key], t.type, t.amount, fmtDate(t.date), t.description, t.payment_method || null, fmtDateTime(t.date)]
      );
    }
    await runAsync(`UPDATE vendors SET total_purchased = ?, total_paid = ?, balance_due = ? WHERE id = ?`, [bansalPurchase, bansalPaid, bansalPurchase - bansalPaid, vid.bansal]);
    await runAsync(`UPDATE vendors SET total_purchased = ?, total_paid = 0, balance_due = ? WHERE id = ?`, [cityChemPurchase, cityChemPurchase, vid.city_chem]);
    await runAsync(`UPDATE vendors SET total_purchased = ?, total_paid = 0, balance_due = ? WHERE id = ?`, [nationalPurchase, nationalPurchase, vid.national]);

    // ── ORDERS (with items + payments + PROPERLY LINKED advance) ──
    async function insertAdvanceRecord(customerKey, orderId, amount, mode, date) {
      const dateStr = fmtDate(date);
      const dateTimeStr = fmtDateTime(date);
      if (mode === 'upi') {
        const r = await runAsync(
          `INSERT INTO upi_transactions (upi_account, customer_name, customer_id, order_id, amount, transaction_date, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'Order Advance Payment', ?)`,
          ['Demo UPI Account 1', customersData.find(x => x.key === customerKey).firm_name, cid[customerKey], orderId, amount, dateStr, dateTimeStr]
        );
        return { table: 'upi_transactions', id: r.lastID };
      } else {
        // cash advance — isko cash_income mein daalna zaroori hai warna
        // Cash Drawer isko "cash in" nahi maanega, jabki expenses "cash out" ban jaate hain
        const r = await runAsync(
          `INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, created_at) VALUES (?, ?, ?, 'Order Advance Payment', 'cash', ?)`,
          [cid[customerKey], amount, dateStr, dateTimeStr]
        );
        totalCashCollected += amount;
        return { table: 'cash_income', id: r.lastID };
      }
    }

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
      // Advance ko properly link karo (cash_income/upi_transactions + orders.advance_entry_*)
      if (advancePaid > 0) {
        const adv = await insertAdvanceRecord(customerKey, orderId, advancePaid, advancePaymentMode, created);
        await runAsync(`UPDATE orders SET advance_entry_table = ?, advance_entry_id = ? WHERE id = ?`, [adv.table, adv.id, orderId]);
      }
      for (const p of (extraPayments || [])) {
        await runAsync(
          `INSERT INTO payments (order_id, customer_id, amount, payment_date, note, payment_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, cid[customerKey], p.amount, fmtDate(p.date), p.note || null, p.mode || 'cash', fmtDateTime(p.date)]
        );
        if ((p.mode || 'cash') === 'cash') totalCashCollected += p.amount;
      }
      return orderId;
    }

    // Har order ke liye base template — quantity/advance % har run randomize hote hain
    const orderTemplates = [
      { customerKey: 'sharma', description: 'Shop banner flex', status: 'in_progress',
        items: [{ item_name: 'Flex 180GSM banner', qtyRange: [30, 50], unit_price: 25 }, { item_name: 'Eyelets', qtyRange: [15, 25], unit_price: 5 }],
        followUpDays: randInt(1, 4), createdDaysAgo: randInt(3, 7) },
      { customerKey: 'sharma', description: 'Visiting cards', status: 'delivered',
        items: [{ item_name: 'Visiting Card Printing', qtyRange: [400, 600], unit_price: 2 }],
        createdDaysAgo: randInt(10, 18) },
      { customerKey: 'patel', description: 'Shop Signboard', status: 'ready',
        items: [{ item_name: 'Flex 300GSM', qtyRange: [50, 70], unit_price: 30 }, { item_name: 'Frame + Fitting', qtyRange: [1, 1], unit_price: 500 }],
        followUpDays: randInt(1, 3), createdDaysAgo: randInt(5, 9),
        extra: true },
      { customerKey: 'gupta', description: 'Wedding card printing', status: 'pending',
        items: [{ item_name: 'Wedding Card', qtyRange: [150, 250], unit_price: 15 }],
        advanceOverride: 0, followUpDays: randInt(0, 2), createdDaysAgo: randInt(1, 3) },
      { customerKey: 'verma', description: 'Office stamp + letterhead', status: 'delivered',
        items: [{ item_name: 'Rubber Stamp', qtyRange: [2, 3], unit_price: 150 }, { item_name: 'Letterhead Printing', qtyRange: [80, 120], unit_price: 3 }],
        createdDaysAgo: randInt(8, 12), modeOverride: 'upi' },
      { customerKey: 'singh', description: 'Hoarding flex 20x10', status: 'in_progress',
        items: [{ item_name: 'Flex 500GSM', qtyRange: [150, 220], unit_price: 35 }],
        followUpDays: randInt(3, 6), createdDaysAgo: randInt(3, 6), extra: true },
      { customerKey: 'mehta', description: 'Notebook printing', status: 'pending',
        items: [{ item_name: 'Custom Notebook', qtyRange: [80, 120], unit_price: 40 }],
        followUpDays: randInt(-1, 1), createdDaysAgo: randInt(2, 4) },
      { customerKey: 'sharma', description: 'Diwali offer banner', status: 'delivered',
        items: [{ item_name: 'Flex 200GSM', qtyRange: [25, 35], unit_price: 28 }],
        advanceOverride: 0, discountAmount: randInt(20, 60), discountNote: 'Round-off',
        followUpDays: randInt(-4, -1), createdDaysAgo: randInt(10, 14) },
    ];

    let orderCounter = 1;
    for (const t of orderTemplates) {
      const items = t.items.map(i => ({ item_name: i.item_name, quantity: randInt(i.qtyRange[0], i.qtyRange[1]), unit_price: i.unit_price }));
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const advancePaid = t.advanceOverride !== undefined ? t.advanceOverride : Math.round(total * randFloat(0.3, 0.65));
      const advancePaymentMode = advancePaid > 0 ? (t.modeOverride || weightedMode(0.8)) : null;

      const extraPayments = [];
      if (t.extra) {
        const remaining = total - advancePaid - (t.discountAmount || 0);
        const extraAmt = Math.round(remaining * randFloat(0.4, 0.8));
        if (extraAmt > 0) {
          extraPayments.push({ amount: extraAmt, date: daysAgo(randInt(1, Math.max(1, t.createdDaysAgo - 1))), note: 'Part payment', mode: weightedMode(0.85) });
        }
      }

      await makeOrder({
        customerKey: t.customerKey, description: t.description, status: t.status, items,
        advancePaid, advancePaymentMode,
        discountAmount: t.discountAmount, discountNote: t.discountNote,
        followUpDays: t.followUpDays, createdDaysAgo: t.createdDaysAgo,
        orderNum: `VF-${year}-${String(orderCounter++).padStart(6, '0')}`,
        extraPayments
      });
    }

    // ── CHEQUES ──
    const cheques = [
      { customerKey: 'patel', cheque_number: '445521', bank_name: 'SBI', amount: randInt(1200, 1800), status: 'cleared', date: daysAgo(9) },
      { customerKey: 'singh', cheque_number: '778890', bank_name: 'PNB', amount: randInt(2000, 3000), status: 'received', date: daysAgo(2) },
      { customerKey: 'gupta', cheque_number: '112233', bank_name: 'HDFC', amount: randInt(600, 1000), status: 'bounced', date: daysAgo(15) },
    ];
    for (const c of cheques) {
      await runAsync(
        `INSERT INTO cheques (cheque_number, firm_name, customer_id, bank_name, amount, received_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.cheque_number, customersData.find(x => x.key === c.customerKey).firm_name, cid[c.customerKey], c.bank_name, c.amount, fmtDate(c.date), c.status]
      );
    }

    // ── UPI TRANSACTIONS (standalone, non-order) ──
    const upiTxns = [
      { customerKey: 'gupta', upi_account: 'Demo UPI Account 1', amount: randInt(150, 350), date: daysAgo(6) },
      { customerKey: null, upi_account: 'Demo UPI Account 2', customer_name: 'Walk-in Customer', amount: randInt(100, 250), date: daysAgo(3) },
    ];
    for (const u of upiTxns) {
      await runAsync(
        `INSERT INTO upi_transactions (upi_account, customer_name, customer_id, amount, transaction_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [u.upi_account, u.customer_name || (u.customerKey ? customersData.find(x => x.key === u.customerKey).firm_name : null), u.customerKey ? cid[u.customerKey] : null, u.amount, fmtDate(u.date), fmtDateTime(u.date)]
      );
    }

    // ── CASH INCOME (standalone, non-order) ──
    const cashIncomes = [
      { customerKey: 'mehta', amount: randInt(200, 450), notes: 'Extra material sale', mode: 'cash', date: daysAgo(4) },
      { customerKey: 'verma', amount: randInt(100, 250), notes: 'Misc income', mode: 'cash', date: daysAgo(2) },
    ];
    for (const ci of cashIncomes) {
      await runAsync(
        `INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [cid[ci.customerKey], ci.amount, fmtDate(ci.date), ci.notes, ci.mode, fmtDateTime(ci.date)]
      );
      if (ci.mode === 'cash') totalCashCollected += ci.amount;
    }

    // ── EXPENSES ──
    // IMPORTANT: expenses ka total budget ab totalCashCollected ke ek safe
    // fraction (55%-75%) tak hi capped hai — isliye Cash Drawer ka
    // closing balance kabhi bhi negative NAHI jaayega, chahe upar ke
    // randomized amounts kuch bhi bane hon.
    const expenseBudget = Math.max(2000, Math.round(totalCashCollected * randFloat(0.55, 0.75)));
    const expenseTemplates = [
      { category: 'Rent', weight: 0.45, description: 'Shop rent - monthly', date: daysAgo(20) },
      { category: 'Electricity Bill', weight: 0.18, description: null, date: daysAgo(15) },
      { category: 'Chai Pani', weight: 0.03, description: null, date: daysAgo(randInt(1, 3)) },
      { category: 'Commission', weight: 0.12, description: 'Commission wapas', customerKey: 'sharma', date: daysAgo(5) },
      { category: 'Fuel/Transport', weight: 0.07, description: null, date: daysAgo(3) },
      { category: 'Misc/Stationery', weight: 0.05, description: 'Shop supplies', date: daysAgo(randInt(6, 12)) },
    ];
    const weightSum = expenseTemplates.reduce((s, e) => s + e.weight, 0);
    for (const ex of expenseTemplates) {
      const amount = Math.max(50, Math.round(expenseBudget * (ex.weight / weightSum) * randFloat(0.8, 1.15)));
      await runAsync(
        `INSERT INTO expenses (category, amount, expense_date, description, payment_mode, customer_id, customer_name) VALUES (?, ?, ?, ?, 'cash', ?, ?)`,
        [ex.category, amount, fmtDate(ex.date), ex.description,
         ex.customerKey ? cid[ex.customerKey] : null,
         ex.customerKey ? customersData.find(x => x.key === ex.customerKey).firm_name : null]
      );
    }

    // ── INVENTORY ── (quantities randomize taaki low-stock warnings bhi kabhi kabhi trigger ho)
    await runAsync(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit) VALUES ('Flex King', 8, ?, 'roll')`, [randInt(8, 15)]);
    await runAsync(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit) VALUES ('Flex King', 10, ?, 'roll')`, [randInt(1, 5)]);
    await runAsync(`INSERT INTO inventory_flex (brand, size_ft, quantity, unit) VALUES ('SuperPrint', 6, 0, 'roll')`);

    await runAsync(`INSERT INTO inventory_stamps (stamp_type, size, design_type, quantity) VALUES ('Self-Inking', 'Small', 'Round', ?)`, [randInt(10, 20)]);
    await runAsync(`INSERT INTO inventory_stamps (stamp_type, size, design_type, quantity) VALUES ('Rubber', 'Medium', 'Rectangle', ?)`, [randInt(1, 4)]);

    await runAsync(`INSERT INTO inventory_chemicals (chemical_name, quantity, unit, minimum_stock) VALUES ('Solvent Ink Cleaner', ?, 'litre', 5)`, [randInt(5, 10)]);
    await runAsync(`INSERT INTO inventory_chemicals (chemical_name, quantity, unit, minimum_stock) VALUES ('Lamination Solution', ?, 'litre', 3)`, [randInt(1, 3)]);

    await runAsync(`INSERT INTO inventory_frames (frame_type, size, design, quantity) VALUES ('Wooden', '12x18', 'Classic', ?)`, [randInt(6, 14)]);
    await runAsync(`INSERT INTO inventory_frames (frame_type, size, design, quantity) VALUES ('Plastic', '8x10', 'Modern', 0)`);

    await runAsync(`INSERT INTO inventory_ink (item_name, item_type, quantity, unit, minimum_level) VALUES ('Cyan Ink', 'ink', ?, 'litre', 2)`, [randInt(2, 6)]);
    await runAsync(`INSERT INTO inventory_ink (item_name, item_type, quantity, unit, minimum_level) VALUES ('Black Solvent', 'solvent', ?, 'litre', 2)`, [randInt(1, 3)]);

    // ── SETTINGS ──
    await runAsync(
      `INSERT INTO app_settings (key, value) VALUES ('note_tracking_enabled', 'false')
       ON CONFLICT(key) DO UPDATE SET value = 'false'`
    );

    logger.info(`✅ Demo data seeded successfully — cash collected ~₹${totalCashCollected}, expense budget ~₹${expenseBudget}.`);
  } catch (err) {
    logger.error('Demo seed failed: ' + err.message);
  }
}

module.exports = { seedDemoData };