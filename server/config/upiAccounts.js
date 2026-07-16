// UPI account-labels source-code se bahar — .env se aate hain (gitignored),
// isliye repo mein kabhi commit nahi honge. .env mein add karo:
// UPI_ACCOUNTS_JSON=[{"upiId":"xxx@bank","name":"My Account"}, ...]
let accounts = []
try {
  accounts = process.env.UPI_ACCOUNTS_JSON ? JSON.parse(process.env.UPI_ACCOUNTS_JSON) : []
} catch (e) {
  console.error('UPI_ACCOUNTS_JSON .env mein invalid JSON hai — UPI account names blank rahenge:', e.message)
  accounts = []
}

function getUpiAccountName(upiId) {
  return accounts.find(a => a.upiId === upiId)?.name || upiId
}

module.exports = { getUpiAccountName }