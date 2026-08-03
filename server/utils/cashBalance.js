const db = require('../db/database');

// Live cash-in-hand — baseline (agar set hai) + uske baad ke saare CASH
// payments/income minus CASH expenses. Expense insert hone se PEHLE
// call karke check karo ki galla mein utna cash hai bhi ya nahi.
function getLiveCashBalance(callback) {
  db.get(
    `SELECT denomination_counts, set_at FROM cash_drawer_baseline ORDER BY set_at DESC LIMIT 1`,
    [],
    (err, baseline) => {
      if (err) return callback(err);

      let baselineTotal = 0;
      let sinceAt = '1970-01-01 00:00:00';
      if (baseline) {
        try {
          const counts = JSON.parse(baseline.denomination_counts);
          baselineTotal = Object.entries(counts).reduce((s, [d, c]) => s + Number(d) * Number(c), 0);
        } catch (e) { baselineTotal = 0; }
        sinceAt = baseline.set_at;
      }

      db.get(`
        SELECT COALESCE(SUM(cash_in), 0) - COALESCE(SUM(cash_out), 0) as delta
        FROM (
          SELECT amount as cash_in, 0 as cash_out FROM payments
          WHERE payment_mode = 'cash' AND created_at > ?
          UNION ALL
          SELECT amount as cash_in, 0 as cash_out FROM cash_income
          WHERE (payment_mode = 'cash' OR payment_mode IS NULL) AND created_at > ?
            AND (notes IS NULL OR notes != 'Galla Opening Balance')
          UNION ALL
          SELECT 0 as cash_in, amount as cash_out FROM expenses
          WHERE payment_mode = 'cash' AND created_at > ?
        )
      `, [sinceAt, sinceAt, sinceAt], (err, row) => {
        if (err) return callback(err);
        callback(null, baselineTotal + (row?.delta || 0));
      });
    }
  );
}

module.exports = { getLiveCashBalance };