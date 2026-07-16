// reset_data.js — Run from server/ folder: node reset_data.js --confirm
// ⚠️ SAFETY GUARD — production mein kabhi nahi chalega, aur bina --confirm ke bhi nahi.
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refusing to run reset_data.js — NODE_ENV is "production". Ye script poora financial data delete kar deta hai.');
  process.exit(1);
}
if (process.argv[2] !== '--confirm') {
  console.error('⚠️  Ye SAAB payments, expenses, cash income, UPI transactions, cheques, opening balances PERMANENTLY delete kar dega, aur order/vendor balances reset kar dega.');
  console.error('    Confirm karne ke liye phir se chalao: node reset_data.js --confirm');
  process.exit(1);
}

const util = require('util');
const db = require('./db/database');

const runAsync = util.promisify(db.run).bind(db);

async function step(label, sql) {
  await runAsync(sql);
  console.log(`✅ ${label}`);
}

async function main() {
  // Chhota sa startup-wait — db.js ke andar migrations/table-creation abhi
  // bhi chal rahi ho sakti hai jab server pehli baar start ho. Ab har DELETE
  // apna completion khud await karta hai (sequential), isliye ye sirf ek
  // extra safety margin hai — poore script ki correctness ab isi pe
  // depend nahi karti jaisa purane fixed setTimeout(1500)+setTimeout(1000)
  // mein thi.
  await new Promise(r => setTimeout(r, 1500));

  await runAsync('BEGIN TRANSACTION');
  try {
    await step('payments cleared',               `DELETE FROM payments`);
    await step('cash_income cleared',             `DELETE FROM cash_income`);
    await step('upi_transactions cleared',        `DELETE FROM upi_transactions`);
    await step('cheques cleared',                 `DELETE FROM cheques`);
    await step('expenses cleared',                `DELETE FROM expenses`);
    await step('daily_records cleared',           `DELETE FROM daily_records`);
    await step('vendor_transactions cleared',     `DELETE FROM vendor_transactions`);
    await step('employee_salary_credits cleared', `DELETE FROM employee_salary_credits`);

    // NAYA: pehle missing tha — advance-payment-linked rows the, jo
    // payments/cash_income/upi wipe hone ke baad dangling ho jaate.
    await step('customer_payments cleared', `DELETE FROM customer_payments`);

    // NAYA: Galla baseline bhi clear karo — warna Denomination Drawer reset
    // ke baad bhi purani baseline-count se hi calculate hoti rahegi.
    await step('cash_drawer_baseline cleared', `DELETE FROM cash_drawer_baseline`);

    // Orders reset — discount_amount ab formula mein shamil hai (jaisa
    // recalculateOrderBalance karta hai: total_amount - advance_paid -
    // discount_amount - paid). Pehle balance_due = total_amount set hota
    // tha, discount ignore ho jaata tha — agar order pe discount tha to
    // reset ke baad due galat (zyada) dikhta.
    // advance_denomination_breakdown bhi NULL kiya — warna Denomination
    // Drawer calculation purane note-counts ko "phantom cash" ki tarah
    // dobara add kar deti (wo check nahi karti ki advance_paid abhi > 0
    // hai ya nahi, bas column ka data hone pe apply kar deti hai).
    // advance_entry_table/id/mode bhi clear kiye — ab wo dangling
    // references the (deleted rows ko point kar rahe the).
    await step('orders reset (balance_due = total_amount - discount_amount)', `
      UPDATE orders SET
        advance_paid = 0,
        advance_payment_mode = NULL,
        advance_entry_table = NULL,
        advance_entry_id = NULL,
        advance_denomination_breakdown = NULL,
        balance_due = total_amount - COALESCE(discount_amount, 0)
    `);

    // Vendor balances reset
    await step('vendor balances reset', `UPDATE vendors SET total_paid = 0, balance_due = 0, total_purchased = 0`);

    // NAYA: customers.opening_balance bhi reset — ye bhi utna hi
    // "financial data" hai jitna payments/cash_income (Stage 1/2 mein
    // add hua tha). Warna reset ke baad bhi purana opening-balance number
    // Customer Profile/Dashboard/Reports mein reh jaata, jabki baaki sab 0
    // dikh raha hota — inconsistent state.
    await step('customer opening balances reset', `
      UPDATE customers SET opening_balance = 0, opening_balance_date = NULL, opening_balance_notes = NULL
    `);

    await runAsync('COMMIT');
  } catch (err) {
    await runAsync('ROLLBACK').catch(() => {});
    throw err;
  }

  console.log('\n🎉 All financial data cleared successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Reset failed:', err.message);
  process.exit(1);
});