const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { recalculateOrderBalance } = require('../utils/orderBalance');

// GET /api/daily?month=06&year=2026
router.get('/', (req, res) => {
  const { month, year } = req.query;
  let query = `SELECT * FROM daily_records ORDER BY record_date DESC`;
  let params = [];
  if (month && year) {
    query = `
      SELECT * FROM daily_records
      WHERE strftime('%m', record_date) = ?
      AND strftime('%Y', record_date) = ?
      ORDER BY record_date DESC
    `;
    params = [month, year];
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/daily/today
router.get('/today', (req, res) => {
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];

  db.get(`SELECT * FROM daily_records WHERE record_date = ?`, [today], (err, record) => {
    if (err) return res.status(500).json({ error: err.message });

    // Step 1: Follow-up payments from payments table (non-advance)
    db.all(`
      SELECT payments.amount, payments.payment_mode, payments.created_at,
             orders.description, customers.firm_name
      FROM payments
      JOIN orders ON payments.order_id = orders.id
      JOIN customers ON payments.customer_id = customers.id
      WHERE payments.payment_date = ?
    `, [today], (err, followupPayments) => {
      if (err) return res.status(500).json({ error: err.message });

      // Step 2: Advance payments via UPI (from upi_transactions, order-linked)
      db.all(`
        SELECT upi_transactions.amount, upi_transactions.upi_account as payment_mode,
               upi_transactions.created_at,
               COALESCE(customers.firm_name, upi_transactions.customer_name) as firm_name,
               'Advance' as description
        FROM upi_transactions
        LEFT JOIN customers ON upi_transactions.customer_id = customers.id
        WHERE upi_transactions.transaction_date = ?
          AND upi_transactions.order_id IS NOT NULL
          AND upi_transactions.notes = 'Order Advance Payment'
      `, [today], (err, advanceUpi) => {
        if (err) return res.status(500).json({ error: err.message });

        // Step 3: Advance payments via Cash (from cash_income, order-linked)
        db.all(`
          SELECT cash_income.amount, 'cash' as payment_mode, cash_income.created_at,
                 customers.firm_name, 'Advance' as description
          FROM cash_income
          LEFT JOIN customers ON cash_income.customer_id = customers.id
          WHERE cash_income.income_date = ?
            AND cash_income.notes = 'Order Advance Payment'
        `, [today], (err, advanceCash) => {
          if (err) return res.status(500).json({ error: err.message });

          // All order payments = follow-up + advances
          const orderPayments = [...followupPayments, ...advanceUpi, ...advanceCash];
          const orderPaymentsTotal = orderPayments.reduce((s, p) => s + p.amount, 0);

          // Step 4: Non-order UPI — upi_transactions (standalone entries) UNION
          // cash_income (payment_mode='upi' entries) — jaisa /report, /summary mein
          // hota hai. Pehle ye sirf upi_transactions padhta tha, aur "accidentally"
          // kaam karta tha kyunki mirror-row waha bhi ban jaati thi — ab wo mirror
          // hata di gayi hai, isliye ye union zaroori hai warna UPI-mode Cash Income
          // entries "UPI Today" se gayab ho jaayengi.
          db.all(`
            SELECT upi_account, SUM(amount) as total, COUNT(*) as count
            FROM (
              SELECT upi_account, amount FROM upi_transactions
              WHERE transaction_date = ?
                AND order_id IS NULL
                AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
              UNION ALL
              SELECT upi_account, amount FROM cash_income
              WHERE income_date = ?
                AND payment_mode = 'upi'
                AND upi_account IS NOT NULL
                AND (notes NOT IN ('Order Advance Payment', 'Order Payment', 'Galla Opening Balance') OR notes IS NULL)
            )
            GROUP BY upi_account
          `, [today, today], (err, upiToday) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT id, upi_account, customer_name, customer_id, amount, transaction_date, utr_number, notes, created_at, customer_firm
              FROM (
                SELECT upi_transactions.id, upi_transactions.upi_account, upi_transactions.customer_name,
                       upi_transactions.customer_id, upi_transactions.amount, upi_transactions.transaction_date,
                       upi_transactions.utr_number, upi_transactions.notes, upi_transactions.created_at,
                       customers.firm_name as customer_firm
                FROM upi_transactions
                LEFT JOIN customers ON upi_transactions.customer_id = customers.id
                WHERE upi_transactions.transaction_date = ?
                  AND upi_transactions.order_id IS NULL
                  AND (upi_transactions.notes NOT LIKE 'EXPENSE:%' OR upi_transactions.notes IS NULL)
                UNION ALL
                SELECT cash_income.id, cash_income.upi_account, customers.firm_name as customer_name,
                       cash_income.customer_id, cash_income.amount, cash_income.income_date as transaction_date,
                       NULL as utr_number, cash_income.notes, cash_income.created_at,
                       customers.firm_name as customer_firm
                FROM cash_income
                LEFT JOIN customers ON cash_income.customer_id = customers.id
                WHERE cash_income.income_date = ?
                  AND cash_income.payment_mode = 'upi'
                  AND cash_income.upi_account IS NOT NULL
                  AND (cash_income.notes NOT IN ('Order Advance Payment', 'Order Payment', 'Galla Opening Balance') OR cash_income.notes IS NULL)
              )
              ORDER BY created_at DESC
            `, [today, today], (err, upiDetail) => {
              if (err) return res.status(500).json({ error: err.message });

              db.all(`
                SELECT cheques.*, customers.firm_name as customer_firm
                FROM cheques
                LEFT JOIN customers ON cheques.customer_id = customers.id
                WHERE received_date = ?
              `, [today], (err, chequesToday) => {
                if (err) return res.status(500).json({ error: err.message });

                // Non-order cash income (manually recorded, not order-related) —
                // UPI-mode entries exclude, wo alag se upiToday/upiDetail mein aati hain
                db.all(`
                  SELECT cash_income.*, customers.firm_name
                  FROM cash_income
                  LEFT JOIN customers ON cash_income.customer_id = customers.id
                  WHERE income_date = ?
                    AND (cash_income.notes NOT IN ('Order Advance Payment', 'Order Payment', 'Galla Opening Balance') OR cash_income.notes IS NULL)
                    AND (cash_income.payment_mode != 'upi' OR cash_income.payment_mode IS NULL)
                  ORDER BY id DESC
                `, [today], (err, cashIncomeToday) => {
                  if (err) return res.status(500).json({ error: err.message });

                  db.get(`
                    SELECT COALESCE(SUM(amount), 0) as total FROM expenses
                    WHERE expense_date = ? AND category != 'Ghar Khata'
                  `, [today], (err, todayExpenses) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const cashIncomeTotal = cashIncomeToday.reduce((s, c) => s + c.amount, 0);
                    const upiTotal        = upiToday.reduce((s, u) => s + u.total, 0);
                    const chequeTotal     = chequesToday.reduce((s, c) => s + c.amount, 0);
                    const manualSales     = record ? record.total_sales : 0;
                    const totalCashIn     = orderPaymentsTotal + cashIncomeTotal + upiTotal;

                    res.json({
                      record_date:          today,
                      manual_sales:         manualSales,
                      total_expenses:       todayExpenses.total || 0,
                      order_payments:       orderPayments,
                      order_payments_total: orderPaymentsTotal,
                      payments_total:       orderPaymentsTotal,
                      payments_received:    orderPayments, // full list with created_at for time display
                      cash_income_today:    cashIncomeToday,
                      cash_income_total:    cashIncomeTotal,
                      upi_by_account:       upiToday,
                      upi_detail:           upiDetail,
                      upi_total:            upiTotal,
                      cheques_today:        chequesToday,
                      cheque_total:         chequeTotal,
                      total_cash_in:        totalCashIn
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/report?month=06&year=2026
router.get('/report', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = month.padStart(2, '0');

  // 1. Order follow-up payments (payments table)
  db.get(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?
  `, [m, year], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // 2. Advance payments via UPI (order-linked upi_transactions)
    db.get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM upi_transactions
      WHERE strftime('%m', transaction_date) = ? AND strftime('%Y', transaction_date) = ?
        AND order_id IS NOT NULL
        AND notes = 'Order Advance Payment'
    `, [m, year], (err, advanceUpi) => {
      if (err) return res.status(500).json({ error: err.message });

      // 3. Advance payments via Cash (order-linked cash_income)
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM cash_income
        WHERE strftime('%m', income_date) = ? AND strftime('%Y', income_date) = ?
          AND notes = 'Order Advance Payment'
      `, [m, year], (err, advanceCash) => {
        if (err) return res.status(500).json({ error: err.message });

        // 4. Cash income ONLY (non-order, payment_mode = cash) — Ghar Khata excluded — includes cleared cheques
        db.get(`
          SELECT COALESCE(SUM(ci.amount), 0) as total
          FROM cash_income ci
          LEFT JOIN customers c ON ci.customer_id = c.id
          WHERE strftime('%m', ci.income_date) = ?
            AND strftime('%Y', ci.income_date) = ?
            AND (ci.payment_mode = 'cash' OR ci.payment_mode IS NULL OR ci.payment_mode = 'cheque')
            AND ci.notes != 'Order Advance Payment'
            AND ci.notes != 'Galla Opening Balance'
            AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
        `, [m, year], (err, cashIncome) => {
          if (err) return res.status(500).json({ error: err.message });

          // 5. UPI income — non-order only (order_id IS NULL) — Ghar Khata excluded
          db.get(`
            SELECT COALESCE(SUM(amount), 0) as total FROM (
              SELECT ut.amount
              FROM upi_transactions ut
              LEFT JOIN customers c ON ut.customer_id = c.id
              WHERE strftime('%m', ut.transaction_date) = ?
                AND strftime('%Y', ut.transaction_date) = ?
                AND (ut.notes NOT LIKE 'EXPENSE:%' OR ut.notes IS NULL)
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
                AND ut.order_id IS NULL
              UNION ALL
              SELECT ci.amount
              FROM cash_income ci
              LEFT JOIN customers c ON ci.customer_id = c.id
              WHERE strftime('%m', ci.income_date) = ?
                AND strftime('%Y', ci.income_date) = ?
                AND ci.payment_mode = 'upi'
                AND ci.notes != 'Order Advance Payment'
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
            )
          `, [m, year, m, year], (err, upiIncome) => {
            if (err) return res.status(500).json({ error: err.message });

            // 6. Expenses by category — Ghar Khata excluded
            db.all(`
              SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
              FROM expenses
              WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
                AND category != 'Ghar Khata'
              GROUP BY category
              ORDER BY total DESC
            `, [m, year], (err, expensesByCategory) => {
              if (err) return res.status(500).json({ error: err.message });

              // 7. Total expenses — Ghar Khata excluded
              db.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM expenses
                WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
                  AND category != 'Ghar Khata'
              `, [m, year], (err, totalExpenses) => {
                if (err) return res.status(500).json({ error: err.message });

                // 8. Dues — CUSTOMER-WISE, TRUE net-due formula (Dashboard jaisa hi:
                // orders + opening_balance - advance - order-payments - UPI -
                // cleared-cheques - cash-income - discount + commission).
                db.all(`
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
                `, [], (err, dues) => {
                  if (err) return res.status(500).json({ error: err.message });

                  // 9. Total outstanding — SUM of same net-due formula, Dashboard jaisa hi
                  // (pehle sirf raw balance_due+opening_balance jodta tha, jo cash/UPI/
                  // cheque/commission payments ignore kar deta tha).
                  db.get(`
                    WITH customer_net_due AS (
                      SELECT
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
                  `, [], (err, totalDues) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const advanceTotal = (advanceUpi.total || 0) + (advanceCash.total || 0);
                    const totalIncome = (orderPayments.total || 0) + advanceTotal + (cashIncome.total || 0) + (upiIncome.total || 0);
                    const totalExp = totalExpenses.total || 0;

                    res.json({
                      month: m, year,
                      income: {
                        order_payments: orderPayments.total || 0,
                        advance_payments: advanceTotal,
                        cash_income: cashIncome.total || 0,
                        upi_income: upiIncome.total || 0,
                        total: totalIncome
                      },
                      expenses: { by_category: expensesByCategory, total: totalExp },
                      net_profit: totalIncome - totalExp,
                      dues: { list: dues, total_outstanding: totalDues.total || 0 }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/report/yearly?year=2026
router.get('/report/yearly', (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'year required' });

  db.all(`
    SELECT strftime('%m', payment_date) as month, COALESCE(SUM(amount), 0) as total
    FROM payments WHERE strftime('%Y', payment_date) = ?
    GROUP BY month
  `, [year], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // Advance UPI yearly
    db.all(`
      SELECT strftime('%m', transaction_date) as month, COALESCE(SUM(amount), 0) as total
      FROM upi_transactions
      WHERE strftime('%Y', transaction_date) = ?
        AND order_id IS NOT NULL AND notes = 'Order Advance Payment'
      GROUP BY month
    `, [year], (err, advanceUpi) => {
      if (err) return res.status(500).json({ error: err.message });

      // Advance Cash yearly
      db.all(`
        SELECT strftime('%m', income_date) as month, COALESCE(SUM(amount), 0) as total
        FROM cash_income
        WHERE strftime('%Y', income_date) = ? AND notes = 'Order Advance Payment'
        GROUP BY month
      `, [year], (err, advanceCash) => {
        if (err) return res.status(500).json({ error: err.message });

        // Cash only (non-order) — Ghar Khata excluded
        db.all(`
          SELECT strftime('%m', ci.income_date) as month, COALESCE(SUM(ci.amount), 0) as total
          FROM cash_income ci
          LEFT JOIN customers c ON ci.customer_id = c.id
          WHERE strftime('%Y', ci.income_date) = ?
            AND (ci.payment_mode = 'cash' OR ci.payment_mode IS NULL)
            AND ci.notes != 'Order Advance Payment'
            AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
          GROUP BY month
        `, [year], (err, cashIncome) => {
          if (err) return res.status(500).json({ error: err.message });

          // UPI non-order — Ghar Khata excluded
          db.all(`
            SELECT month, COALESCE(SUM(amount), 0) as total FROM (
              SELECT strftime('%m', ut.transaction_date) as month, ut.amount
              FROM upi_transactions ut
              LEFT JOIN customers c ON ut.customer_id = c.id
              WHERE strftime('%Y', ut.transaction_date) = ?
                AND (ut.notes NOT LIKE 'EXPENSE:%' OR ut.notes IS NULL)
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
                AND ut.order_id IS NULL
              UNION ALL
              SELECT strftime('%m', ci.income_date) as month, ci.amount
              FROM cash_income ci
              LEFT JOIN customers c ON ci.customer_id = c.id
              WHERE strftime('%Y', ci.income_date) = ?
                AND ci.payment_mode = 'upi'
                AND ci.notes != 'Order Advance Payment'
                AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
            )
            GROUP BY month
          `, [year, year], (err, upiIncome) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT strftime('%m', expense_date) as month, COALESCE(SUM(amount), 0) as total
              FROM expenses
              WHERE strftime('%Y', expense_date) = ? AND category != 'Ghar Khata'
              GROUP BY month
            `, [year], (err, monthlyExpenses) => {
              if (err) return res.status(500).json({ error: err.message });

              const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

              const summary = months.map((m, i) => {
                const orders   = (orderPayments.find(r => r.month === m) || {}).total || 0;
                const advUpi   = (advanceUpi.find(r => r.month === m)   || {}).total || 0;
                const advCash  = (advanceCash.find(r => r.month === m)  || {}).total || 0;
                const cash     = (cashIncome.find(r => r.month === m)   || {}).total || 0;
                const upi      = (upiIncome.find(r => r.month === m)    || {}).total || 0;
                const expenses = (monthlyExpenses.find(r => r.month === m) || {}).total || 0;
                const income   = orders + advUpi + advCash + cash + upi;
                return { month: m, month_name: monthNames[i], income, expenses, net: income - expenses };
              });

              const totalIncome   = summary.reduce((s, r) => s + r.income, 0);
              const totalExpenses = summary.reduce((s, r) => s + r.expenses, 0);

              res.json({
                year,
                monthly_summary: summary,
                total_income: totalIncome,
                total_expenses: totalExpenses,
                net_profit: totalIncome - totalExpenses
              });
            });
          });
        });
      });
    });
  });
});

// POST /api/daily/cash-income
router.post('/cash-income', (req, res) => {
  const { customer_id, amount, income_date, notes, payment_mode, upi_account, denomination_breakdown } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
  if (!amount || isNaN(amount) || parseInt(Number(amount), 10) <= 0)
    return res.status(400).json({ error: 'Valid amount is required' });

  const parsedAmount = parseInt(Number(amount), 10);
  const date = income_date || new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Kolkata'}).split(' ')[0];
  const createdAt = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Kolkata'}).replace('T', ' ');

  // Only store denomination breakdown for cash payments, and only if it has actual counts
  const breakdownToSave = (payment_mode !== 'upi' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
    ? JSON.stringify(denomination_breakdown)
    : null;

  db.run(`
    INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, upi_account, created_at, denomination_breakdown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    customer_id, parsedAmount, date, notes || null,
    payment_mode || 'cash',
    payment_mode === 'upi' ? upi_account : null,
    createdAt,
    breakdownToSave
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    // Note: ab yahan upi_transactions mein koi mirror-row nahi banti. upi.js ke
    // GET / aur GET /summary already cash_income (payment_mode='upi') ko union
    // karte hain — mirror banana usi kaam ko dobara karna tha, jo Accounts>UPI
    // tab mein aur reports mein double-counting create kar raha tha.
    res.status(201).json({ id: this.lastID, message: 'Income saved' });
  });
});

// GET /api/daily/summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;

  db.get(`
    SELECT COUNT(*) as days_recorded FROM daily_records
    WHERE strftime('%m', record_date) = ? AND strftime('%Y', record_date) = ?
  `, [month, year], (err, daily) => {
    if (err) return res.status(500).json({ error: err.message });

    // Follow-up payments
    db.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?
    `, [month, year], (err, payments) => {
      if (err) return res.status(500).json({ error: err.message });

      // Advance UPI
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM upi_transactions
        WHERE strftime('%m', transaction_date) = ? AND strftime('%Y', transaction_date) = ?
          AND order_id IS NOT NULL AND notes = 'Order Advance Payment'
      `, [month, year], (err, advanceUpi) => {
        if (err) return res.status(500).json({ error: err.message });

        // Advance Cash
        db.get(`
          SELECT COALESCE(SUM(amount), 0) as total FROM cash_income
          WHERE strftime('%m', income_date) = ? AND strftime('%Y', income_date) = ?
            AND notes = 'Order Advance Payment'
        `, [month, year], (err, advanceCash) => {
          if (err) return res.status(500).json({ error: err.message });

          // Non-order cash — Ghar Khata excluded — includes cleared cheques
          db.get(`
            SELECT COALESCE(SUM(ci.amount), 0) as total
            FROM cash_income ci
            LEFT JOIN customers c ON ci.customer_id = c.id
            WHERE strftime('%m', ci.income_date) = ? AND strftime('%Y', ci.income_date) = ?
              AND (ci.payment_mode = 'cash' OR ci.payment_mode IS NULL OR ci.payment_mode = 'cheque')
              AND ci.notes != 'Order Advance Payment'
              AND ci.notes != 'Galla Opening Balance'
              AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
          `, [month, year], (err, cashIncome) => {            
            if (err) return res.status(500).json({ error: err.message });

            // Non-order UPI — Ghar Khata excluded
            db.get(`
              SELECT COALESCE(SUM(amount), 0) as total FROM (
                SELECT ut.amount
                FROM upi_transactions ut
                LEFT JOIN customers c ON ut.customer_id = c.id
                WHERE strftime('%m', ut.transaction_date) = ? AND strftime('%Y', ut.transaction_date) = ?
                  AND (ut.notes NOT LIKE 'EXPENSE:%' OR ut.notes IS NULL)
                  AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
                  AND ut.order_id IS NULL
                UNION ALL
                SELECT ci.amount
                FROM cash_income ci
                LEFT JOIN customers c ON ci.customer_id = c.id
                WHERE strftime('%m', ci.income_date) = ? AND strftime('%Y', ci.income_date) = ?
                  AND ci.payment_mode = 'upi'
                  AND ci.notes != 'Order Advance Payment'
                  AND (c.firm_name != 'Ghar Khata' OR c.id IS NULL)
              )
            `, [month, year, month, year], (err, upiIncome) => {
              if (err) return res.status(500).json({ error: err.message });

              db.get(`
                SELECT COALESCE(SUM(amount), 0) as total FROM expenses
                WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
                  AND category != 'Ghar Khata'
              `, [month, year], (err, expenses) => {
                if (err) return res.status(500).json({ error: err.message });

                const paymentsTotal = (payments.total || 0) + (advanceUpi.total || 0) + (advanceCash.total || 0);
                const cashTotal     = cashIncome.total || 0;
                const upiTotal      = upiIncome.total  || 0;
                const totalSales    = paymentsTotal + cashTotal + upiTotal;
                const totalExpenses = expenses.total || 0;

                res.json({
                  days_recorded:     daily.days_recorded || 0,
                  payments_total:    paymentsTotal,
                  cash_income_total: cashTotal,
                  upi_income_total:  upiTotal,
                  total_sales:       totalSales,
                  total_expenses:    totalExpenses,
                  net_profit:        totalSales - totalExpenses
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/ledger/date?date=2026-06-15
router.get('/ledger/date', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  // Follow-up order payments
  db.all(`
    SELECT payments.id, payments.amount,
      CASE
        WHEN payments.payment_mode = 'upi' AND payments.upi_account IS NOT NULL
        THEN payments.upi_account
        ELSE payments.payment_mode
      END as payment_mode,
      payments.created_at,
      customers.firm_name as party_name, 'Order Payment' as type,
    0 as is_advance
    FROM payments
    JOIN orders ON payments.order_id = orders.id
    JOIN customers ON payments.customer_id = customers.id
    WHERE payments.payment_date = ?
  `, [date], (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    // Advance UPI payments
    db.all(`
      SELECT upi_transactions.id, upi_transactions.amount, upi_transactions.upi_account as payment_mode,
        upi_transactions.created_at,
        COALESCE(customers.firm_name, upi_transactions.customer_name) as party_name,
        'Order Payment' as type, 1 as is_advance
      FROM upi_transactions
      LEFT JOIN customers ON upi_transactions.customer_id = customers.id
      WHERE upi_transactions.transaction_date = ?
        AND upi_transactions.order_id IS NOT NULL
        AND upi_transactions.notes = 'Order Advance Payment'
    `, [date], (err, advanceUpiPayments) => {
      if (err) return res.status(500).json({ error: err.message });

      // Advance Cash payments
      db.all(`
        SELECT cash_income.id, cash_income.amount, 'cash' as payment_mode, cash_income.created_at,
          customers.firm_name as party_name, 'Order Payment' as type, 1 as is_advance
        FROM cash_income
        LEFT JOIN customers ON cash_income.customer_id = customers.id
        WHERE cash_income.income_date = ?
          AND cash_income.notes = 'Order Advance Payment'
      `, [date], (err, advanceCashPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        // Non-order cash income
        db.all(`
          SELECT cash_income.id, cash_income.amount, cash_income.payment_mode,
            cash_income.upi_account, cash_income.created_at,
            cash_income.notes,
            customers.firm_name as party_name,
            'Cash Income' as type
          FROM cash_income
          LEFT JOIN customers ON cash_income.customer_id = customers.id
          WHERE cash_income.income_date = ?
            AND (cash_income.notes NOT IN ('Order Advance Payment', 'Order Payment', 'Galla Opening Balance') OR cash_income.notes IS NULL)
            AND (cash_income.payment_mode != 'upi' OR cash_income.payment_mode IS NULL)
        `, [date], (err, cashIncome) => {
          if (err) return res.status(500).json({ error: err.message });

          // Non-order UPI payments (from upi_transactions table)
          db.all(`
            SELECT upi_transactions.id, amount, upi_account as payment_mode,
              COALESCE(customers.firm_name, 'Unknown') as party_name, 'UPI Payment' as type,
              'upi_transactions' as source
            FROM upi_transactions
            LEFT JOIN customers ON upi_transactions.customer_id = customers.id
            WHERE transaction_date = ?
              AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
              AND order_id IS NULL
          `, [date], (err, upiTransactionsPayments) => {
            if (err) return res.status(500).json({ error: err.message });

            // Non-order UPI payments (from cash_income table, payment_mode = upi)
            // Ye wahi entries hain jo "Record Other Payment" form se UPI mode select karke save hui thi
            db.all(`
              SELECT cash_income.id, cash_income.amount, cash_income.upi_account as payment_mode,
                COALESCE(customers.firm_name, 'Unknown') as party_name, 'UPI Payment' as type,
                'cash_income' as source
              FROM cash_income
              LEFT JOIN customers ON cash_income.customer_id = customers.id
              WHERE cash_income.income_date = ?
                AND cash_income.payment_mode = 'upi'
                AND (cash_income.notes NOT IN ('Order Advance Payment', 'Order Payment') OR cash_income.notes IS NULL)
            `, [date], (err, cashIncomeUpiPayments) => {
              if (err) return res.status(500).json({ error: err.message });

              const upiPayments = [...upiTransactionsPayments, ...cashIncomeUpiPayments];

              db.all(`
                  SELECT expenses.id, expenses.amount, expenses.payment_mode, expenses.category,
                    expenses.upi_account,
                    CASE
                      WHEN expenses.category = 'Commission' AND expenses.customer_name IS NOT NULL
                        THEN 'Commission'
                      WHEN paid_to_type = 'employee' THEN employees.name
                      WHEN paid_to_type = 'vendor' THEN vendors.name
                      ELSE expenses.category
                    END as party_name,
                    expenses.description, expenses.created_at,
                    expenses.customer_id, expenses.customer_name
                  FROM expenses
                  LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
                  LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
                  WHERE expense_date = ?
                `, [date], (err, expenses) => {
                if (err) return res.status(500).json({ error: err.message });

                const income = [...orderPayments, ...advanceUpiPayments, ...advanceCashPayments, ...cashIncome, ...upiPayments];
                const totalIncome = income.reduce((s, i) => s + i.amount, 0);
                const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

                res.json({
                  date, income, expenses,
                  total_income: totalIncome,
                  total_expenses: totalExpenses,
                  net: totalIncome - totalExpenses
                });
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/ledger?month=06&year=2026
router.get('/ledger', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const params = [month.padStart(2,'0'), year];

  db.all(`
    SELECT payments.payment_date as date, 'Order Payment' as type,
      customers.firm_name as party_name, payments.payment_mode, payments.amount
    FROM payments
    JOIN orders ON payments.order_id = orders.id
    JOIN customers ON payments.customer_id = customers.id
    WHERE strftime('%m', payments.payment_date) = ? AND strftime('%Y', payments.payment_date) = ?
  `, params, (err, orderPayments) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`
      SELECT cash_income.income_date as date, 'Cash Income' as type,
        customers.firm_name as party_name, cash_income.payment_mode, cash_income.amount
      FROM cash_income
      LEFT JOIN customers ON cash_income.customer_id = customers.id
      WHERE strftime('%m', cash_income.income_date) = ? AND strftime('%Y', cash_income.income_date) = ?
    `, params, (err, cashIncome) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`
        SELECT expense_date as date, 'Expense' as type,
          CASE
            WHEN paid_to_type = 'employee' THEN employees.name
            WHEN paid_to_type = 'vendor' THEN vendors.name
            ELSE category
          END as party_name, payment_mode, -amount as amount
        FROM expenses
        LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
        LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
        WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?
      `, params, (err, expenses) => {
        if (err) return res.status(500).json({ error: err.message });

        const allRows = [...orderPayments, ...cashIncome, ...expenses]
          .sort((a, b) => b.date.localeCompare(a.date));
        res.json(allRows);
      });
    });
  });
});

// GET /api/daily/cash-drawer?date=2026-06-17
router.get('/cash-drawer', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  // Baseline-aware opening balance: sabse recent "Set Galla Count" (jo query-date se
  // strictly PEHLE ki calendar-date pe hui ho) ka total anchor point banta hai, aur sirf
  // uske BAAD ki transactions add/subtract hoti hain — shuru se sab kuch dobara nahi jodte.
  // Koi baseline na mile (bahut purani date, ya kabhi set hi nahi hui) to purana
  // din-1-se-sab-jodo behavior fallback hai.
  db.get(`
    SELECT denomination_counts, date(set_at) as baseline_date
    FROM cash_drawer_baseline
    WHERE date(set_at) < ?
    ORDER BY set_at DESC
    LIMIT 1
  `, [date], (err, baseline) => {
    if (err) return res.status(500).json({ error: err.message });

    let baselineTotal = 0;
    let sinceDate = null;
    if (baseline) {
      try {
        const counts = JSON.parse(baseline.denomination_counts);
        baselineTotal = Object.entries(counts).reduce((s, [d, c]) => s + Number(d) * Number(c), 0);
      } catch (e) { baselineTotal = 0; }
      sinceDate = baseline.baseline_date;
    }

    const openingQuery = sinceDate ? `
      SELECT COALESCE(SUM(cash_in), 0) - COALESCE(SUM(cash_out), 0) as delta
      FROM (
        SELECT amount as cash_in, 0 as cash_out FROM payments
        WHERE payment_mode = 'cash' AND payment_date > ? AND payment_date < ?
        UNION ALL
        SELECT amount as cash_in, 0 as cash_out FROM cash_income
        WHERE (payment_mode = 'cash' OR payment_mode IS NULL) AND income_date > ? AND income_date < ?
          AND (notes IS NULL OR notes != 'Galla Opening Balance')
        UNION ALL
        SELECT 0 as cash_in, amount as cash_out FROM expenses
        WHERE payment_mode = 'cash' AND expense_date > ? AND expense_date < ?
      )
    ` : `
      SELECT COALESCE(SUM(cash_in), 0) - COALESCE(SUM(cash_out), 0) as delta
      FROM (
        SELECT amount as cash_in, 0 as cash_out FROM payments
        WHERE payment_mode = 'cash' AND payment_date < ?
        UNION ALL
        SELECT amount as cash_in, 0 as cash_out FROM cash_income
        WHERE (payment_mode = 'cash' OR payment_mode IS NULL) AND income_date < ?
          AND (notes IS NULL OR notes != 'Galla Opening Balance')
        UNION ALL
        SELECT 0 as cash_in, amount as cash_out FROM expenses
        WHERE payment_mode = 'cash' AND expense_date < ?
      )
    `;

    const openingParams = sinceDate
      ? [sinceDate, date, sinceDate, date, sinceDate, date]
      : [date, date, date];

    db.get(openingQuery, openingParams, (err, deltaRow) => {
      if (err) return res.status(500).json({ error: err.message });
      const openingBalance = baselineTotal + (deltaRow?.delta || 0);

      db.all(`
        SELECT amount, 'Order Payment' as type, customers.firm_name as party_name,
               payment_date as txn_date, payments.created_at, payments.denomination_breakdown
        FROM payments
        JOIN orders ON payments.order_id = orders.id
        JOIN customers ON payments.customer_id = customers.id
        WHERE payments.payment_mode = 'cash' AND payments.payment_date = ?
        UNION ALL
        SELECT cash_income.amount, 'Cash Income' as type, customers.firm_name as party_name,
               income_date as txn_date, cash_income.created_at, cash_income.denomination_breakdown
        FROM cash_income
        LEFT JOIN customers ON cash_income.customer_id = customers.id
        WHERE (cash_income.payment_mode = 'cash' OR cash_income.payment_mode IS NULL)
          AND cash_income.income_date = ?
          AND (cash_income.notes IS NULL OR cash_income.notes != 'Galla Opening Balance')
      `, [date, date], (err, cashInRows) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`
          SELECT expenses.amount, expenses.category,
            CASE
              WHEN paid_to_type = 'employee' THEN employees.name
              WHEN paid_to_type = 'vendor' THEN vendors.name
              ELSE expenses.category
            END as party_name, expenses.description, expense_date as txn_date, expenses.created_at,
            expenses.denomination_breakdown
          FROM expenses
          LEFT JOIN employees ON paid_to_type = 'employee' AND paid_to_id = employees.id
          LEFT JOIN vendors ON paid_to_type = 'vendor' AND paid_to_id = vendors.id
          WHERE expenses.payment_mode = 'cash' AND expenses.expense_date = ?
        `, [date], (err, cashOutRows) => {
          if (err) return res.status(500).json({ error: err.message });

          function parseBreakdown(rows) {
            return rows.map(r => {
              let denomination_breakdown = null;
              if (r.denomination_breakdown) {
                try { denomination_breakdown = JSON.parse(r.denomination_breakdown); }
                catch (e) { denomination_breakdown = null; }
              }
              return { ...r, denomination_breakdown };
            });
          }
          const cashInParsed  = parseBreakdown(cashInRows);
          const cashOutParsed = parseBreakdown(cashOutRows);

          const totalCashIn  = cashInParsed.reduce((s, r) => s + Number(r.amount || 0), 0);
          const totalCashOut = cashOutParsed.reduce((s, r) => s + Number(r.amount || 0), 0);

          res.json({
            date,
            opening_balance: openingBalance,
            cash_in: cashInParsed,
            cash_out: cashOutParsed,
            total_cash_in: totalCashIn,
            total_cash_out: totalCashOut,
            closing_balance: openingBalance + totalCashIn - totalCashOut
          });
        });
      });
    });
  });
});


const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

// GET /api/daily/denomination-drawer — live cumulative drawer count
router.get('/denomination-drawer', (req, res) => {
  db.get(`SELECT * FROM cash_drawer_baseline ORDER BY set_at DESC LIMIT 1`, [], (err, baseline) => {
    if (err) return res.status(500).json({ error: err.message });

    const drawer = {};
    DENOMS.forEach(d => { drawer[d] = 0; });

    if (baseline) {
      try {
        const baseCounts = JSON.parse(baseline.denomination_counts);
        DENOMS.forEach(d => { drawer[d] += Number(baseCounts[d]) || 0; });
      } catch (e) {}
    }

    const baselineAt = baseline ? baseline.set_at : '1970-01-01 00:00:00';
    const baselineDate = baselineAt.split(' ')[0];

    function applyIn(raw) {
      if (!raw) return;
      try {
        const b = JSON.parse(raw);
        DENOMS.forEach(d => {
          drawer[d] += (Number(b.received?.[d]) || 0) - (Number(b.returned?.[d]) || 0);
        });
      } catch (e) {}
    }
    function applyOut(raw) {
      if (!raw) return;
      try {
        const b = JSON.parse(raw);
        DENOMS.forEach(d => {
          drawer[d] -= (Number(b.received?.[d]) || 0) - (Number(b.returned?.[d]) || 0);
        });
      } catch (e) {}
    }

    db.all(`SELECT denomination_breakdown FROM cash_income WHERE created_at > ? AND denomination_breakdown IS NOT NULL`, [baselineAt], (err, ci) => {
      if (err) return res.status(500).json({ error: err.message });
      ci.forEach(r => applyIn(r.denomination_breakdown));

      db.all(`SELECT denomination_breakdown FROM payments WHERE created_at > ? AND denomination_breakdown IS NOT NULL`, [baselineAt], (err, py) => {
        if (err) return res.status(500).json({ error: err.message });
        py.forEach(r => applyIn(r.denomination_breakdown));

        db.all(`SELECT advance_denomination_breakdown FROM orders WHERE created_at > ? AND advance_denomination_breakdown IS NOT NULL`, [baselineAt], (err, ord) => {
          if (err) return res.status(500).json({ error: err.message });
          ord.forEach(r => applyIn(r.advance_denomination_breakdown));

          db.all(`SELECT denomination_breakdown FROM expenses WHERE created_at > ? AND denomination_breakdown IS NOT NULL`, [baselineAt], (err, exp) => {
            if (err) return res.status(500).json({ error: err.message });
            exp.forEach(r => applyOut(r.denomination_breakdown));

            db.all(`SELECT denomination_breakdown FROM employee_salary_credits WHERE credited_date > ? AND denomination_breakdown IS NOT NULL`, [baselineDate], (err, sal) => {
              if (err) return res.status(500).json({ error: err.message });
              sal.forEach(r => applyOut(r.denomination_breakdown));

              const totalValue = DENOMS.reduce((s, d) => s + drawer[d] * d, 0);

              res.json({
                denominations: drawer,
                total_value: totalValue,
                baseline_set_at: baseline ? baseline.set_at : null,
                baseline_notes: baseline ? baseline.notes : null
              });
            });
          });
        });
      });
    });
  });
});

// GET /api/daily/denomination-drawer/history — sab "Set Galla Count" actions, latest sabse upar
router.get('/denomination-drawer/history', (req, res) => {
  db.all(`SELECT id, denomination_counts, set_at, notes FROM cash_drawer_baseline ORDER BY set_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })

    const history = rows.map(r => {
      let total = 0
      try {
        const counts = JSON.parse(r.denomination_counts)
        total = Object.entries(counts).reduce((s, [d, c]) => s + Number(d) * Number(c), 0)
      } catch (e) { /* corrupt row — skip total */ }
      return { id: r.id, set_at: r.set_at, notes: r.notes, total }
    })

    res.json(history)
  })
})

// POST /api/daily/denomination-drawer/set-baseline — galla count reset/set karo
router.post('/denomination-drawer/set-baseline', (req, res) => {
  const { denomination_counts, notes } = req.body;
  if (!denomination_counts) return res.status(400).json({ error: 'denomination_counts required' });

  const setAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

  // Note: ab yahan cash_income mein koi mirror-entry nahi banti. Iski history
  // sirf cash_drawer_baseline table + Galla Hisaab tab ki "Set Karne Ki History"
  // mein rehti hai. Cash Drawer/Daily Ledger ka opening-balance ab is baseline
  // ko seedha /cash-drawer route mein read karke calculate karta hai (neeche) —
  // isliye alag se cash_income row banana double-counting create karta tha.
  db.run(`
    INSERT INTO cash_drawer_baseline (denomination_counts, set_at, notes)
    VALUES (?, ?, ?)
  `, [JSON.stringify(denomination_counts), setAt, notes || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Galla count set ho gaya' });
  });
});

// ─────────────────────────────────────────
// DELETE /api/daily/entry — delete any ledger entry by type+id (password protected)
// ─────────────────────────────────────────
const DELETE_PASSWORD = process.env.DELETE_PASSWORD

router.delete('/entry', (req, res) => {
  const { password, type, id } = req.body

  if (!DELETE_PASSWORD) {
    return res.status(500).json({ error: 'DELETE_PASSWORD server par configure nahi hai. .env check karo.' })
  }
  if (password !== DELETE_PASSWORD) {
    return res.status(403).json({ error: 'Wrong password. Entry delete nahi hui.' })
  }
  if (!type || !id) {
    return res.status(400).json({ error: 'type and id are required' })
  }

  if (type === 'expense') {
    db.run(`DELETE FROM expenses WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message })
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' })
      res.json({ message: 'Expense deleted successfully' })
    })

  } else if (type === 'cash_income') {
    // Also delete linked upi_transaction if payment_mode = upi
    db.get(`SELECT * FROM cash_income WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.status(404).json({ error: 'Entry not found' })

      db.run(`DELETE FROM cash_income WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message })

        // If UPI, also clean up upi_transactions
        if (row.payment_mode === 'upi' && row.upi_account) {
          db.run(
            `DELETE FROM upi_transactions WHERE customer_id = ? AND amount = ? AND transaction_date = ? AND order_id IS NULL LIMIT 1`,
            [row.customer_id, row.amount, row.income_date],
            () => {}
          )
        }
        res.json({ message: 'Income entry deleted successfully' })
      })
    })

  } else if (type === 'upi_income') {
    // Non-order standalone UPI income — id is upi_transactions.id directly
    db.run(`DELETE FROM upi_transactions WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message })
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' })
      res.json({ message: 'UPI income entry deleted successfully' })
    })

  } else if (type === 'order_payment') {
    // Delete from payments table + linked upi_transaction if any
    db.get(`SELECT * FROM payments WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!row) return res.status(404).json({ error: 'Entry not found' })

      db.run(`DELETE FROM payments WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message })

        // Linked cash_income entry bhi delete karo (taaki ledger mein dobara na dikhe)
        db.get(`SELECT customer_id FROM orders WHERE id = ?`, [row.order_id], (err, ord) => {
          if (!err && ord) {
            db.run(
              `DELETE FROM cash_income WHERE notes = 'Order Payment' AND customer_id = ? AND amount = ?`,
              [ord.customer_id, row.amount],
              () => {}
            )
          }
        })

        // Recalculate order balance_due after payment deletion
        db.get(
          `SELECT total_amount, advance_paid, discount_amount, COALESCE(SUM(p.amount),0) as paid
           FROM orders
           LEFT JOIN payments p ON p.order_id = orders.id
           WHERE orders.id = ?`,
          [row.order_id],
          (err, o) => {
            if (!err && o) {
              const newBalance = o.total_amount - o.advance_paid - (o.discount_amount || 0) - o.paid
              db.run(`UPDATE orders SET balance_due = ? WHERE id = ?`, [newBalance, row.order_id], () => {})
            }
          }
        )

        // Clean up upi_transaction if UPI payment
        if (row.payment_mode === 'upi') {
          db.run(
            `DELETE FROM upi_transactions WHERE order_id = ? AND amount = ? AND notes != 'Order Advance Payment' LIMIT 1`,
            [row.order_id, row.amount],
            () => {}
          )
        }
        res.json({ message: 'Order payment deleted and balance updated' })
      })
    })

  } else if (type === 'order_advance_cash' || type === 'order_advance_upi') {
    // `id` yahan cash_income.id ya upi_transactions.id hai (advance entry ka id),
    // order ka id NAHI hai — pehle us entry ko point karne wala order dhundo, fir cleanup karo.
    const advanceTable = type === 'order_advance_cash' ? 'cash_income' : 'upi_transactions'

    db.get(
      `SELECT * FROM orders WHERE advance_entry_table = ? AND advance_entry_id = ?`,
      [advanceTable, id],
      (err, order) => {
        if (err) return res.status(500).json({ error: err.message })

        // Advance row delete karo — order mile ya na mile, ye row hatni chahiye
        db.run(`DELETE FROM ${advanceTable} WHERE id = ?`, [id], () => {})

        if (!order) {
          return res.json({ message: 'Advance entry deleted (no linked order found)' })
        }

        db.run(`DELETE FROM customer_payments WHERE source = 'order_advance' AND source_id = ?`, [order.id], () => {})

        // Reset advance on order — balance ab recalculateOrderBalance se aayega
        // (follow-up payments aur cleared cheques bhi ab account hote hain, jo pehle miss ho rahe the)
        db.run(
          `UPDATE orders SET advance_paid = 0, advance_payment_mode = NULL,
           advance_entry_table = NULL, advance_entry_id = NULL WHERE id = ?`,
          [order.id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message })
            recalculateOrderBalance(order.id, (err, newBalance) => {
              if (err) return res.status(500).json({ error: err.message })
              res.json({ message: 'Advance deleted and order balance reset', balance_due: newBalance })
            })
          }
        )
      }
    )

  } else {
    res.status(400).json({ error: 'Unknown entry type' })
  }
})

module.exports = router;