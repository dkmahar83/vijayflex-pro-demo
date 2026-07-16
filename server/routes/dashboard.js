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

    res.json({
      date: today,
      pending_orders: pending.count,
      total_outstanding: totalDue.total,
      due_reminders: reminders,
      today_orders_list: todayOrders,
      all_dues: allDues,
      low_stock_alerts: lowStockAlerts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;