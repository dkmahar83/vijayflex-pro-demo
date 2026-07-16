import { useState, useEffect, Fragment } from 'react'
import {
  getDailySummary,
  getExpenses, addExpense, deleteExpense, getTodaySales,
  getEmployees, getVendors, getDailyLedgerByDate, saveCashIncome, getCustomers,
  getCashDrawer, getDenominationDrawer, setDrawerBaseline, deleteLedgerEntry,
  getSetting, setSetting, getGallaHistory
} from '../services/api'
import DenominationCounter from '../components/DenominationCounter'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
import {
  Wallet, ClipboardList, Receipt, NotebookPen, Calculator,
  BarChart3, CreditCard, Banknote, Smartphone, User, Store,
  Coins, AlertTriangle, CheckCircle2, Phone, Clock, Trash2,
  RefreshCw, Settings, Lightbulb, StickyNote, X,
} from 'lucide-react'

const ALL_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1]

const CATEGORIES = [
  'Raw Material (Pipe/Flex)',
  'Employee Advance',
  'Ghar Khata',
  'Tea / Refreshments',
  'Petrol / Transport',
  'Electricity Bill',
  'Vendor Payment',
  'Ink Purchase',
  'Rent',
  'Miscellaneous',
  'Commission'
]
const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
]

function DailySales() {
  const today = new Date().toLocaleDateString('en-CA')
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear = String(new Date().getFullYear())

  const [activeTab, setActiveTab] = useState('today')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [todayData, setTodayData] = useState(null)
  const [employees, setEmployees] = useState([])
  const [vendors, setVendors] = useState([])
  const [ledgerDate, setLedgerDate] = useState(today)
  const [ledgerByDate, setLedgerByDate] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [cashDrawer, setCashDrawer] = useState(null)
  const [cashDrawerDate, setCashDrawerDate] = useState(today)
  const [cashDrawerLoading, setCashDrawerLoading] = useState(false)
  const [drawerData, setDrawerData] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [showBaselineForm, setShowBaselineForm] = useState(false)
  const [baselineCounts, setBaselineCounts] = useState({})
  const [baselineSaving, setBaselineSaving] = useState(false)
  const [suggestedBaseline, setSuggestedBaseline] = useState(null)
  // Note-wise Cash Tracking — global ON/OFF setting
  const [noteTrackingEnabled, setNoteTrackingEnabled] = useState(true)
  const [settingLoading, setSettingLoading] = useState(false)
  const [gallaHistory, setGallaHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // Tracking OFF→ON popup — denomination reset + baseline-set, tabhi ON hoga
  const [showEnableModal, setShowEnableModal] = useState(false)
  const [enableSaving, setEnableSaving] = useState(false)
  // Tracking ON→OFF warning popup
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [disableSaving, setDisableSaving] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null) // { type, id, label }
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Cash Drawer tab — click-to-expand denomination breakdown
  const [expandedDrawerKey, setExpandedDrawerKey] = useState(null)

  const [cashForm, setCashForm] = useState({
    customer_id: '',
    amount: '',
    income_date: today,
    notes: '',
    payment_mode: 'cash',
    upi_account: ''
  })
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [cashDenomination, setCashDenomination] = useState({})
  const [expenseDenomination, setExpenseDenomination] = useState({})
  const [cashSubmitting, setCashSubmitting] = useState(false)
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    amount: '',
    description: '',
    expense_date: today,
    payment_mode: 'cash',
    upi_account: '',
    paid_to_type: null,
    paid_to_id: '',
    customer_id: '',
    customer_name: ''
  })

  // Commission customer search state
  const [commCustomerSearch, setCommCustomerSearch] = useState('')
  const [commSelectedCustomer, setCommSelectedCustomer] = useState(null)
  const [showCommDropdown, setShowCommDropdown] = useState(false)

  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear] = useState(currentYear)

  useEffect(() => {
    fetchAll()
    fetchCustomers()
    getEmployees().then(res => setEmployees(res.data)).catch(() => {})
    getVendors().then(res => setVendors(res.data)).catch(() => {})
  }, [filterMonth, filterYear]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking setting sirf "Galla" tab pe nahi — mount hote hi chahiye,
  // kyunki "Record Entry" tab (cash income + expense) ko bhi turant
  // pata hona chahiye ki denomination-counter dikhana hai ya nahi.
  useEffect(() => {
    fetchNoteTrackingSetting()
    fetchDrawer()
  }, [])

  // Message ab khud gayab ho jaata hai, aur tab badalte hi turant clear —
  // warna "Entry saved" wala banner "Cash Drawer" ya "Galla Hisaab" tab pe
  // bhi dikhta reh jaata tha.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  useEffect(() => {
    queueMicrotask(() => setMessage(''))
  }, [activeTab])

  function showMsg(text, type = 'success') {
    setMessage(text)
    setMessageType(type)
  }

  function fmtDT(dateStr) {
    if (!dateStr) return '—'
    const clean = String(dateStr).replace('T', ' ').substring(0, 19)
    const parts = clean.split(' ')
    if (parts.length === 2) {
      const [datePart, timePart] = parts
      const [yyyy, mm, dd] = datePart.split('-')
      return `${timePart}  ${dd}.${mm}.${yyyy}`
    }
    return clean
  }

  // Denomination order — jaisa DenominationCounter.jsx mein hai, badi se choti
  const DENOM_ORDER = [500, 200, 100, 50, 20, 10, 5, 2, 1]

  function sumDenom(counts) {
    return Object.values(counts || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  }

  function hasBreakdown(item) {
    if (!item.denomination_breakdown) return false
    const { received, returned } = item.denomination_breakdown
    return sumDenom(received) > 0 || sumDenom(returned) > 0
  }

  function renderDenomChips(counts, color) {
    const entries = DENOM_ORDER.map(d => [d, Number(counts?.[d]) || 0]).filter(([, c]) => c > 0)
    if (entries.length === 0) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {entries.map(([d, c]) => (
          <span key={d} style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px',
            backgroundColor: color + '18', color
          }}>₹{d} × {c}</span>
        ))}
      </div>
    )
  }

  function fetchAll() {
    fetchExpenses()
    fetchSummary()
    fetchTodayData()
  }

  function fetchCustomers() {
    getCustomers()
      .then(res => setCustomers(res.data))
      .catch(() => {})
  }

  function fetchTodayData() {
    getTodaySales()
      .then(res => setTodayData(res.data))
      .catch(() => {})
  }

  function fetchExpenses() {
    getExpenses(filterMonth, filterYear)
      .then(res => setExpenses(res.data))
      .catch(() => {})
  }

  function fetchSummary() {
    getDailySummary(filterMonth, filterYear)
      .then(res => setSummary(res.data))
      .catch(() => {})
  }

  function fetchLedgerByDate(date) {
    setLedgerLoading(true)
    getDailyLedgerByDate(date)
      .then(res => { setLedgerByDate(res.data); setLedgerLoading(false) })
      .catch(() => {
        setLedgerLoading(false)
        showMsg('Failed to load ledger. Check console for details.', 'error')
      })
  }

  function fetchCashDrawer(date) {
    setCashDrawerLoading(true)
    getCashDrawer(date)
      .then(res => { setCashDrawer(res.data); setCashDrawerLoading(false) })
      .catch(() => setCashDrawerLoading(false))
  }

  function fetchDrawer() {
    setDrawerLoading(true)
    getDenominationDrawer()
      .then(res => { setDrawerData(res.data); setDrawerLoading(false) })
      .catch(() => setDrawerLoading(false))
  }

  function fetchNoteTrackingSetting() {
    setSettingLoading(true)
    getSetting('note_tracking_enabled')
      .then(res => {
        // Key kabhi set hi na hui ho (naya install) to default ON —
        // taaki jinke paas already Galla Hisaab active hai unke liye kuch na tute.
        setNoteTrackingEnabled(res.data.value === null ? true : res.data.value === 'true')
      })
      .catch(() => {})
      .finally(() => setSettingLoading(false))
  }

  function toggleNoteTracking() {
    if (!noteTrackingEnabled) {
      // OFF → ON: seedha ON nahi karna — pehle fresh galla count lena hai.
      setBaselineCounts({})
      setShowEnableModal(true)
      return
    }
    // ON → OFF: ab seedha off nahi hota — pehle warning, kyunki OFF karte hi
    // denomination-counter option Orders/Sales/Expense/Salary/Vendor sabse gayab ho jaayega.
    setShowDisableModal(true)
  }

  function handleDisableTracking() {
    setDisableSaving(true)
    setSetting('note_tracking_enabled', false)
      .then(() => {
        setNoteTrackingEnabled(false)
        setShowDisableModal(false)
        showMsg('Note-wise Cash Tracking OFF kar diya.')
      })
      .catch(() => showMsg('Setting update nahi ho payi.', 'error'))
      .finally(() => setDisableSaving(false))
  }

  function fetchGallaHistory() {
    setHistoryLoading(true)
    getGallaHistory()
      .then(res => setGallaHistory(res.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }

  function bumpBaseline(value, delta) {
    setBaselineCounts(prev => {
      const current = Number(prev[value]) || 0
      return { ...prev, [value]: Math.max(0, current + delta) }
    })
  }

  function handleSetBaseline() {
  setBaselineSaving(true)
  setDrawerBaseline({ denomination_counts: baselineCounts, notes: 'Manual galla count' })
    .then(() => {
      showMsg('Galla count set ho gaya! Cash Drawer mein bhi reflect ho gaya ✅')
      setShowBaselineForm(false)
      setBaselineCounts({})
      setSuggestedBaseline(null)
      fetchDrawer()
    })
    .catch(() => showMsg('Error setting galla count.', 'error'))
    .finally(() => setBaselineSaving(false))
}

  function handleEnableTracking() {
    setEnableSaving(true)
    // Pehle fresh baseline save hoti hai, tabhi setting ON hoti hai —
    // taaki tracking hamesha ek verified count se hi shuru ho.
    setDrawerBaseline({ denomination_counts: baselineCounts, notes: 'Tracking ON — fresh galla count' })
      .then(() => setSetting('note_tracking_enabled', true))
      .then(() => {
        setNoteTrackingEnabled(true)
        setShowEnableModal(false)
        setBaselineCounts({})
        showMsg('Note-wise Cash Tracking ON kar diya — naya galla count set ho gaya ✅')
        fetchDrawer()
        fetchGallaHistory()
      })
      .catch(() => showMsg('Tracking ON karte waqt error aaya — dobara try karo.', 'error'))
      .finally(() => setEnableSaving(false))
  }

  const filteredCustomers = customers.filter(c =>
    c.firm_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact_name || '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  function handleSelectCustomer(c) {
    setSelectedCustomer(c)
    setCashForm(f => ({ ...f, customer_id: c.id }))
    setCustomerSearch(c.firm_name)
    setShowDropdown(false)
  }

  function handleLedgerDelete(e) {
    e.preventDefault()
    if (!deletePassword) return showMsg('Password daalo.', 'error')
    setDeleteLoading(true)
    deleteLedgerEntry(deletePassword, deleteModal.type, deleteModal.id)
      .then(() => {
        showMsg('Entry delete ho gayi ✅')
        setDeleteModal(null)
        setDeletePassword('')
        fetchLedgerByDate(ledgerDate)
      })
      .catch(err => {
        showMsg(err.response?.data?.error || 'Delete failed.', 'error')
      })
      .finally(() => setDeleteLoading(false))
  }
  function handleSaveCashIncome(e) {
    e.preventDefault()
    if (!cashForm.customer_id) return showMsg('Please select a customer.', 'error')
    if (cashForm.payment_mode === 'upi' && !cashForm.upi_account)
      return showMsg('Please select UPI account.', 'error')
    if (!cashForm.amount || isNaN(cashForm.amount) || Number(cashForm.amount) <= 0)
      return showMsg('Enter a valid amount.', 'error')

    const cleanForm = {
      ...cashForm,
      amount: parseInt(cashForm.amount, 10),
      denomination_breakdown: cashForm.payment_mode === 'cash' && Object.keys(cashDenomination).length > 0
        ? cashDenomination
        : null
    }
    setCashSubmitting(true)
    saveCashIncome(cleanForm)
      .then(() => {
        showMsg(`₹${cashForm.amount} cash income saved for ${selectedCustomer?.firm_name}`)
        setCashForm({ customer_id: '', amount: '', income_date: today, notes: '', payment_mode: 'cash', upi_account: '' })
        setSelectedCustomer(null)
        setCustomerSearch('')
        setCashDenomination({})
        fetchAll()
        fetchDrawer()
      })
      .catch(() => showMsg('Error saving cash income.', 'error'))
      .finally(() => setCashSubmitting(false))
  }

  function handleAddExpense(e) {
    e.preventDefault()
    if (!expenseForm.category || !expenseForm.amount) {
      return showMsg('Category and amount are required.', 'error')
    }
    if (expenseForm.category === 'Employee Advance' && !expenseForm.paid_to_id) {
      return showMsg('Please select an employee for the advance.', 'error')
    }
    if (expenseForm.category === 'Vendor Payment' && !expenseForm.paid_to_id) {
      return showMsg('Please select a vendor for the payment.', 'error')
    }
    if (expenseForm.category === 'Commission' && !expenseForm.customer_id) {
      return showMsg('Commission ke liye customer select karo.', 'error')
    }

    const payload = {
      category: expenseForm.category,
      amount: parseInt(expenseForm.amount, 10),
      expense_date: expenseForm.expense_date,
      description: expenseForm.description,
      payment_mode: expenseForm.payment_mode || 'cash',
      upi_account: expenseForm.upi_account || null,
      paid_to_type: expenseForm.paid_to_type || null,
      paid_to_id: expenseForm.paid_to_id || null,
      customer_id: expenseForm.customer_id || null,
      customer_name: expenseForm.customer_name || null,
      denomination_breakdown: expenseForm.payment_mode === 'cash' && Object.keys(expenseDenomination).length > 0
        ? expenseDenomination
        : null
    }

    setExpenseSubmitting(true)
    addExpense(payload)
      .then(() => {
        showMsg(`Expense of ₹${expenseForm.amount} added.`)
        setExpenseForm({
          category: '', amount: '', description: '',
          expense_date: today, payment_mode: 'cash',
          upi_account: '', paid_to_type: null, paid_to_id: '',
          customer_id: '', customer_name: ''
        })
        setCommSelectedCustomer(null)
        setCommCustomerSearch('')
        setExpenseDenomination({})
        fetchAll()
        fetchDrawer()
      })
      .catch(() => showMsg('Error adding expense.', 'error'))
      .finally(() => setExpenseSubmitting(false))
  }

  function handleDeleteExpense(id) {
    deleteExpense(id)
      .then(() => {
        showMsg('Expense deleted.')
        fetchAll()
      })
      .catch(() => showMsg('Error deleting expense.', 'error'))
  }

  const groupedExpenses = expenses.reduce((groups, exp) => {
    const date = exp.expense_date
    if (!groups[date]) groups[date] = []
    groups[date].push(exp)
    return groups
  }, {})

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Wallet size={20} /> Daily Sales & Expenses</h2>
      </div>

      {message && (
        <p
          style={{ ...styles.message, ...(messageType === 'error' ? styles.messageError : {}) }}
          onClick={() => setMessage('')}
        >
          {message}
        </p>
      )}

      {/* MONTH FILTER */}
      <div style={styles.filterRow}>
        <select
          style={{ ...styles.input, maxWidth: '150px' }}
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        >
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>
              {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          style={{ ...styles.input, maxWidth: '100px' }}
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
        >
          {['2024', '2025', '2026', '2027'].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* MONTHLY SUMMARY CARDS */}
      {summary && (
        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNum, color: '#27ae60' }}>₹{summary.total_sales || 0}</div>
            <div style={styles.summaryLabel}>Total Sales</div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              incl. ₹{summary.payments_total || 0} from orders
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNum, color: '#e74c3c' }}>₹{summary.total_expenses || 0}</div>
            <div style={styles.summaryLabel}>Total Expenses</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={{ ...styles.summaryNum, color: (summary.net_profit || 0) >= 0 ? '#1a1a2e' : '#e74c3c' }}>
              ₹{summary.net_profit || 0}
            </div>
            <div style={styles.summaryLabel}>Net Profit</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryNum}>{summary.days_recorded || 0}</div>
            <div style={styles.summaryLabel}>Days Recorded</div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {['today', 'history', 'expenses', 'ledger', 'galla'].map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={async () => {
            setActiveTab(tab)
            if (tab === 'galla') {
              fetchDrawer()
              fetchNoteTrackingSetting()
              fetchGallaHistory()
              try {
                const res = await getCashDrawer(today)
                const bal = res.data?.closing_balance ?? 0
                setSuggestedBaseline(bal)
              } catch {
                setSuggestedBaseline(null)
              }
            }
          }}
          >
            {tab === 'today' ? <><ClipboardList size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Record Entry</>
            : tab === 'history' ? <><Wallet size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Cash Drawer</>
            : tab === 'expenses' ? <><Receipt size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Expense List</>
            : tab === 'ledger' ? <><NotebookPen size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Daily Ledger</>
            : <><Calculator size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Galla Hisaab</>}
          </button>
        ))}
      </div>

      {/* TAB: RECORD ENTRY */}
      {activeTab === 'today' && (
        <div>
          {todayData && (
            <div style={styles.todayBox}>
              <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={17} /> Today's Summary — {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div style={styles.todayRow}>
                <div style={styles.todayCard}>
                  <div style={{ ...styles.todayCardLabel, display: 'flex', alignItems: 'center', gap: '5px' }}><CreditCard size={13} /> Payments from Orders</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                    ₹{todayData.payments_total || 0}
                  </div>
                  {todayData.payments_received && todayData.payments_received.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      {todayData.payments_received.map(p => (
                        <div key={p.id} style={styles.paymentLine}>
                          <div>
                            <span style={{ color: '#555' }}>{p.firm_name}</span>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>{fmtDT(p.created_at || p.payment_date)}</div>
                          </div>
                          <span style={{ fontWeight: 'bold', color: '#27ae60' }}>₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>No order payments today</div>
                  )}
                </div>

                <div style={styles.todayCard}>
                  <div style={{ ...styles.todayCardLabel, display: 'flex', alignItems: 'center', gap: '5px' }}><Banknote size={13} /> Other Cash Received</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                    ₹{todayData.cash_income_total || 0}
                  </div>
                  {todayData.cash_income_today && todayData.cash_income_today.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      {todayData.cash_income_today.map(c => (
                        <div key={c.id} style={styles.paymentLine}>
                          <div>
                            <span style={{ color: '#555' }}>{c.firm_name}</span>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>{fmtDT(c.income_date || c.created_at)}</div>
                          </div>
                          <span style={{ fontWeight: 'bold', color: '#3498db' }}>₹{c.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>No cash income today</div>
                  )}
                </div>

                <div style={{ ...styles.todayCard, backgroundColor: '#1a1a2e' }}>
                  <div style={{ ...styles.todayCardLabel, color: '#aaa' }}>Total Payment In Today</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                    ₹{todayData.total_cash_in || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                    orders + cash income + UPI
                  </div>
                </div>

                <div style={{ ...styles.todayCard, backgroundColor: '#fff5f5', border: '1px solid #fdd' }}>
                  <div style={{ ...styles.todayCardLabel, display: 'flex', alignItems: 'center', gap: '5px' }}><Receipt size={13} /> Expenses Today</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                    ₹{todayData.total_expenses || 0}
                  </div>
                </div>
              </div>

              {todayData.upi_by_account && todayData.upi_by_account.length > 0 && (
                <div style={{ ...styles.todayCard, marginTop: '8px' }}>
                  <div style={{ ...styles.todayCardLabel, display: 'flex', alignItems: 'center', gap: '5px' }}><Smartphone size={13} /> UPI Received Today — ₹{todayData.upi_total}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {todayData.upi_by_account.map(u => (
                      <div key={u.upi_account} style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '6px', minWidth: '160px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>₹{u.total}</div>
                        <div style={{ fontSize: '11px', color: '#555' }}>{u.upi_account}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{u.count} transaction(s)</div>
                      </div>
                    ))}
                  </div>
                  {todayData.upi_detail && todayData.upi_detail.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      {todayData.upi_detail.map(t => (
                        <div key={t.id} style={styles.paymentLine}>
                          <span>{t.customer_name || t.customer_firm || 'Unknown'} → {t.upi_account}</span>
                          <span style={{ fontWeight: 'bold', color: '#27ae60' }}>₹{t.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {todayData.cheques_today && todayData.cheques_today.length > 0 && (
                <div style={{ ...styles.todayCard, marginTop: '8px', backgroundColor: '#f5f0ff' }}>
                  <div style={{ ...styles.todayCardLabel, display: 'flex', alignItems: 'center', gap: '5px' }}><Receipt size={13} /> Cheques Received Today — ₹{todayData.cheque_total}</div>
                  {todayData.cheques_today.map(c => (
                    <div key={c.id} style={{ ...styles.paymentLine, marginTop: '6px' }}>
                      <span>{c.firm_name} • {c.bank_name || 'Unknown Bank'} • #{c.cheque_number || 'No number'}</span>
                      <span style={{ fontWeight: 'bold', color: '#8e44ad' }}>₹{c.amount}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                    Note: Cheque amounts are NOT counted in cash total until cleared
                  </div>
                </div>
              )}

              <div style={styles.netToday}>
                <span style={{ fontSize: '16px', color: '#555' }}>Net Today (Cash In - Expenses):</span>
                <strong style={{
                  fontSize: '22px',
                  color: ((todayData.total_cash_in || 0) - (todayData.total_expenses || 0)) >= 0
                    ? '#27ae60' : '#e74c3c'
                }}>
                  ₹{(todayData.total_cash_in || 0) - (todayData.total_expenses || 0)}
                </strong>
              </div>
            </div>
          )}

          <div style={styles.twoCol}>
            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '4px', color: '#27ae60', display: 'flex', alignItems: 'center', gap: '8px' }}><Banknote size={17} /> Record Other Payment</h3>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                Cash received from a customer — not linked to a specific order
              </p>
              <form onSubmit={handleSaveCashIncome}>
                <div style={{ marginBottom: '12px', position: 'relative' }}>
                  <label style={styles.label}>Customer *</label>
                  <input
                    style={{
                      ...styles.input,
                      borderColor: !selectedCustomer && customerSearch ? '#e74c3c' : '#ddd'
                    }}
                    type="text"
                    placeholder="Search customer name..."
                    value={customerSearch}
                    onChange={e => {
                      setCustomerSearch(e.target.value)
                      setShowDropdown(true)
                      if (selectedCustomer && e.target.value !== selectedCustomer.firm_name) {
                        setSelectedCustomer(null)
                        setCashForm(f => ({ ...f, customer_id: '' }))
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    autoComplete="off"
                  />
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div style={styles.dropdown}>
                      {filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          style={styles.dropdownItem}
                          onMouseDown={() => handleSelectCustomer(c)}
                        >
                          <span style={{ fontWeight: 'bold' }}>{c.firm_name}</span>
                          {c.contact_name && (
                            <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                              {c.contact_name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div style={{ ...styles.selectedCustomerBadge, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} /> {selectedCustomer.firm_name}
                      {selectedCustomer.phone && (
                        <span style={{ color: '#888', fontSize: '11px', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Phone size={11} /> {selectedCustomer.phone}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={cashForm.income_date}
                    onChange={e => setCashForm(f => ({ ...f, income_date: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Payment Mode *</label>
                  <select
                    style={styles.input}
                    value={cashForm.payment_mode}
                    onChange={e =>
                      setCashForm({
                        ...cashForm,
                        payment_mode: e.target.value,
                        upi_account: e.target.value === 'cash' ? '' : cashForm.upi_account
                      })
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                {cashForm.payment_mode === 'upi' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={styles.label}>UPI Account *</label>
                    <select
                      style={styles.input}
                      value={cashForm.upi_account}
                      onChange={e => setCashForm({ ...cashForm, upi_account: e.target.value })}
                    >
                      <option value="">Select UPI Account</option>
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                  </div>
                )}

                {cashForm.payment_mode === 'cash' && noteTrackingEnabled && (
                  <DenominationCounter
                    availableNotes={drawerData?.denominations}
                    onApply={(total, counts) => {
                      setCashForm(f => ({ ...f, amount: String(total) }))
                      setCashDenomination(counts)
                    }}
                  />
                )}

                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Amount (₹) *</label>
                  <input
                    style={{
                      ...styles.input, fontSize: '20px', fontWeight: 'bold',
                      ...(cashForm.payment_mode === 'cash' && noteTrackingEnabled
                        ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {})
                    }}
                    type="number"
                    placeholder="e.g. 500"
                    value={cashForm.amount}
                    onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                    readOnly={cashForm.payment_mode === 'cash' && noteTrackingEnabled}
                  />
                  {cashForm.payment_mode === 'cash' && noteTrackingEnabled && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      Note Counting (upar) se bharo
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>Notes (optional)</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. Partial payment for banner"
                    value={cashForm.notes}
                    onChange={e => setCashForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <LoadingButton
                  loading={cashSubmitting}
                  disabled={!selectedCustomer}
                  style={styles.greenBtn}
                  type="submit"
                >
                  Save Entry
                </LoadingButton>
              </form>
            </div>

            <div style={styles.formBox}>
              <h3 style={{ marginBottom: '4px', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '8px' }}><Receipt size={17} /> Add Expense</h3>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                Record any cash going out of shop today
              </p>
              <form onSubmit={handleAddExpense}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Date</label>
                  <input
                    style={styles.input} type="date"
                    value={expenseForm.expense_date}
                    onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Category *</label>
                  <select
                    style={styles.input}
                    value={expenseForm.category}
                    onChange={e => {
                      const cat = e.target.value
                      setExpenseForm({
                        ...expenseForm,
                        category: cat,
                        paid_to_type: cat === 'Employee Advance' ? 'employee'
                          : cat === 'Vendor Payment' ? 'vendor' : null,
                        paid_to_id: '',
                        customer_id: '',
                        customer_name: ''
                      })
                      if (cat !== 'Commission') {
                        setCommSelectedCustomer(null)
                        setCommCustomerSearch('')
                      }
                    }}
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {expenseForm.category === 'Employee Advance' && (
                  <div style={{ marginBottom: '12px', backgroundColor: '#fff9e6', padding: '12px', borderRadius: '8px', border: '1px solid #ffc107' }}>
                    <label style={{ ...styles.label, color: '#856404', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <User size={13} /> Select Employee * (required for advance)
                    </label>
                    <select
                      style={styles.input}
                      value={expenseForm.paid_to_id || ''}
                      onChange={e => setExpenseForm({ ...expenseForm, paid_to_id: e.target.value })}
                    >
                      <option value="">-- Select Employee --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} (₹{Math.round(emp.monthly_salary / 30)}/day)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {expenseForm.category === 'Vendor Payment' && (
                  <div style={{ marginBottom: '12px', backgroundColor: '#f0f7ff', padding: '12px', borderRadius: '8px', border: '1px solid #3498db' }}>
                    <label style={{ ...styles.label, color: '#1a5276', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Store size={13} /> Select Vendor * (required for vendor payment)
                    </label>
                    <select
                      style={styles.input}
                      value={expenseForm.paid_to_id || ''}
                      onChange={e => setExpenseForm({ ...expenseForm, paid_to_id: e.target.value })}
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.shop_type} (Due: ₹{v.balance_due})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {expenseForm.category === 'Commission' && (
                  <div style={{ marginBottom: '12px', backgroundColor: '#fff3e0', padding: '12px', borderRadius: '8px', border: '1px solid #ff9800', position: 'relative' }}>
                    <label style={{ ...styles.label, color: '#e65100', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Coins size={13} /> Customer Select Karo * (Commission ke liye zaroori)
                    </label>
                    <input
                      style={{
                        ...styles.input,
                        borderColor: !commSelectedCustomer && commCustomerSearch ? '#e74c3c' : '#ff9800'
                      }}
                      type="text"
                      placeholder="Customer naam search karo..."
                      value={commCustomerSearch}
                      onChange={e => {
                        setCommCustomerSearch(e.target.value)
                        setShowCommDropdown(true)
                        if (commSelectedCustomer) {
                          setCommSelectedCustomer(null)
                          setExpenseForm(f => ({ ...f, customer_id: '', customer_name: '' }))
                        }
                      }}
                      onFocus={() => setShowCommDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCommDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {showCommDropdown && customers.filter(c =>
                      c.firm_name.toLowerCase().includes(commCustomerSearch.toLowerCase())
                    ).length > 0 && (
                      <div style={styles.dropdown}>
                        {customers
                          .filter(c => c.firm_name.toLowerCase().includes(commCustomerSearch.toLowerCase()))
                          .map(c => (
                            <div
                              key={c.id}
                              style={styles.dropdownItem}
                              onMouseDown={() => {
                                setCommSelectedCustomer(c)
                                setCommCustomerSearch(c.firm_name)
                                setShowCommDropdown(false)
                                setExpenseForm(f => ({
                                  ...f,
                                  customer_id: c.id,
                                  customer_name: c.firm_name
                                }))
                              }}
                            >
                              <span style={{ fontWeight: 'bold' }}>{c.firm_name}</span>
                              {c.phone && <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Phone size={10} /> {c.phone}</span>}
                            </div>
                          ))
                        }
                      </div>
                    )}
                    {commSelectedCustomer && (
                      <div style={{ ...styles.selectedCustomerBadge, marginTop: '8px', backgroundColor: '#fff3e0', borderColor: '#ff9800', color: '#e65100', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={13} /> {commSelectedCustomer.firm_name}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#e65100', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={12} /> Ye amount customer ko wapas ki gayi hai — Cash Drawer / UPI se deduct hogi
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Amount (₹) *</label>
                  <input
                    style={{
                      ...styles.input, fontSize: '18px',
                      ...((expenseForm.payment_mode || 'cash') === 'cash' && noteTrackingEnabled
                        ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {})
                    }}
                    type="number" placeholder="0"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    readOnly={(expenseForm.payment_mode || 'cash') === 'cash' && noteTrackingEnabled}
                  />
                  {(expenseForm.payment_mode || 'cash') === 'cash' && noteTrackingEnabled && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      Note Counting (neeche) se bharo
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Payment Mode</label>
                  <select
                    style={styles.input}
                    value={expenseForm.payment_mode || 'cash'}
                    onChange={e => setExpenseForm({ ...expenseForm, payment_mode: e.target.value, upi_account: '' })}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                {(expenseForm.payment_mode || 'cash') === 'cash' && noteTrackingEnabled && (
                  <DenominationCounter
                    context="expense"
                    availableNotes={drawerData?.denominations}
                    onApply={(total, counts) => {
                      setExpenseForm(f => ({ ...f, amount: String(total) }))
                      setExpenseDenomination(counts)
                    }}
                  />
                )}

                {expenseForm.payment_mode === 'upi' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={styles.label}>UPI Account Used</label>
                    <select
                      style={styles.input}
                      value={expenseForm.upi_account || ''}
                      onChange={e => setExpenseForm({ ...expenseForm, upi_account: e.target.value })}
                    >
                      <option value="">Select UPI Account</option>
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>Description</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. 2 pipes bought, tea for 3 people"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  />
                </div>

                <LoadingButton loading={expenseSubmitting} style={styles.redBtn} type="submit">Add Expense</LoadingButton>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Cash Drawer */}
      {activeTab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <label style={styles.label}>Select Date</label>
              <input
                style={{ ...styles.input, maxWidth: '200px' }}
                type="date"
                value={cashDrawerDate}
                onChange={e => setCashDrawerDate(e.target.value)}
              />
            </div>
            <LoadingButton
              loading={cashDrawerLoading}
              style={{
                backgroundColor: '#1a1a2e',
                color: '#fff',
                border: '1px solid #1a1a2e',
                padding: '10px 28px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.3px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
              onClick={() => fetchCashDrawer(cashDrawerDate)}
            >
              <Wallet size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Load Cash Drawer
            </LoadingButton>
          </div>

          {cashDrawerLoading && <SectionLoader label="Cash Drawer load ho raha hai..." size="small" />}

          {!cashDrawer && !cashDrawerLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <p style={{ fontSize: '16px' }}>Select a date and click "Load Cash Drawer"</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Shows only physical cash — UPI and cheques excluded
              </p>
            </div>
          )}

          {cashDrawer && (
            <div>
              <div style={styles.ledgerDateHeader}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={17} /> Cash Drawer — {new Date(cashDrawer.date).toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#27ae60', fontWeight: 'bold' }}>Cash In: ₹{cashDrawer.total_cash_in}</span>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>Cash Out: ₹{cashDrawer.total_cash_out}</span>
                </div>
              </div>

              <div style={{
                backgroundColor: '#fff',
                padding: '16px 20px',
                borderRadius: '8px',
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderLeft: '4px solid #f39c12'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Opening Balance (Carried Forward)</div>
                  <div style={{ fontSize: '13px', color: '#aaa' }}>Cash in drawer at start of day</div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#f39c12' }}>
                  ₹{cashDrawer.opening_balance}
                </div>
              </div>

              <div style={styles.ledgerGrid}>
                <div style={styles.ledgerSection}>
                  <div style={styles.ledgerSectionHeader}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Banknote size={14} /> Cash In</span>
                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>₹{cashDrawer.total_cash_in}</span>
                  </div>
                  {cashDrawer.cash_in.length === 0 ? (
                    <div style={styles.ledgerEmpty}>No cash received on this date.</div>
                  ) : (
                    cashDrawer.cash_in.map((item, i) => {
                      const key = `in-${i}`
                      const expandable = hasBreakdown(item)
                      const isExpanded = expandedDrawerKey === key
                      return (
                      <Fragment key={key}>
                        <div
                          style={{
                            ...styles.ledgerRow,
                            cursor: expandable ? 'pointer' : 'default',
                            backgroundColor: isExpanded ? '#f8fdf9' : 'transparent'
                          }}
                          onClick={() => expandable && setExpandedDrawerKey(isExpanded ? null : key)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.party_name || '—'}</div>
                            <div style={{ marginTop: '4px' }}>
                              <span style={{
                                ...styles.typeBadge,
                                backgroundColor: item.type === 'Order Payment' ? '#e8f5e9' : '#e3f2fd',
                                color: item.type === 'Order Payment' ? '#27ae60' : '#1565c0'
                              }}>
                                {item.type}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={10} /> {fmtDT(item.created_at || item.payment_date)}
                            </div>
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#27ae60', fontSize: '16px' }}>
                            +₹{item.amount}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ backgroundColor: '#f8fdf9', padding: '4px 16px 14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', paddingTop: '6px' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '5px' }}>+ Aaye</div>
                                {renderDenomChips(item.denomination_breakdown.received, '#16a34a')
                                  || <span style={{ fontSize: '12px', color: '#aaa' }}>—</span>}
                              </div>
                              {sumDenom(item.denomination_breakdown.returned) > 0 && (
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#e74c3c', marginBottom: '5px' }}>− Gaye</div>
                                  {renderDenomChips(item.denomination_breakdown.returned, '#e74c3c')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Fragment>
                      )
                    })
                  )}
                  {cashDrawer.cash_in.length > 0 && (
                    <div style={styles.ledgerTotal}>
                      <span>Total Cash In</span>
                      <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '18px' }}>₹{cashDrawer.total_cash_in}</span>
                    </div>
                  )}
                </div>

                <div style={styles.ledgerSection}>
                  <div style={{ ...styles.ledgerSectionHeader, borderLeft: '4px solid #e74c3c' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Receipt size={14} /> Cash Out</span>
                    <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>₹{cashDrawer.total_cash_out}</span>
                  </div>
                  {cashDrawer.cash_out.length === 0 ? (
                    <div style={styles.ledgerEmpty}>No cash expenses on this date.</div>
                  ) : (
                    cashDrawer.cash_out.map((exp, i) => {
                      const key = `out-${i}`
                      const expandable = hasBreakdown(exp)
                      const isExpanded = expandedDrawerKey === key
                      return (
                      <Fragment key={key}>
                        <div
                          style={{
                            ...styles.ledgerRow,
                            cursor: expandable ? 'pointer' : 'default',
                            backgroundColor: isExpanded ? '#fff8f8' : 'transparent'
                          }}
                          onClick={() => expandable && setExpandedDrawerKey(isExpanded ? null : key)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{exp.party_name || exp.category}</div>
                            {exp.description && (
                              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>{exp.description}</div>
                            )}
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ ...styles.typeBadge, backgroundColor: '#fff0f0', color: '#e74c3c' }}>
                                {exp.category}
                              </span>
                            </div>
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '16px' }}>
                            -₹{exp.amount}
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ backgroundColor: '#fff8f8', padding: '4px 16px 14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', paddingTop: '6px' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '5px' }}>+ Aaye</div>
                                {renderDenomChips(exp.denomination_breakdown.received, '#16a34a')
                                  || <span style={{ fontSize: '12px', color: '#aaa' }}>—</span>}
                              </div>
                              {sumDenom(exp.denomination_breakdown.returned) > 0 && (
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#e74c3c', marginBottom: '5px' }}>− Gaye</div>
                                  {renderDenomChips(exp.denomination_breakdown.returned, '#e74c3c')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Fragment>
                      )
                    })
                  )}
                  {cashDrawer.cash_out.length > 0 && (
                    <div style={{ ...styles.ledgerTotal, borderTop: '2px solid #e74c3c' }}>
                      <span>Total Cash Out</span>
                      <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '18px' }}>₹{cashDrawer.total_cash_out}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: cashDrawer.closing_balance >= 0 ? '#f0fff4' : '#fff5f5',
                border: `2px solid ${cashDrawer.closing_balance >= 0 ? '#27ae60' : '#e74c3c'}`,
                borderRadius: '10px',
                padding: '20px 24px',
                marginTop: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px', fontWeight: 'bold' }}>
                    <Wallet size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Closing Cash Drawer Balance
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    ₹{cashDrawer.opening_balance} opening + ₹{cashDrawer.total_cash_in} in − ₹{cashDrawer.total_cash_out} out
                  </div>
                </div>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: cashDrawer.closing_balance >= 0 ? '#27ae60' : '#e74c3c'
                }}>
                  ₹{cashDrawer.closing_balance}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: EXPENSE LIST */}
      {activeTab === 'expenses' && (
        <div>
          {Object.keys(groupedExpenses).length === 0 ? (
            <p style={{ color: '#888' }}>No expenses for this month.</p>
          ) : (
            Object.entries(groupedExpenses).map(([date, exps]) => (
              <div key={date} style={styles.expenseGroup}>
                <div style={styles.expenseDateHeader}>
                  <span>
                    {new Date(date).toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </span>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                    Total: ₹{exps.reduce((s, e) => s + e.amount, 0)}
                  </span>
                </div>
                {exps.map(exp => (
                  <div key={exp.id} style={styles.expenseRow}>
                    <div style={styles.expenseCategoryDot(exp.category)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {exp.category}
                      </div>
                      {exp.paid_to_name && (
                        <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {exp.paid_to_type === 'employee' ? <><User size={11} /> {exp.paid_to_name}</> : <><Store size={11} /> {exp.paid_to_name}</>}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {exp.payment_mode === 'upi' ? <><Smartphone size={10} /> UPI • {exp.upi_account || 'Unknown'}</> : <><Banknote size={10} /> Cash</>}
                      </div>
                      {exp.description && (
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                          {exp.description}
                        </div>
                      )}
                      {exp.created_at && (
                        <div style={{ fontSize: '11px', color: '#bbb', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} /> {fmtDT(exp.created_at)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '16px', marginRight: '16px' }}>
                      ₹{exp.amount}
                    </div>
                    <button onClick={() => handleDeleteExpense(exp.id)} style={{ ...styles.deleteBtn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: DAILY LEDGER */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <label style={styles.label}>Select Date</label>
              <input
                style={{ ...styles.input, maxWidth: '200px' }}
                type="date"
                value={ledgerDate}
                onChange={e => setLedgerDate(e.target.value)}
              />
            </div>
            <LoadingButton
              loading={ledgerLoading}
              style={{
                backgroundColor: '#1a1a2e',
                color: '#fff',
                border: '1px solid #1a1a2e',
                padding: '10px 28px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.3px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
              onClick={() => fetchLedgerByDate(ledgerDate)}
            >
              <NotebookPen size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Load Ledger
            </LoadingButton>
          </div>

          {ledgerLoading && <SectionLoader label="Ledger load ho raha hai..." size="small" />}

          {ledgerByDate && (
            <div>
              <div style={styles.ledgerDateHeader}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <NotebookPen size={17} /> Ledger — {new Date(ledgerByDate.date).toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </h3>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
                    Income: ₹{ledgerByDate.total_income}
                  </span>
                  <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                    Expenses: ₹{ledgerByDate.total_expenses}
                  </span>
                  <span style={{ fontWeight: 'bold', color: ledgerByDate.net >= 0 ? '#1a1a2e' : '#e74c3c' }}>
                    Net: ₹{ledgerByDate.net}
                  </span>
                </div>
              </div>

              <div style={styles.ledgerGrid}>
                {/* INCOME SECTION */}
                <div style={styles.ledgerSection}>
                  <div style={styles.ledgerSectionHeader}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Banknote size={14} /> Sales / Income</span>
                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>₹{ledgerByDate.total_income}</span>
                  </div>

                  {ledgerByDate.income.length === 0 ? (
                    <div style={styles.ledgerEmpty}>No income recorded for this date.</div>
                  ) : (
                    ledgerByDate.income.map((item, i) => (
                      <div key={i} style={{ ...styles.ledgerRow, position: 'relative' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                            {item.party_name || '—'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                            <span style={{
                              ...styles.typeBadge,
                              backgroundColor: item.type === 'Order Payment' ? '#e8f5e9'
                                : item.type === 'UPI Payment' ? '#e8f0ff' : '#e3f2fd',
                              color: item.type === 'Order Payment' ? '#27ae60'
                                : item.type === 'UPI Payment' ? '#3f51b5' : '#1565c0'
                            }}>
                              {item.type}
                            </span>
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '3px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <StickyNote size={11} /> {item.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: '#27ae60', fontSize: '16px' }}>
                            ₹{item.amount}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {item.payment_mode === 'cash' || item.payment_mode === null ? <><Banknote size={10} /> Cash</> : <><Smartphone size={10} /> {item.payment_mode}</>}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteModal({
                            type: item.type === 'Order Payment' && item.id
                              ? (item.is_advance
                                  ? (item.payment_mode === 'cash' ? 'order_advance_cash' : 'order_advance_upi')
                                  : 'order_payment')
                              : (item.type === 'UPI Payment'
                                  ? (item.source === 'cash_income' ? 'cash_income' : 'upi_income')
                                  : 'cash_income'),
                            id: item.id,
                            label: `${item.party_name} — ₹${item.amount} (${item.type})`
                          })}
                          style={{
                            backgroundColor: '#800000', color: '#fff', border: '1px solid #800000',
                            borderRadius: '4px', padding: '3px 8px', fontSize: '11px',
                            cursor: 'pointer', marginLeft: '8px', whiteSpace: 'nowrap'
                          }}
                          title="Delete this entry"
                        ><Trash2 size={12} /></button>
                      </div>
                    ))
                  )}

                  {ledgerByDate.income.length > 0 && (
                    <div style={styles.ledgerTotal}>
                      <span>Total Income</span>
                      <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '18px' }}>
                        ₹{ledgerByDate.total_income}
                      </span>
                    </div>
                  )}
                </div>

                {/* EXPENSE SECTION */}
                <div style={styles.ledgerSection}>
                  <div style={{ ...styles.ledgerSectionHeader, borderLeft: '4px solid #e74c3c' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Receipt size={14} /> Expenses</span>
                    <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>₹{ledgerByDate.total_expenses}</span>
                  </div>

                  {ledgerByDate.expenses.length === 0 ? (
                    <div style={styles.ledgerEmpty}>No expenses recorded for this date.</div>
                  ) : (
                    ledgerByDate.expenses.map((exp, i) => (
                      <div key={i} style={styles.ledgerRow}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                            {exp.party_name || exp.category}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                            <span style={{ ...styles.typeBadge, backgroundColor: '#fff0f0', color: '#e74c3c' }}>
                              {exp.category}
                            </span>
                          </div>
                          {exp.description && (
                            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>
                              {exp.description}
                            </div>
                          )}
                          {exp.notes && (
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '3px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <StickyNote size={11} /> {exp.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '16px' }}>
                            ₹{exp.amount}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {exp.payment_mode === 'upi' ? <><Smartphone size={10} /> {exp.upi_account || 'UPI'}</> : <><Banknote size={10} /> Cash</>}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteModal({
                            type: 'expense',
                            id: exp.id,
                            label: `${exp.party_name} — ₹${exp.amount} (${exp.category || 'Expense'})`
                          })}
                          style={{
                            backgroundColor: '#800000', color: '#fff', border: '1px solid #800000',
                            borderRadius: '4px', padding: '3px 8px', fontSize: '11px',
                            cursor: 'pointer', marginLeft: '8px', whiteSpace: 'nowrap'
                          }}
                          title="Delete this entry"
                        ><Trash2 size={12} /></button>
                      </div>
                    ))
                  )}

                  {ledgerByDate.expenses.length > 0 && (
                    <div style={{ ...styles.ledgerTotal, borderTop: '2px solid #e74c3c' }}>
                      <span>Total Expenses</span>
                      <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '18px' }}>
                        ₹{ledgerByDate.total_expenses}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                ...styles.netToday,
                marginTop: '16px',
                backgroundColor: ledgerByDate.net >= 0 ? '#f0fff4' : '#fff5f5',
                border: `1px solid ${ledgerByDate.net >= 0 ? '#d4edda' : '#fdd'}`
              }}>
                <span style={{ fontSize: '16px' }}>
                  Net for {new Date(ledgerByDate.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                </span>
                <strong style={{ fontSize: '24px', color: ledgerByDate.net >= 0 ? '#27ae60' : '#e74c3c' }}>
                  ₹{ledgerByDate.net}
                </strong>
              </div>
            </div>
          )}

          {!ledgerByDate && !ledgerLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <p style={{ fontSize: '16px' }}>Select a date and click "Load Ledger"</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Today is {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB: GALLA HISAAB (live denomination drawer) */}
      {activeTab === 'galla' && (
        <div>
          {/* Note-wise Cash Tracking — master ON/OFF switch */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: '#fff', padding: '14px 18px', borderRadius: '8px',
            marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} /> Note-wise Cash Tracking
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', maxWidth: '480px' }}>
                ON hone par Orders, Sales, Salary aur Vendor — sabme cash amount seedha type nahi hoga,
                sirf denomination-counter ("Use this total") se hi bharna hoga.
              </div>
            </div>
            <button
              onClick={toggleNoteTracking}
              disabled={settingLoading}
              style={{
                backgroundColor: noteTrackingEnabled ? '#27ae60' : '#ccc',
                color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '20px',
                cursor: settingLoading ? 'not-allowed' : 'pointer', fontSize: '13px',
                fontWeight: 'bold', opacity: settingLoading ? 0.6 : 1, minWidth: '70px'
              }}
            >
              {settingLoading ? '...' : (noteTrackingEnabled ? 'ON' : 'OFF')}
            </button>
          </div>

          {!noteTrackingEnabled && (
            <div style={{
              textAlign: 'center', padding: '40px', color: '#888',
              backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <p style={{ fontSize: '15px' }}>Note-wise Cash Tracking abhi OFF hai.</p>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>Upar switch ON karo Galla count set karne aur track karne ke liye.</p>
            </div>
          )}

          {noteTrackingEnabled && (
          <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calculator size={17} /> Galla Hisaab — Live Note Count</h3>
              {drawerData?.baseline_set_at && (
                <p style={{ fontSize: '12px', color: '#888' }}>
                  Last count set: {drawerData.baseline_set_at}
                </p>
              )}
              {!drawerData?.baseline_set_at && (
                <p style={{ fontSize: '12px', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={13} /> Abhi tak koi starting count set nahi hui — "Set Galla Count" se shuru karo.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <LoadingButton onClick={fetchDrawer} loading={drawerLoading} style={{ ...styles.tab, fontSize: '13px' }}><RefreshCw size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Refresh</LoadingButton>
              <button
                onClick={() => setShowBaselineForm(f => !f)}
                style={{ backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                {showBaselineForm ? 'Cancel' : <><Settings size={13} /> Set Galla Count</>}
              </button>
            </div>
          </div>

          {suggestedBaseline !== null && suggestedBaseline > 0 && !showBaselineForm && (
            <div style={{
              backgroundColor: '#e8f4fd', border: '1px solid #3498db',
              borderRadius: '8px', padding: '14px 18px', marginBottom: '16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#1a5276', fontWeight: 'bold', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lightbulb size={13} /> Cash Drawer ki closing balance aaj ki:
                </div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2980b9' }}>
                  ₹{suggestedBaseline}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  Yahi amount Galla baseline mein use karo
                </div>
              </div>
              <button
                onClick={() => {
                  setBaselineCounts({ 500: Math.floor(suggestedBaseline / 500) })
                  setShowBaselineForm(true)
                }}
                style={{
                  backgroundColor: '#2980b9', color: '#fff', border: 'none',
                  padding: '10px 18px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px'
                }}
              >
                <Settings size={13} /> Isi se Set Karo
              </button>
            </div>
          )}

          {showBaselineForm && (
            <div style={{ backgroundColor: '#fff9e6', border: '1px solid #ffc107', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#856404', marginBottom: '12px' }}>
                Abhi physically gin kar jo bhi note drawer me hain, unka exact count daalo. Isi point se aage hisaab track hoga.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                {ALL_DENOMS.map(d => {
                  const count = Number(baselineCounts[d]) || 0
                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #eee' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>₹{d}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" onClick={() => bumpBaseline(d, -1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer' }}>−</button>
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{count}</span>
                        <button type="button" onClick={() => bumpBaseline(d, 1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #27ae60', backgroundColor: '#27ae60', color: '#fff', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Total: ₹{ALL_DENOMS.reduce((s, d) => s + (Number(baselineCounts[d]) || 0) * d, 0)}</strong>
                <LoadingButton
                  loading={baselineSaving}
                  onClick={handleSetBaseline}
                  style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}
                >
                  Save & Start Tracking
                </LoadingButton>
              </div>
            </div>
          )}

          {drawerLoading && <SectionLoader label="Galla data load ho raha hai..." size="small" />}

          {drawerData && !drawerLoading && (
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {ALL_DENOMS.map(d => {
                  const count = drawerData.denominations[d] || 0
                  return (
                    <div key={d} style={{
                      backgroundColor: count < 0 ? '#fff5f5' : '#f8f8f8',
                      padding: '12px', borderRadius: '8px', textAlign: 'center',
                      border: count < 0 ? '1px solid #fdd' : '1px solid transparent'
                    }}>
                      <div style={{ fontSize: '13px', color: '#888' }}>₹{d}</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: count < 0 ? '#e74c3c' : '#1a1a2e' }}>
                        {count}
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaa' }}>₹{count * d}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '2px solid #f0f0f0' }}>
                <span style={{ fontSize: '15px', color: '#555' }}>Total Galla Value</span>
                <strong style={{ fontSize: '26px', color: '#27ae60' }}>₹{drawerData.total_value}</strong>
              </div>
            </div>
          )}

          {/* Set-Galla-Count HISTORY — "ye set kiya hai, iss date ko itna" */}
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: '16px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} /> Set Karne Ki History
            </h4>
            {historyLoading && <SectionLoader label="History load ho rahi hai..." size="small" />}
            {!historyLoading && gallaHistory.length === 0 && (
              <p style={{ color: '#888', fontSize: '13px' }}>Abhi tak koi history nahi hai.</p>
            )}
            {!historyLoading && gallaHistory.map(h => (
              <div key={h.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid #f0f0f0'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{fmtDT(h.set_at)}</div>
                  {h.notes && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{h.notes}</div>}
                </div>
                <div style={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: '15px' }}>₹{h.total}</div>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      )}

    {deleteModal && (
        <div
          onClick={() => { setDeleteModal(null); setDeletePassword('') }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '28px',
              width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '8px', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={17} /> Entry Delete Karo</h3>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>Entry:</p>
            <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fdd',
              borderRadius: '6px', padding: '10px 14px', fontSize: '13px',
              color: '#c0392b', marginBottom: '16px', fontWeight: 'bold' }}>
              {deleteModal.label}
            </div>
            <p style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertTriangle size={13} /> Ye entry permanently delete hogi aur sab jagah se hat jaegi. Password daalo:
            </p>
            <form onSubmit={handleLedgerDelete}>
              <input
                type="password"
                placeholder="Enter password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                autoFocus
                style={{ ...styles.input, marginBottom: '16px', fontSize: '18px',
                  letterSpacing: '4px', textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setDeleteModal(null); setDeletePassword('') }}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px',
                    border: '1px solid #ddd', backgroundColor: '#fff',
                    cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <LoadingButton
                  loading={deleteLoading}
                  loadingText="Deleting..."
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px',
                    border: '1px solid #800000', backgroundColor: '#800000', color: '#fff',
                    fontSize: '14px', fontWeight: 'bold' }}
                >
                  <Trash2 size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Delete
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENABLE-TRACKING MODAL — OFF se ON karte waqt, fresh baseline lazmi */}
      {showEnableModal && (
        <div
          onClick={() => { setShowEnableModal(false); setBaselineCounts({}) }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
              width: '640px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '6px', color: '#27ae60', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={17} /> Note-wise Cash Tracking ON Karo
            </h3>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px' }}>
              Tracking shuru karne se pehle abhi drawer mein jo bhi note physically hain, unka fresh count set karo.
              Isi count se aage ka hisaab track hoga.
            </p>

            {suggestedBaseline !== null && suggestedBaseline > 0 && (
              <div style={{
                backgroundColor: '#e8f4fd', border: '1px solid #3498db',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '14px'
              }}>
                <div style={{ fontSize: '11px', color: '#1a5276', fontWeight: 'bold' }}>
                  Cash Drawer ki closing balance aaj ki: ₹{suggestedBaseline}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  Reference ke liye — count phir bhi physically gin kar hi bharo
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              {ALL_DENOMS.map(d => {
                const count = Number(baselineCounts[d]) || 0
                return (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9f9f9', padding: '8px 10px', borderRadius: '6px', border: '1px solid #eee' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>₹{d}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button type="button" onClick={() => bumpBaseline(d, -1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer' }}>−</button>
                      <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{count}</span>
                      <button type="button" onClick={() => bumpBaseline(d, 1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #27ae60', backgroundColor: '#27ae60', color: '#fff', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <strong>Total: ₹{ALL_DENOMS.reduce((s, d) => s + (Number(baselineCounts[d]) || 0) * d, 0)}</strong>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowEnableModal(false); setBaselineCounts({}) }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <LoadingButton
                loading={enableSaving}
                type="button"
                onClick={handleEnableTracking}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#27ae60', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
              >
                Set & Turn ON
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* DISABLE-TRACKING WARNING — ON se OFF karte waqt */}
      {showDisableModal && (
        <div
          onClick={() => setShowDisableModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
              width: '420px', maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '10px', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={17} /> Tracking OFF Karna Chahte Ho?
            </h3>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '10px', lineHeight: 1.5 }}>
              OFF karte hi Note Counting (denomination counter) ka option Orders, Sales,
              Expense, Salary, aur Vendor — sabhi jagah se hat jaayega. Amount ab seedha
              type karna padega.
            </p>
            <p style={{ fontSize: '13px', color: '#e74c3c', marginBottom: '20px', lineHeight: 1.5 }}>
              Galla count tracking bhi ruk jaayegi — jab tak dubara ON na karo, notes ka
              hisaab match nahi hoga.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDisableModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <LoadingButton
                loading={disableSaving}
                type="button"
                onClick={handleDisableTracking}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#e67e22', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
              >
                Haan, OFF Karo
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const categoryColors = {
  'Raw Material (Pipe/Flex)': '#8e44ad',
  'Employee Advance': '#2980b9',
  'Ghar Khata': '#e67e22',
  'Tea / Refreshments': '#e67e22',
  'Petrol / Transport': '#16a085',
  'Electricity Bill': '#f39c12',
  'Vendor Payment': '#c0392b',
  'Ink Purchase': '#1a1a2e',
  'Rent': '#7f8c8d',
  'Miscellaneous': '#95a5a6'
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  messageError: { backgroundColor: '#fff3f3', color: '#c0392b' },
  filterRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
  summaryRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  summaryCard: { backgroundColor: '#fff', padding: '20px 28px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flex: '1', minWidth: '140px' },
  summaryNum: { fontSize: '26px', fontWeight: 'bold', marginBottom: '4px' },
  summaryLabel: { fontSize: '12px', color: '#888' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  todayBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  todayRow: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' },
  todayCard: { flex: '1', minWidth: '180px', backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px' },
  todayCardLabel: { fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' },
  paymentLine: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #eee' },
  netToday: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fff4', padding: '16px', borderRadius: '8px', border: '1px solid #d4edda' },
  twoCol: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  formBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: '1', minWidth: '280px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' },
  ledgerDateHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '16px 20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flexWrap: 'wrap', gap: '12px' },
  ledgerGrid: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  ledgerSection: { flex: '1', minWidth: '280px', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  ledgerSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: '#f8f8f8', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '15px', borderLeft: '4px solid #27ae60' },
  ledgerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #f5f5f5' },
  ledgerEmpty: { padding: '20px 16px', color: '#888', fontSize: '14px', textAlign: 'center' },
  ledgerTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '2px solid #27ae60', backgroundColor: '#f9f9f9', fontWeight: 'bold' },
  typeBadge: { padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' },
  greenBtn: { backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '15px', width: '100%' },
  redBtn: { backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', width: '100%' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '200px', overflowY: 'auto' },
  dropdownItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
  selectedCustomerBadge: { marginTop: '8px', padding: '8px 12px', backgroundColor: '#e8f5e9', borderRadius: '6px', fontSize: '13px', color: '#27ae60', fontWeight: 'bold', border: '1px solid #c3e6cb' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  expenseGroup: { backgroundColor: '#fff', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  expenseDateHeader: { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f8f8f8', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #eee' },
  expenseRow: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: '12px' },
  expenseCategoryDot: (category) => ({
    width: '12px', height: '12px', borderRadius: '50%',
    backgroundColor: categoryColors[category] || '#95a5a6',
    flexShrink: 0
  }),
  deleteBtn: { backgroundColor: '#800000', color: '#fff', border: '1px solid #800000', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }
}

export default DailySales