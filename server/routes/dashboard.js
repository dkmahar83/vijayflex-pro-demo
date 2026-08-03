const express = require('express');
const router = express.Router();
const db = require('../db/database');
const util = require('util');

const dbAllAsync = util.promisify(db.all).bind(db);
const dbGetAsync = util.promisify(db.get).bind(db);
const logger = require('../utils/logger');

function todayIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}

// ── Timestamp normalizers for Recent Activity ──
// Confirmed by reading the actual INSERTs: orders/payments/cash_income/
// upi_transactions all pass an explicit IST-local "YYYY-MM-DD HH:MM:SS"
// string (their own nowIST() helper). order_activity_log and inventory_log
// don't pass created_at at all, so they fall back to the column's
// `DEFAULT CURRENT_TIMESTAMP`, which SQLite always returns in UTC. Mixing
// these without correction would make some activity look ~5.5h off, so
// each source is converted to a real ISO instant before sorting.
function istToISO(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).replace(' ', 'T') + '+05:30');
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function utcToISO(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// table_name (as stored by inventory.js's logChange) → human category label,
// same mapping getLowStockAlerts() above already uses.
const INVENTORY_CATEGORY_LABELS = {
  inventory_flex: 'Flex Roll',
  inventory_frames: 'Photo Frame',
  inventory_stamps: 'Stamp',
  inventory_chemicals: 'Chemical',
  inventory_ink: 'Ink/Solvent',
  inventory_dynamic_items: 'Inventory Item',
};

// ── Low stock / out of stock across ALL inventory types ──
// Thresholds match exactly what Inventory.jsx already shows, taaki dono jagah same data dikhe.
async function getLowStockAlerts() {
  const [flexLow, framesLow, stampsOut, chemLow, inkLow, dynLow] = await Promise.all([
    dbAllAsync(`SELECT brand, size_ft, quantity FROM inventory_flex WHERE quantity <= 1`),
    dbAllAsync(`SELECT frame_type, size, design, quantity FROM inventory_frames WHERE quantity < 5`),
    dbAllAsync(`SELECT stamp_type, size, quantity FROM inventory_stamps WHERE quantity = 0`),
    dbAllAsync(`SELECT chemical_name, quantity, unit, minimum_stock FROM inventory_chemicals WHERE quantity = 0 OR (minimum_stock > 0 AND quantity <= minimum_stock)`),
    dbAllAsync(`SELECT item_name, item_type, quantity, unit, minimum_level FROM inventory_ink WHERE quantity = 0 OR (minimum_level > 0 AND quantity <= minimum_level)`),
    dbAllAsync(`
      SELECT d.item_name, d.attr1, d.attr2, d.quantity, d.unit, c.label as category_label
      FROM inventory_dynamic_items d
      JOIN inventory_categories c ON d.category_id = c.id
      WHERE d.quantity = 0 OR (d.minimum_stock > 0 AND d.quantity <= d.minimum_stock)
    `)
  ]);

  const alerts = [
    ...flexLow.map(f => ({
      category: 'Flex Roll', item_name: `${f.brand} ${f.size_ft}ft`,
      quantity: f.quantity, unit: 'roll', status: f.quantity === 0 ? 'out' : 'low'
    })),
    ...framesLow.map(f => ({
      category: 'Photo Frame',
      item_name: `${f.frame_type}${f.size ? ' ' + f.size : ''}${f.design ? ' ' + f.design : ''}`,
      quantity: f.quantity, unit: 'pcs', status: f.quantity === 0 ? 'out' : 'low'
    })),
    ...stampsOut.map(s => ({
      category: 'Stamp', item_name: `${s.stamp_type}${s.size ? ' ' + s.size : ''}`,
      quantity: s.quantity, unit: 'pcs', status: 'out'
    })),
    ...chemLow.map(c => ({
      category: 'Chemical', item_name: c.chemical_name,
      quantity: c.quantity, unit: c.unit, status: c.quantity === 0 ? 'out' : 'low'
    })),
    ...inkLow.map(i => ({
      category: i.item_type === 'solvent' ? 'Solvent' : 'Ink', item_name: i.item_name,
      quantity: i.quantity, unit: i.unit, status: i.quantity === 0 ? 'out' : 'low'
    })),
    ...dynLow.map(d => ({
      category: d.category_label,
      item_name: `${d.item_name}${d.attr1 ? ' ' + d.attr1 : ''}${d.attr2 ? ' ' + d.attr2 : ''}`,
      quantity: d.quantity, unit: d.unit, status: d.quantity === 0 ? 'out' : 'low'
    })),
  ];

  // Out of stock pehle dikhao, phir low stock
  alerts.sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1));
  return alerts;
}

router.get('/', async (req, res) => {
  const today = todayIST();

  try {
    // 1. Pending orders count (not deleted)
    const pending = await dbGetAsync(`
      SELECT COUNT(*) as count FROM orders
      WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL
    `);

    // 2. Total outstanding — ab TRUE net-due formula (customers.js ke totalDue
    // jaisa hi: orders + opening_balance − advance − order-payments − UPI −
    // cleared-cheques − cash-income − discount + commission). Pehle sirf raw
    // balance_due + opening_balance sum hota tha, jo customers ke cash/UPI/
    // cheque/commission-wapasi jaisi payments ko ignore kar deta tha — isliye
    // credit-mein-chale-gaye customers (jaise Vijay Flex) bhi "due" mein
    // count ho jaate the, jabki unka asal balance negative tha.
    const totalDue = await dbGetAsync(`
      WITH customer_net_due AS (
        SELECT
          c.id as customer_id,
          (
            COALESCE(oa.orders_total, 0) + COALESCE(c.opening_balance, 0)
            - COALESCE(oa.orders_advance, 0)
            - COALESCE(pay.total_order_payments, 0)
            - COALESCE(upi.total_upi, 0)
            - COALESCE(cheq.total_cheque_cleared, 0)
            - COALESCE(cash.total_cash_income, 0)
            - COALESCE(oa.orders_discount, 0)
            + COALESCE(comm.total_commission, 0)
          ) as total_due
        FROM customers c
        LEFT JOIN (
          SELECT customer_id,
            SUM(total_amount) as orders_total,
            SUM(discount_amount) as orders_discount,
            SUM(advance_paid) as orders_advance
          FROM orders WHERE deleted_at IS NULL GROUP BY customer_id
        ) oa ON oa.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_order_payments FROM payments GROUP BY customer_id
        ) pay ON pay.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_upi FROM upi_transactions
          WHERE order_id IS NULL AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
          GROUP BY customer_id
        ) upi ON upi.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_cheque_cleared FROM cheques WHERE status = 'cleared' GROUP BY customer_id
        ) cheq ON cheq.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_cash_income FROM cash_income
          WHERE (notes IS NULL OR notes NOT IN ('Order Advance Payment', 'Order Payment'))
            AND (notes IS NULL OR notes NOT LIKE 'Cheque Cleared%')
            AND (notes IS NULL OR notes NOT LIKE 'Galla Opening Balance%')
          GROUP BY customer_id
        ) cash ON cash.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_commission FROM expenses WHERE category = 'Commission' GROUP BY customer_id
        ) comm ON comm.customer_id = c.id
        WHERE c.deleted_at IS NULL
      )
      SELECT COALESCE(SUM(total_due), 0) as total FROM customer_net_due WHERE total_due > 0
    `);

    // 3. Due reminders — today and overdue (not deleted)
    const reminders = await dbAllAsync(`
      SELECT orders.id as order_id, orders.description,
        orders.balance_due, orders.follow_up_date,
        customers.firm_name, customers.phone
      FROM orders
      JOIN customers ON orders.customer_id = customers.id
      WHERE orders.balance_due > 0
        AND orders.follow_up_date <= ?
        AND orders.deleted_at IS NULL
      ORDER BY orders.follow_up_date ASC
    `, [today]);

    // 4. Today's orders (not deleted)
    const todayOrders = await dbAllAsync(`
      SELECT orders.*, customers.firm_name, customers.phone
      FROM orders
      JOIN customers ON orders.customer_id = customers.id
      WHERE DATE(orders.created_at) = ?
        AND orders.deleted_at IS NULL
      ORDER BY orders.created_at DESC
    `, [today]);

    // 5. ALL due payments — CUSTOMER-WISE, ab TRUE net-due formula (customers.js
    // jaisa hi). orders_due yahan sirf INFORMATIONAL hai (raw order-balance,
    // display ke liye "X orders pending" jaisa), lekin total_due (jo asal
    // sorting/filtering karta hai) ab poora account leta hai — order-payments,
    // UPI, cleared-cheques, cash-income, commission, discount sab. Isliye ab
    // koi bhi customer jiska net-balance actually credit (negative) hai, is
    // list mein kabhi nahi aayega — chahe uska koi order-level balance_due ho.
    const allDues = await dbAllAsync(`
      SELECT * FROM (
        SELECT
          c.id as customer_id,
          c.firm_name,
          c.phone,
          COALESCE(oa.orders_due, 0) as orders_due,
          COALESCE(oa.orders_due_count, 0) as orders_due_count,
          COALESCE(c.opening_balance, 0) as opening_balance,
          oa.follow_up_date as follow_up_date,
          (
            COALESCE(oa.orders_total, 0) + COALESCE(c.opening_balance, 0)
            - COALESCE(oa.orders_advance, 0)
            - COALESCE(pay.total_order_payments, 0)
            - COALESCE(upi.total_upi, 0)
            - COALESCE(cheq.total_cheque_cleared, 0)
            - COALESCE(cash.total_cash_income, 0)
            - COALESCE(oa.orders_discount, 0)
            + COALESCE(comm.total_commission, 0)
          ) as total_due
        FROM customers c
        LEFT JOIN (
          SELECT customer_id,
            SUM(total_amount) as orders_total,
            SUM(discount_amount) as orders_discount,
            SUM(advance_paid) as orders_advance,
            SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE 0 END) as orders_due,
            SUM(CASE WHEN balance_due > 0 THEN 1 ELSE 0 END) as orders_due_count,
            MIN(CASE WHEN balance_due > 0 THEN follow_up_date END) as follow_up_date
          FROM orders WHERE deleted_at IS NULL GROUP BY customer_id
        ) oa ON oa.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_order_payments FROM payments GROUP BY customer_id
        ) pay ON pay.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_upi FROM upi_transactions
          WHERE order_id IS NULL AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
          GROUP BY customer_id
        ) upi ON upi.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_cheque_cleared FROM cheques WHERE status = 'cleared' GROUP BY customer_id
        ) cheq ON cheq.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_cash_income FROM cash_income
          WHERE (notes IS NULL OR notes NOT IN ('Order Advance Payment', 'Order Payment'))
            AND (notes IS NULL OR notes NOT LIKE 'Cheque Cleared%')
            AND (notes IS NULL OR notes NOT LIKE 'Galla Opening Balance%')
          GROUP BY customer_id
        ) cash ON cash.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total_commission FROM expenses WHERE category = 'Commission' GROUP BY customer_id
        ) comm ON comm.customer_id = c.id
        WHERE c.deleted_at IS NULL
      )
      WHERE total_due > 0
      ORDER BY follow_up_date ASC, total_due DESC
    `);

    // 6. Low stock alerts — saari inventory tables se combined
    let lowStockAlerts = [];
    try {
      lowStockAlerts = await getLowStockAlerts();
    } catch (lowStockErr) {
      logger.error('Low stock fetch failed: ' + lowStockErr.message);
    }

    // 7. Recent activity — dashboard ke "Recent Activity" timeline ke liye.
    // Har event bilkul EK jagah se aata hai (koi table do baar scan nahi hoti)
    // taaki ek hi real payment do activity-cards ban kar na dikhe:
    //   • UPI order-payments already `payments` table mein hain (payments.js
    //     inhe upi_transactions mein bhi mirror karta hai) — isliye
    //     upi_transactions se sirf order_id IS NULL (standalone) rows lete hain,
    //     order-linked UPI advance yahin se already payments/advance query mein aa jaati hai.
    //   • Cheque "received" ka koi created_at nahi hai (sirf date), isliye
    //     "cheque cleared" ka event cash_income se liya (jahan cheques.js
    //     already ek 'Cheque Cleared...' row banata hai, real timestamp ke saath).
    //   • Commission aur baaki expenses dono `expenses` table se hain, sirf
    //     category = 'Commission' se alag kiye — dono ke liye alag query nahi
    //     chahiye thi, ek hi query se split kar diya.
    //
    // ?activityLimit=20|50 — "Load more" button ke liye. Har source ko itni
    // hi rows fetch karte hain jitni final list mein chahiye ho sakti hain,
    // taaki agar sab recent activity ek hi type ki ho to bhi list poori bhare.
    let activityLimit = parseInt(req.query.activityLimit, 10);
    if (![20, 50].includes(activityLimit)) activityLimit = 20;

    let recentActivity = [];
    try {
      const [
        recentOrders, recentPayments, advancesCash, advancesUpi,
        collectionsCash, collectionsUpi, chequesCleared, whatsappSends,
        inventoryChanges, expensePayouts
      ] = await Promise.all([
        // Naya order banaya
        dbAllAsync(`
          SELECT orders.id, orders.description, orders.total_amount, orders.order_number,
            orders.created_at, customers.firm_name
          FROM orders
          JOIN customers ON orders.customer_id = customers.id AND customers.deleted_at IS NULL
          WHERE orders.deleted_at IS NULL
          ORDER BY orders.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Order ke against payment mila (cash/UPI/bank — sab payments table mein)
        dbAllAsync(`
          SELECT payments.id, payments.amount, payments.payment_mode, payments.note,
            payments.created_at, orders.order_number, customers.firm_name
          FROM payments
          JOIN customers ON payments.customer_id = customers.id AND customers.deleted_at IS NULL
          LEFT JOIN orders ON payments.order_id = orders.id
          ORDER BY payments.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Order banate waqt cash advance
        dbAllAsync(`
          SELECT cash_income.id, cash_income.amount, cash_income.created_at, customers.firm_name
          FROM cash_income
          JOIN customers ON cash_income.customer_id = customers.id AND customers.deleted_at IS NULL
          WHERE cash_income.notes = 'Order Advance Payment'
          ORDER BY cash_income.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Order banate waqt UPI advance
        dbAllAsync(`
          SELECT upi_transactions.id, upi_transactions.amount, upi_transactions.created_at,
            orders.order_number, COALESCE(customers.firm_name, upi_transactions.customer_name) as firm_name
          FROM upi_transactions
          LEFT JOIN customers ON upi_transactions.customer_id = customers.id AND customers.deleted_at IS NULL
          LEFT JOIN orders ON upi_transactions.order_id = orders.id
          WHERE upi_transactions.notes = 'Order Advance Payment'
          ORDER BY upi_transactions.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Standalone cash collection (kisi order se seedha linked nahi)
        dbAllAsync(`
          SELECT cash_income.id, cash_income.amount, cash_income.notes, cash_income.created_at, customers.firm_name
          FROM cash_income
          JOIN customers ON cash_income.customer_id = customers.id AND customers.deleted_at IS NULL
          WHERE (cash_income.notes IS NULL OR cash_income.notes NOT IN ('Order Advance Payment', 'Order Payment'))
            AND (cash_income.notes IS NULL OR cash_income.notes NOT LIKE 'Cheque Cleared%')
            AND (cash_income.notes IS NULL OR cash_income.notes NOT LIKE 'Galla Opening Balance%')
          ORDER BY cash_income.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Standalone UPI collection (QR collect, kisi order se linked nahi)
        dbAllAsync(`
          SELECT upi_transactions.id, upi_transactions.amount, upi_transactions.upi_account,
            upi_transactions.created_at, COALESCE(customers.firm_name, upi_transactions.customer_name) as firm_name
          FROM upi_transactions
          LEFT JOIN customers ON upi_transactions.customer_id = customers.id AND customers.deleted_at IS NULL
          WHERE upi_transactions.order_id IS NULL
            AND (upi_transactions.notes NOT LIKE 'EXPENSE:%' OR upi_transactions.notes IS NULL)
          ORDER BY upi_transactions.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Cheque clear hua
        dbAllAsync(`
          SELECT cash_income.id, cash_income.amount, cash_income.notes, cash_income.created_at, customers.firm_name
          FROM cash_income
          JOIN customers ON cash_income.customer_id = customers.id AND customers.deleted_at IS NULL
          WHERE cash_income.notes LIKE 'Cheque Cleared%'
          ORDER BY cash_income.created_at DESC LIMIT ?
        `, [activityLimit]),
        // WhatsApp par bill / payment-request bheja
        dbAllAsync(`
          SELECT order_activity_log.id, order_activity_log.activity, order_activity_log.created_at,
            orders.order_number, customers.firm_name
          FROM order_activity_log
          JOIN orders ON order_activity_log.order_id = orders.id
          JOIN customers ON orders.customer_id = customers.id AND customers.deleted_at IS NULL
          ORDER BY order_activity_log.created_at DESC LIMIT ?
        `, [activityLimit]),
        // Inventory restock / use / manual adjust
        dbAllAsync(`
          SELECT id, table_name, item_name, action, quantity_changed, quantity_after, created_at
          FROM inventory_log
          ORDER BY created_at DESC LIMIT ?
        `, [activityLimit]),
        // Commission + baaki business expenses (dono expenses table se; same
        // vendor/employee join jo expenses.js already use karta hai)
        dbAllAsync(`
          SELECT expenses.id, expenses.category, expenses.amount, expenses.description,
            expenses.customer_name, expenses.created_at,
            CASE
              WHEN expenses.paid_to_type = 'vendor' THEN vendors.name
              WHEN expenses.paid_to_type = 'employee' THEN employees.name
              ELSE NULL
            END as paid_to_name
          FROM expenses
          LEFT JOIN vendors ON expenses.paid_to_type = 'vendor' AND expenses.paid_to_id = vendors.id
          LEFT JOIN employees ON expenses.paid_to_type = 'employee' AND expenses.paid_to_id = employees.id
          ORDER BY expenses.created_at DESC LIMIT ?
        `, [activityLimit]),
      ]);

      const items = [];

      recentOrders.forEach(o => items.push({
        type: 'order',
        title: `New order — ${o.firm_name}`,
        subtitle: o.description || 'No description',
        order_number: o.order_number || null,
        amount: o.total_amount,
        created_at: istToISO(o.created_at),
      }));

      recentPayments.forEach(p => items.push({
        type: 'payment',
        title: `Payment received — ${p.firm_name}`,
        subtitle: `via ${p.payment_mode || 'cash'}${p.note ? ' · ' + p.note : ''}`,
        order_number: p.order_number || null,
        amount: p.amount,
        created_at: istToISO(p.created_at),
      }));

      advancesCash.forEach(a => items.push({
        type: 'advance',
        title: `Advance received — ${a.firm_name}`,
        subtitle: 'via cash',
        order_number: null,
        amount: a.amount,
        created_at: istToISO(a.created_at),
      }));

      advancesUpi.forEach(a => items.push({
        type: 'advance',
        title: `Advance received — ${a.firm_name || 'Customer'}`,
        subtitle: 'via UPI',
        order_number: a.order_number || null,
        amount: a.amount,
        created_at: istToISO(a.created_at),
      }));

      collectionsCash.forEach(c => items.push({
        type: 'collection',
        title: `Cash collected — ${c.firm_name}`,
        subtitle: c.notes || 'Cash income',
        order_number: null,
        amount: c.amount,
        created_at: istToISO(c.created_at),
      }));

      collectionsUpi.forEach(c => items.push({
        type: 'collection',
        title: `UPI collected — ${c.firm_name || 'Customer'}`,
        subtitle: c.upi_account ? `via ${c.upi_account}` : 'UPI collection',
        order_number: null,
        amount: c.amount,
        created_at: istToISO(c.created_at),
      }));

      chequesCleared.forEach(c => items.push({
        type: 'cheque',
        title: `Cheque cleared — ${c.firm_name}`,
        subtitle: c.notes,
        order_number: null,
        amount: c.amount,
        created_at: istToISO(c.created_at),
      }));

      whatsappSends.forEach(w => items.push({
        type: 'whatsapp',
        title: `Sent on WhatsApp — ${w.firm_name}`,
        subtitle: w.activity,
        order_number: w.order_number || null,
        amount: null,
        created_at: utcToISO(w.created_at),
      }));

      inventoryChanges.forEach(i => {
        const label = INVENTORY_CATEGORY_LABELS[i.table_name] || i.table_name;
        const verb = i.action === 'add' ? 'Restocked' : i.action === 'use' ? 'Used' : 'Stock adjusted';
        const delta = i.action === 'add' ? `+${i.quantity_changed}`
          : i.action === 'use' ? `-${i.quantity_changed}`
          : `${i.quantity_changed > 0 ? '+' : ''}${i.quantity_changed}`;
        items.push({
          type: 'inventory',
          title: `${verb} — ${i.item_name}`,
          subtitle: `${label} · ${delta} (now ${i.quantity_after})`,
          order_number: null,
          amount: null,
          created_at: utcToISO(i.created_at),
        });
      });

      expensePayouts.forEach(e => {
        const isCommission = e.category === 'Commission';
        items.push({
          type: isCommission ? 'commission' : 'expense',
          title: isCommission
            ? `Commission paid — ${e.customer_name || 'Customer'}`
            : `Expense — ${e.category}`,
          subtitle: e.paid_to_name || e.description || (isCommission ? 'Commission payout' : 'Business expense'),
          order_number: null,
          amount: e.amount,
          created_at: istToISO(e.created_at),
        });
      });

      recentActivity = items
        .filter(i => i.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, activityLimit);
    } catch (activityErr) {
      logger.error('Recent activity fetch failed: ' + activityErr.message);
    }

    res.json({
      date: today,
      pending_orders: pending.count,
      total_outstanding: totalDue.total,
      due_reminders: reminders,
      today_orders_list: todayOrders,
      all_dues: allDues,
      low_stock_alerts: lowStockAlerts,
      recent_activity: recentActivity,
      recent_activity_limit: activityLimit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;