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
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import SectionCard from '../components/ui/SectionCard'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { SecondaryButton } from '../components/ui/Button'
import {
  Wallet, ClipboardList, Receipt, NotebookPen, Calculator,
  BarChart3, CreditCard, Banknote, Smartphone, User, Store,
  Coins, AlertTriangle, CheckCircle2, Phone, Clock, Trash2,
  RefreshCw, Settings, Lightbulb, StickyNote, X, TrendingUp, TrendingDown,
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
const CATEGORY_TONES = {
  'Raw Material (Pipe/Flex)': 'bg-purple-500',
  'Employee Advance': 'bg-blue-500',
  'Ghar Khata': 'bg-orange-500',
  'Tea / Refreshments': 'bg-orange-400',
  'Petrol / Transport': 'bg-teal-500',
  'Electricity Bill': 'bg-amber-500',
  'Vendor Payment': 'bg-red-500',
  'Ink Purchase': 'bg-slate-400',
  'Rent': 'bg-slate-500',
  'Miscellaneous': 'bg-slate-400',
  'Commission': 'bg-amber-400',
}

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

// Denomination stepper grid — used both for setting a fresh Galla baseline
// and for the Enable-Tracking modal. Purely presentational, callback-driven.
function DenomStepperGrid({ counts, onBump }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
      {ALL_DENOMS.map(d => {
        const count = Number(counts[d]) || 0
        return (
          <div key={d} className="flex items-center justify-between bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2">
            <span className="font-bold text-sm text-slate-200">₹{d}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onBump(d, -1)} className="w-6 h-6 rounded-full border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center">−</button>
              <span className="min-w-[20px] text-center font-bold text-white">{count}</span>
              <button type="button" onClick={() => onBump(d, 1)} className="w-6 h-6 rounded-full border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 flex items-center justify-center">+</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
  // Tracking OFF→ON popup — requires a fresh denomination count + baseline set before it turns on
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

  // The tracking setting isn't just needed on the Galla tab — Record Entry
  // (cash income + expense) also needs to know immediately whether to show
  // the denomination counter, so it's fetched on mount.
  useEffect(() => {
    fetchNoteTrackingSetting()
    fetchDrawer()
  }, [])

  // Message auto-clears, and clears immediately on tab change too — otherwise
  // an "Entry saved" banner could still show up on the Cash Drawer or Galla
  // Hisaab tab.
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

  // Denomination order — same as DenominationCounter.jsx, largest to smallest
  const DENOM_ORDER = [500, 200, 100, 50, 20, 10, 5, 2, 1]

  function sumDenom(counts) {
    return Object.values(counts || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  }

  function hasBreakdown(item) {
    if (!item.denomination_breakdown) return false
    const { received, returned } = item.denomination_breakdown
    return sumDenom(received) > 0 || sumDenom(returned) > 0
  }

  function renderDenomChips(counts, tone) {
    const entries = DENOM_ORDER.map(d => [d, Number(counts?.[d]) || 0]).filter(([, c]) => c > 0)
    if (entries.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([d, c]) => (
          <span
            key={d}
            className={`text-[11px] font-bold px-2 py-1 rounded-md ${
              tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}
          >
            ₹{d} × {c}
          </span>
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
        // If this key was never set (fresh install), default to ON so
        // shops already relying on Galla Hisaab don't lose anything.
        setNoteTrackingEnabled(res.data.value === null ? true : res.data.value === 'true')
      })
      .catch(() => {})
      .finally(() => setSettingLoading(false))
  }

  function toggleNoteTracking() {
    if (!noteTrackingEnabled) {
      // OFF → ON: don't flip it straight away — a fresh physical count is required first.
      setBaselineCounts({})
      setShowEnableModal(true)
      return
    }
    // ON → OFF: warn first, since turning it off removes the denomination
    // counter option from Orders/Sales/Expense/Salary/Vendor everywhere.
    setShowDisableModal(true)
  }

  function handleDisableTracking() {
    setDisableSaving(true)
    setSetting('note_tracking_enabled', false)
      .then(() => {
        setNoteTrackingEnabled(false)
        setShowDisableModal(false)
        showMsg('Note-wise Cash Tracking turned OFF.')
      })
      .catch(() => showMsg('Could not update the setting.', 'error'))
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
        showMsg('Galla count set — reflected in Cash Drawer too ✅')
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
    // A fresh baseline is saved first, only then does the setting turn ON —
    // so tracking always starts from a verified count.
    setDrawerBaseline({ denomination_counts: baselineCounts, notes: 'Tracking ON — fresh galla count' })
      .then(() => setSetting('note_tracking_enabled', true))
      .then(() => {
        setNoteTrackingEnabled(true)
        setShowEnableModal(false)
        setBaselineCounts({})
        showMsg('Note-wise Cash Tracking turned ON — fresh galla count set ✅')
        fetchDrawer()
        fetchGallaHistory()
      })
      .catch(() => showMsg('Error turning tracking on — try again.', 'error'))
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
    if (!deletePassword) return showMsg('Enter the password.', 'error')
    setDeleteLoading(true)
    deleteLedgerEntry(deletePassword, deleteModal.type, deleteModal.id)
      .then(() => {
        showMsg('Entry deleted ✅')
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
      return showMsg('Select a customer for the commission.', 'error')
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
      .catch(err => showMsg(err.response?.data?.error || 'Error adding expense.', 'error'))
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

  const TABS = [
    { key: 'today',    label: 'Record Entry',  icon: ClipboardList },
    { key: 'history',  label: 'Cash Drawer',   icon: Wallet },
    { key: 'expenses', label: 'Expense List',  icon: Receipt },
    { key: 'ledger',   label: 'Daily Ledger',  icon: NotebookPen },
    { key: 'galla',    label: 'Galla Hisaab',  icon: Calculator },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Sales & Expenses" subtitle="Record income/expenses, reconcile the cash drawer, and track the note-wise till" />

      {message && (
        <p
          onClick={() => setMessage('')}
          className={`px-4 py-3 rounded-xl cursor-pointer text-sm ${
            messageType === 'error'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}
        >
          {message}
        </p>
      )}

      {/* MONTH FILTER */}
      <div className="flex gap-3">
        <select className={`${inputClasses} max-w-[160px]`} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
          ))}
        </select>
        <select className={`${inputClasses} max-w-[110px]`} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {['2024', '2025', '2026', '2027'].map(y => (<option key={y} value={y}>{y}</option>))}
        </select>
      </div>

      {/* MONTHLY SUMMARY CARDS */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Sales" value={`₹${summary.total_sales || 0}`} valueClassName="text-emerald-400" sub={`incl. ₹${summary.payments_total || 0} from orders`} icon={TrendingUp} tone="emerald" />
          <StatCard label="Total Expenses" value={`₹${summary.total_expenses || 0}`} valueClassName="text-red-400" icon={TrendingDown} tone="red" />
          <StatCard label="Net Profit" value={`₹${summary.net_profit || 0}`} valueClassName={(summary.net_profit || 0) >= 0 ? 'text-white' : 'text-red-400'} icon={Wallet} tone={(summary.net_profit || 0) >= 0 ? 'blue' : 'red'} />
          <StatCard label="Days Recorded" value={summary.days_recorded || 0} icon={BarChart3} tone="blue" />
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={async () => {
                setActiveTab(t.key)
                if (t.key === 'galla') {
                  fetchDrawer()
                  fetchNoteTrackingSetting()
                  fetchGallaHistory()
                  try {
                    const res = await getCashDrawer(today)
                    setSuggestedBaseline(res.data?.closing_balance ?? 0)
                  } catch {
                    setSuggestedBaseline(null)
                  }
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ══════════════════ TAB: RECORD ENTRY ══════════════════ */}
      {activeTab === 'today' && (
        <div className="space-y-5">
          {todayData && (
            <Card>
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Today's Summary — {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Payments from Orders</div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">₹{todayData.payments_total || 0}</div>
                  {todayData.payments_received && todayData.payments_received.length > 0 ? (
                    <div className="mt-2.5 space-y-1">
                      {todayData.payments_received.map(p => (
                        <div key={p.id} className="flex justify-between text-xs py-1 border-b border-slate-800/60">
                          <div>
                            <span className="text-slate-300">{p.firm_name}</span>
                            <div className="text-[11px] text-slate-500">{fmtDT(p.created_at || p.payment_date)}</div>
                          </div>
                          <span className="font-bold text-emerald-400">₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-xs text-slate-500 mt-2">No order payments today</div>}
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Other Cash Received</div>
                  <div className="text-2xl font-bold text-blue-400 font-mono">₹{todayData.cash_income_total || 0}</div>
                  {todayData.cash_income_today && todayData.cash_income_today.length > 0 ? (
                    <div className="mt-2.5 space-y-1">
                      {todayData.cash_income_today.map(c => (
                        <div key={c.id} className="flex justify-between text-xs py-1 border-b border-slate-800/60">
                          <div>
                            <span className="text-slate-300">{c.firm_name}</span>
                            <div className="text-[11px] text-slate-500">{fmtDT(c.income_date || c.created_at)}</div>
                          </div>
                          <span className="font-bold text-blue-400">₹{c.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-xs text-slate-500 mt-2">No cash income today</div>}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-slate-400 mb-2">Total Payment In Today</div>
                  <div className="text-3xl font-bold text-white font-mono">₹{todayData.total_cash_in || 0}</div>
                  <div className="text-xs text-slate-500 mt-2">orders + cash income + UPI</div>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-red-400/90 mb-2 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Expenses Today</div>
                  <div className="text-2xl font-bold text-red-400 font-mono">₹{todayData.total_expenses || 0}</div>
                </div>
              </div>

              {todayData.upi_by_account && todayData.upi_by_account.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 mb-3">
                  <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> UPI Received Today — ₹{todayData.upi_total}</div>
                  <div className="flex gap-3 flex-wrap">
                    {todayData.upi_by_account.map(u => (
                      <div key={u.upi_account} className="bg-slate-900 rounded-xl px-3.5 py-2.5 min-w-[160px]">
                        <div className="text-base font-bold text-emerald-400">₹{u.total}</div>
                        <div className="text-xs text-slate-300">{u.upi_account}</div>
                        <div className="text-[11px] text-slate-500">{u.count} transaction(s)</div>
                      </div>
                    ))}
                  </div>
                  {todayData.upi_detail && todayData.upi_detail.length > 0 && (
                    <div className="mt-2.5 space-y-1">
                      {todayData.upi_detail.map(t => (
                        <div key={t.id} className="flex justify-between text-xs py-1 border-b border-slate-800/60">
                          <span className="text-slate-300">{t.customer_name || t.customer_firm || 'Unknown'} → {t.upi_account}</span>
                          <span className="font-bold text-emerald-400">₹{t.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {todayData.cheques_today && todayData.cheques_today.length > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-3">
                  <div className="text-[11px] font-bold text-purple-400 mb-2 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Cheques Received Today — ₹{todayData.cheque_total}</div>
                  {todayData.cheques_today.map(c => (
                    <div key={c.id} className="flex justify-between text-xs py-1.5">
                      <span className="text-slate-300">{c.firm_name} • {c.bank_name || 'Unknown Bank'} • #{c.cheque_number || 'No number'}</span>
                      <span className="font-bold text-purple-400">₹{c.amount}</span>
                    </div>
                  ))}
                  <div className="text-[11px] text-slate-500 mt-1.5">Note: Cheque amounts are NOT counted in cash total until cleared</div>
                </div>
              )}

              <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3.5">
                <span className="text-sm text-slate-300">Net Today (Cash In − Expenses):</span>
                <strong className={`text-xl font-mono ${((todayData.total_cash_in || 0) - (todayData.total_expenses || 0)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ₹{(todayData.total_cash_in || 0) - (todayData.total_expenses || 0)}
                </strong>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <h3 className="text-emerald-400 font-bold mb-1 flex items-center gap-2"><Banknote className="w-4 h-4" /> Record Other Payment</h3>
              <p className="text-xs text-slate-500 mb-4">Cash received from a customer — not linked to a specific order</p>
              <form onSubmit={handleSaveCashIncome} className="space-y-3">
                <div>
                  <label className={labelClasses}>Date</label>
                  <input className={inputClasses} type="date" value={cashForm.income_date} onChange={e => setCashForm(f => ({ ...f, income_date: e.target.value }))} />
                </div>

                <div className="relative">
                  <label className={labelClasses}>Customer *</label>
                  <input
                    className={`${inputClasses} ${!selectedCustomer && customerSearch ? '!border-red-500/60' : ''}`}
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
                    <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[100] max-h-[200px] overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => handleSelectCustomer(c)}
                          className="px-3.5 py-2.5 cursor-pointer border-b border-slate-700/60 last:border-0 hover:bg-slate-700/60 text-sm"
                        >
                          <span className="font-bold text-slate-200">{c.firm_name}</span>
                          {c.contact_name && <span className="text-xs text-slate-500 ml-2">{c.contact_name}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedCustomer && (
                    <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {selectedCustomer.firm_name}
                      {selectedCustomer.phone && (
                        <span className="text-slate-400 font-normal ml-1.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedCustomer.phone}</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClasses}>Payment Mode *</label>
                  <select
                    className={inputClasses}
                    value={cashForm.payment_mode}
                    onChange={e => setCashForm({ ...cashForm, payment_mode: e.target.value, upi_account: e.target.value === 'cash' ? '' : cashForm.upi_account })}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                {cashForm.payment_mode === 'upi' && (
                  <div>
                    <label className={labelClasses}>UPI Account *</label>
                    <select className={inputClasses} value={cashForm.upi_account} onChange={e => setCashForm({ ...cashForm, upi_account: e.target.value })}>
                      <option value="">Select UPI Account</option>
                      {UPI_ACCOUNTS.map(acc => (<option key={acc} value={acc}>{acc}</option>))}
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

                <div>
                  <label className={labelClasses}>Amount (₹) *</label>
                  <input
                    className={`${inputClasses} text-lg font-bold`}
                    type="number" placeholder="e.g. 500"
                    value={cashForm.amount}
                    onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                    readOnly={cashForm.payment_mode === 'cash' && noteTrackingEnabled}
                  />
                  {cashForm.payment_mode === 'cash' && noteTrackingEnabled && (
                    <div className="text-[11px] text-slate-500 mt-1">Fill this from the Note Counting above</div>
                  )}
                </div>

                <div>
                  <label className={labelClasses}>Notes (optional)</label>
                  <input className={inputClasses} placeholder="e.g. Partial payment for banner" value={cashForm.notes} onChange={e => setCashForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <LoadingButton
                  loading={cashSubmitting}
                  disabled={!selectedCustomer}
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/20"
                >
                  Save Entry
                </LoadingButton>
              </form>
            </Card>

            <Card>
              <h3 className="text-red-400 font-bold mb-1 flex items-center gap-2"><Receipt className="w-4 h-4" /> Add Expense</h3>
              <p className="text-xs text-slate-500 mb-4">Record any cash going out of the shop today</p>
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div>
                  <label className={labelClasses}>Date</label>
                  <input className={inputClasses} type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
                </div>

                <div>
                  <label className={labelClasses}>Category *</label>
                  <select
                    className={inputClasses}
                    value={expenseForm.category}
                    onChange={e => {
                      const cat = e.target.value
                      setExpenseForm({
                        ...expenseForm, category: cat,
                        paid_to_type: cat === 'Employee Advance' ? 'employee' : cat === 'Vendor Payment' ? 'vendor' : null,
                        paid_to_id: '', customer_id: '', customer_name: ''
                      })
                      if (cat !== 'Commission') { setCommSelectedCustomer(null); setCommCustomerSearch('') }
                    }}
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>

                {expenseForm.category === 'Employee Advance' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <label className="text-[11px] font-semibold text-amber-400 block mb-1.5 flex items-center gap-1.5"><User className="w-3 h-3" /> Select Employee * (required for advance)</label>
                    <select className={inputClasses} value={expenseForm.paid_to_id || ''} onChange={e => setExpenseForm({ ...expenseForm, paid_to_id: e.target.value })}>
                      <option value="">-- Select Employee --</option>
                      {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name} (₹{Math.round(emp.monthly_salary / 30)}/day)</option>))}
                    </select>
                  </div>
                )}

                {expenseForm.category === 'Vendor Payment' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <label className="text-[11px] font-semibold text-blue-400 block mb-1.5 flex items-center gap-1.5"><Store className="w-3 h-3" /> Select Vendor * (required for vendor payment)</label>
                    <select className={inputClasses} value={expenseForm.paid_to_id || ''} onChange={e => setExpenseForm({ ...expenseForm, paid_to_id: e.target.value })}>
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (<option key={v.id} value={v.id}>{v.name} — {v.shop_type} (Due: ₹{v.balance_due})</option>))}
                    </select>
                  </div>
                )}

                {expenseForm.category === 'Commission' && (
                  <div className="relative bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                    <label className="text-[11px] font-bold text-orange-400 block mb-1.5 flex items-center gap-1.5"><Coins className="w-3 h-3" /> Select Customer * (required for commission)</label>
                    <input
                      className={`${inputClasses} ${!commSelectedCustomer && commCustomerSearch ? '!border-red-500/60' : '!border-orange-500/40'}`}
                      type="text"
                      placeholder="Search customer name..."
                      value={commCustomerSearch}
                      onChange={e => {
                        setCommCustomerSearch(e.target.value)
                        setShowCommDropdown(true)
                        if (commSelectedCustomer) { setCommSelectedCustomer(null); setExpenseForm(f => ({ ...f, customer_id: '', customer_name: '' })) }
                      }}
                      onFocus={() => setShowCommDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCommDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {showCommDropdown && customers.filter(c => c.firm_name.toLowerCase().includes(commCustomerSearch.toLowerCase())).length > 0 && (
                      <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[100] max-h-[200px] overflow-y-auto">
                        {customers.filter(c => c.firm_name.toLowerCase().includes(commCustomerSearch.toLowerCase())).map(c => (
                          <div
                            key={c.id}
                            onMouseDown={() => {
                              setCommSelectedCustomer(c)
                              setCommCustomerSearch(c.firm_name)
                              setShowCommDropdown(false)
                              setExpenseForm(f => ({ ...f, customer_id: c.id, customer_name: c.firm_name }))
                            }}
                            className="px-3.5 py-2.5 cursor-pointer border-b border-slate-700/60 last:border-0 hover:bg-slate-700/60 text-sm"
                          >
                            <span className="font-bold text-slate-200">{c.firm_name}</span>
                            {c.phone && <span className="text-xs text-slate-500 ml-2 inline-flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {c.phone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {commSelectedCustomer && (
                      <div className="mt-2 px-3 py-2 bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {commSelectedCustomer.firm_name}
                      </div>
                    )}
                    <div className="text-[11px] text-orange-400 mt-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> This amount is being returned to the customer — deducted from Cash Drawer / UPI</div>
                  </div>
                )}

                <div>
                  <label className={labelClasses}>Payment Mode</label>
                  <select className={inputClasses} value={expenseForm.payment_mode || 'cash'} onChange={e => setExpenseForm({ ...expenseForm, payment_mode: e.target.value, upi_account: '' })}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                {expenseForm.payment_mode === 'upi' && (
                  <div>
                    <label className={labelClasses}>UPI Account Used</label>
                    <select className={inputClasses} value={expenseForm.upi_account || ''} onChange={e => setExpenseForm({ ...expenseForm, upi_account: e.target.value })}>
                      <option value="">Select UPI Account</option>
                      {UPI_ACCOUNTS.map(acc => (<option key={acc} value={acc}>{acc}</option>))}
                    </select>
                  </div>
                )}

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

                <div>
                  <label className={labelClasses}>Amount (₹) *</label>
                  <input
                    className={`${inputClasses} text-base font-bold`}
                    type="number" placeholder="0"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    readOnly={(expenseForm.payment_mode || 'cash') === 'cash' && noteTrackingEnabled}
                  />
                  {(expenseForm.payment_mode || 'cash') === 'cash' && noteTrackingEnabled && (
                    <div className="text-[11px] text-slate-500 mt-1">Fill this from the Note Counting above</div>
                  )}
                </div>

                <div>
                  <label className={labelClasses}>Description</label>
                  <input className={inputClasses} placeholder="e.g. 2 pipes bought, tea for 3 people" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                </div>

                <LoadingButton loading={expenseSubmitting} type="submit" className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20">
                  Add Expense
                </LoadingButton>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: CASH DRAWER ══════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className={labelClasses}>Select Date</label>
              <input className={`${inputClasses} max-w-[200px]`} type="date" value={cashDrawerDate} onChange={e => setCashDrawerDate(e.target.value)} />
            </div>
            <LoadingButton
              loading={cashDrawerLoading}
              onClick={() => fetchCashDrawer(cashDrawerDate)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
            >
              <Wallet className="w-3.5 h-3.5" /> Load Cash Drawer
            </LoadingButton>
          </div>

          {cashDrawerLoading && <SectionLoader label="Loading cash drawer..." size="small" />}

          {!cashDrawer && !cashDrawerLoading && (
            <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-base">Select a date and click "Load Cash Drawer"</p>
              <p className="text-xs mt-2">Shows only physical cash — UPI and cheques excluded</p>
            </div>
          )}

          {cashDrawer && (
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
                <h3 className="text-white font-bold flex items-center gap-2"><Wallet className="w-4 h-4" /> Cash Drawer — {new Date(cashDrawer.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <div className="flex gap-4 flex-wrap text-sm">
                  <span className="font-bold text-emerald-400">Cash In: ₹{cashDrawer.total_cash_in}</span>
                  <span className="font-bold text-red-400">Cash Out: ₹{cashDrawer.total_cash_out}</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-amber-500/10 border-l-4 border-amber-500 rounded-xl px-5 py-4">
                <div>
                  <div className="text-xs font-bold text-amber-400">Opening Balance (Carried Forward)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Cash in drawer at start of day</div>
                </div>
                <div className="text-2xl font-bold text-amber-400 font-mono">₹{cashDrawer.opening_balance}</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Cash In" action={<span className="font-bold text-emerald-400">₹{cashDrawer.total_cash_in}</span>}>
                  {cashDrawer.cash_in.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No cash received on this date.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {cashDrawer.cash_in.map((item, i) => {
                        const key = `in-${i}`
                        const expandable = hasBreakdown(item)
                        const isExpanded = expandedDrawerKey === key
                        return (
                          <Fragment key={key}>
                            <div
                              onClick={() => expandable && setExpandedDrawerKey(isExpanded ? null : key)}
                              className={`flex justify-between items-start gap-3 py-3 border-b border-slate-800/60 ${expandable ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-emerald-500/5' : ''}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-white">{item.party_name || '—'}</div>
                                <div className="mt-1">
                                  <Badge tone={item.type === 'Order Payment' ? 'emerald' : 'blue'}>{item.type}</Badge>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {fmtDT(item.created_at || item.payment_date)}</div>
                              </div>
                              <div className="font-bold text-emerald-400 text-base font-mono shrink-0">+₹{item.amount}</div>
                            </div>
                            {isExpanded && (
                              <div className="bg-emerald-500/5 px-1 pb-3.5 pt-1 border-b border-slate-800/60">
                                <div className="flex flex-wrap gap-5">
                                  <div>
                                    <div className="text-[11px] font-bold text-emerald-400 mb-1.5">+ Received</div>
                                    {renderDenomChips(item.denomination_breakdown.received, 'emerald') || <span className="text-xs text-slate-500">—</span>}
                                  </div>
                                  {sumDenom(item.denomination_breakdown.returned) > 0 && (
                                    <div>
                                      <div className="text-[11px] font-bold text-red-400 mb-1.5">− Returned</div>
                                      {renderDenomChips(item.denomination_breakdown.returned, 'red')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Fragment>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Cash Out" action={<span className="font-bold text-red-400">₹{cashDrawer.total_cash_out}</span>}>
                  {cashDrawer.cash_out.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No cash expenses on this date.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {cashDrawer.cash_out.map((exp, i) => {
                        const key = `out-${i}`
                        const expandable = hasBreakdown(exp)
                        const isExpanded = expandedDrawerKey === key
                        return (
                          <Fragment key={key}>
                            <div
                              onClick={() => expandable && setExpandedDrawerKey(isExpanded ? null : key)}
                              className={`flex justify-between items-start gap-3 py-3 border-b border-slate-800/60 ${expandable ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-red-500/5' : ''}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-white">{exp.party_name || exp.category}</div>
                                {exp.description && <div className="text-xs text-slate-500 mt-1">{exp.description}</div>}
                                <div className="mt-1"><Badge tone="red">{exp.category}</Badge></div>
                              </div>
                              <div className="font-bold text-red-400 text-base font-mono shrink-0">-₹{exp.amount}</div>
                            </div>
                            {isExpanded && (
                              <div className="bg-red-500/5 px-1 pb-3.5 pt-1 border-b border-slate-800/60">
                                <div className="flex flex-wrap gap-5">
                                  <div>
                                    <div className="text-[11px] font-bold text-emerald-400 mb-1.5">+ Received</div>
                                    {renderDenomChips(exp.denomination_breakdown.received, 'emerald') || <span className="text-xs text-slate-500">—</span>}
                                  </div>
                                  {sumDenom(exp.denomination_breakdown.returned) > 0 && (
                                    <div>
                                      <div className="text-[11px] font-bold text-red-400 mb-1.5">− Returned (change)</div>
                                      {renderDenomChips(exp.denomination_breakdown.returned, 'red')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Fragment>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className={`flex justify-between items-center rounded-2xl px-6 py-5 border-2 ${cashDrawer.closing_balance >= 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                <div>
                  <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Closing Cash Drawer Balance</div>
                  <div className="text-xs text-slate-500 mt-1">₹{cashDrawer.opening_balance} opening + ₹{cashDrawer.total_cash_in} in − ₹{cashDrawer.total_cash_out} out</div>
                </div>
                <div className={`text-3xl font-bold font-mono ${cashDrawer.closing_balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{cashDrawer.closing_balance}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TAB: EXPENSE LIST ══════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {Object.keys(groupedExpenses).length === 0 ? (
            <p className="text-slate-500 text-sm">No expenses for this month.</p>
          ) : (
            Object.entries(groupedExpenses).map(([date, exps]) => (
              <Card key={date} padded={false} className="overflow-hidden">
                <div className="flex justify-between px-5 py-3.5 bg-slate-800/40 border-b border-slate-800 font-bold text-sm">
                  <span className="text-white">{new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <span className="text-red-400">Total: ₹{exps.reduce((s, e) => s + e.amount, 0)}</span>
                </div>
                {exps.map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/60 last:border-0">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${CATEGORY_TONES[exp.category] || 'bg-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white">{exp.category}</div>
                      {exp.paid_to_name && (
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                          {exp.paid_to_type === 'employee' ? <><User className="w-3 h-3" /> {exp.paid_to_name}</> : <><Store className="w-3 h-3" /> {exp.paid_to_name}</>}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                        {exp.payment_mode === 'upi' ? <><Smartphone className="w-2.5 h-2.5" /> UPI • {exp.upi_account || 'Unknown'}</> : <><Banknote className="w-2.5 h-2.5" /> Cash</>}
                      </div>
                      {exp.description && <div className="text-xs text-slate-500 mt-1">{exp.description}</div>}
                      {exp.created_at && <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {fmtDT(exp.created_at)}</div>}
                    </div>
                    <div className="font-bold text-red-400 text-base font-mono shrink-0">₹{exp.amount}</div>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center justify-center shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </Card>
            ))
          )}
        </div>
      )}

      {/* ══════════════════ TAB: DAILY LEDGER ══════════════════ */}
      {activeTab === 'ledger' && (
        <div className="space-y-5">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className={labelClasses}>Select Date</label>
              <input className={`${inputClasses} max-w-[200px]`} type="date" value={ledgerDate} onChange={e => setLedgerDate(e.target.value)} />
            </div>
            <LoadingButton
              loading={ledgerLoading}
              onClick={() => fetchLedgerByDate(ledgerDate)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
            >
              <NotebookPen className="w-3.5 h-3.5" /> Load Ledger
            </LoadingButton>
          </div>

          {ledgerLoading && <SectionLoader label="Loading ledger..." size="small" />}

          {ledgerByDate && (
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
                <h3 className="text-white font-bold flex items-center gap-2"><NotebookPen className="w-4 h-4" /> Ledger — {new Date(ledgerByDate.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <div className="flex gap-4 text-sm flex-wrap">
                  <span className="font-bold text-emerald-400">Income: ₹{ledgerByDate.total_income}</span>
                  <span className="font-bold text-red-400">Expenses: ₹{ledgerByDate.total_expenses}</span>
                  <span className={`font-bold ${ledgerByDate.net >= 0 ? 'text-white' : 'text-red-400'}`}>Net: ₹{ledgerByDate.net}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Sales / Income" action={<span className="font-bold text-emerald-400">₹{ledgerByDate.total_income}</span>}>
                  {ledgerByDate.income.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No income recorded for this date.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {ledgerByDate.income.map((item, i) => (
                        <div key={i} className="flex justify-between items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-white">{item.party_name || '—'}</div>
                            <div className="mt-1">
                              <Badge tone={item.type === 'Order Payment' ? 'emerald' : item.type === 'UPI Payment' ? 'blue' : 'sky'}>{item.type}</Badge>
                            </div>
                            {item.notes && <div className="text-xs text-slate-500 mt-1.5 italic flex items-center gap-1"><StickyNote className="w-2.5 h-2.5" /> {item.notes}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-emerald-400 text-base font-mono">₹{item.amount}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-0.5">
                              {item.payment_mode === 'cash' || item.payment_mode === null ? <><Banknote className="w-2.5 h-2.5" /> Cash</> : <><Smartphone className="w-2.5 h-2.5" /> {item.payment_mode}</>}
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteModal({
                              type: item.type === 'Order Payment' && item.id
                                ? (item.is_advance ? (item.payment_mode === 'cash' ? 'order_advance_cash' : 'order_advance_upi') : 'order_payment')
                                : (item.type === 'UPI Payment' ? (item.source === 'cash_income' ? 'cash_income' : 'upi_income') : 'cash_income'),
                              id: item.id,
                              label: `${item.party_name} — ₹${item.amount} (${item.type})`
                            })}
                            className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0"
                            title="Delete this entry"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Expenses" action={<span className="font-bold text-red-400">₹{ledgerByDate.total_expenses}</span>}>
                  {ledgerByDate.expenses.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No expenses recorded for this date.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {ledgerByDate.expenses.map((exp, i) => (
                        <div key={i} className="flex justify-between items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-white">{exp.party_name || exp.category}</div>
                            <div className="mt-1"><Badge tone="red">{exp.category}</Badge></div>
                            {exp.description && <div className="text-xs text-slate-500 mt-1.5">{exp.description}</div>}
                            {exp.notes && <div className="text-xs text-slate-500 mt-1.5 italic flex items-center gap-1"><StickyNote className="w-2.5 h-2.5" /> {exp.notes}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-red-400 text-base font-mono">₹{exp.amount}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-0.5">
                              {exp.payment_mode === 'upi' ? <><Smartphone className="w-2.5 h-2.5" /> {exp.upi_account || 'UPI'}</> : <><Banknote className="w-2.5 h-2.5" /> Cash</>}
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteModal({ type: 'expense', id: exp.id, label: `${exp.party_name} — ₹${exp.amount} (${exp.category || 'Expense'})` })}
                            className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0"
                            title="Delete this entry"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className={`flex justify-between items-center rounded-2xl px-6 py-4 border ${ledgerByDate.net >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <span className="text-sm text-slate-300">Net for {new Date(ledgerByDate.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</span>
                <strong className={`text-2xl font-mono ${ledgerByDate.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{ledgerByDate.net}</strong>
              </div>
            </div>
          )}

          {!ledgerByDate && !ledgerLoading && (
            <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-base">Select a date and click "Load Ledger"</p>
              <p className="text-xs mt-2">Today is {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TAB: GALLA HISAAB ══════════════════ */}
      {activeTab === 'galla' && (
        <div className="space-y-5">
          <Card className="!py-3.5 flex justify-between items-center flex-wrap gap-3">
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Note-wise Cash Tracking</div>
              <div className="text-xs text-slate-400 mt-1 max-w-[480px]">
                When ON, cash amounts in Orders, Sales, Salary, and Vendor can't be typed directly —
                they must be filled from the denomination counter ("Use this total").
              </div>
            </div>
            <button
              onClick={toggleNoteTracking}
              disabled={settingLoading}
              className={`px-5 py-2 rounded-full text-xs font-bold min-w-[70px] transition-all ${
                noteTrackingEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              } ${settingLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {settingLoading ? '...' : (noteTrackingEnabled ? 'ON' : 'OFF')}
            </button>
          </Card>

          {!noteTrackingEnabled && (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-slate-300 text-sm">Note-wise Cash Tracking is currently OFF.</p>
              <p className="text-slate-500 text-xs mt-1.5">Turn the switch above ON to set a galla count and start tracking.</p>
            </div>
          )}

          {noteTrackingEnabled && (
            <>
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h3 className="text-white font-bold flex items-center gap-2"><Calculator className="w-4 h-4" /> Galla Hisaab — Live Note Count</h3>
                  {drawerData?.baseline_set_at ? (
                    <p className="text-xs text-slate-500 mt-1">Last count set: {drawerData.baseline_set_at}</p>
                  ) : (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> No starting count set yet — use "Set Galla Count" to begin.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <LoadingButton
                    onClick={fetchDrawer} loading={drawerLoading}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/80 text-sm font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </LoadingButton>
                  <button
                    onClick={() => setShowBaselineForm(f => !f)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5"
                  >
                    {showBaselineForm ? 'Cancel' : <><Settings className="w-3.5 h-3.5" /> Set Galla Count</>}
                  </button>
                </div>
              </div>

              {suggestedBaseline !== null && suggestedBaseline > 0 && !showBaselineForm && (
                <div className="flex justify-between items-center bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-3.5 flex-wrap gap-3">
                  <div>
                    <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Today's Cash Drawer closing balance:</div>
                    <div className="text-2xl font-bold text-blue-400 font-mono">₹{suggestedBaseline}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Use this amount for the Galla baseline</div>
                  </div>
                  <button
                    onClick={() => { setBaselineCounts({ 500: Math.floor(suggestedBaseline / 500) }); setShowBaselineForm(true) }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" /> Set Using This
                  </button>
                </div>
              )}

              {showBaselineForm && (
                <Card className="!border-amber-500/40">
                  <p className="text-xs text-amber-400 mb-3.5">Physically count what's actually in the drawer right now and enter the exact numbers. Tracking will run from this point forward.</p>
                  <DenomStepperGrid counts={baselineCounts} onBump={bumpBaseline} />
                  <div className="flex justify-between items-center mt-4">
                    <strong className="text-white">Total: ₹{ALL_DENOMS.reduce((s, d) => s + (Number(baselineCounts[d]) || 0) * d, 0)}</strong>
                    <LoadingButton loading={baselineSaving} onClick={handleSetBaseline} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
                      Save & Start Tracking
                    </LoadingButton>
                  </div>
                </Card>
              )}

              {drawerLoading && <SectionLoader label="Loading galla data..." size="small" />}

              {drawerData && !drawerLoading && (
                <Card>
                  <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                    {ALL_DENOMS.map(d => {
                      const count = drawerData.denominations[d] || 0
                      return (
                        <div key={d} className={`rounded-xl p-3 text-center ${count < 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-800/60'}`}>
                          <div className="text-xs text-slate-400">₹{d}</div>
                          <div className={`text-2xl font-bold font-mono ${count < 0 ? 'text-red-400' : 'text-white'}`}>{count}</div>
                          <div className="text-xs text-slate-500">₹{count * d}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between items-center pt-3.5 border-t-2 border-slate-800">
                    <span className="text-sm text-slate-300">Total Galla Value</span>
                    <strong className="text-2xl font-bold text-emerald-400 font-mono">₹{drawerData.total_value}</strong>
                  </div>
                </Card>
              )}

              <Card>
                <h4 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Set-Count History</h4>
                {historyLoading && <SectionLoader label="Loading history..." size="small" />}
                {!historyLoading && gallaHistory.length === 0 && <p className="text-slate-500 text-xs">No history yet.</p>}
                {!historyLoading && gallaHistory.map(h => (
                  <div key={h.id} className="flex justify-between items-center py-2.5 border-b border-slate-800/60 last:border-0">
                    <div>
                      <div className="text-xs font-bold text-slate-200">{fmtDT(h.set_at)}</div>
                      {h.notes && <div className="text-[11px] text-slate-500 mt-0.5">{h.notes}</div>}
                    </div>
                    <div className="font-bold text-white text-sm font-mono">₹{h.total}</div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      )}

      {/* DELETE-ENTRY MODAL (password protected) */}
      <Modal open={!!deleteModal} onClose={() => { setDeleteModal(null); setDeletePassword('') }} width="360px">
        {deleteModal && (
          <>
            <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Entry</h3>
            <p className="text-xs text-slate-400 mb-1.5">Entry:</p>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-400 font-bold mb-4">
              {deleteModal.label}
            </div>
            <p className="text-xs text-red-400 mb-4 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> This entry will be permanently deleted everywhere. Enter password to confirm:</p>
            <form onSubmit={handleLedgerDelete}>
              <input
                type="password" placeholder="Enter password" value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)} autoFocus
                className={`${inputClasses} mb-4 text-lg tracking-widest text-center`}
              />
              <div className="flex gap-2.5">
                <SecondaryButton type="button" className="flex-1 justify-center" onClick={() => { setDeleteModal(null); setDeletePassword('') }}>Cancel</SecondaryButton>
                <LoadingButton loading={deleteLoading} loadingText="Deleting..." type="submit" className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </LoadingButton>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* ENABLE-TRACKING MODAL — OFF→ON, fresh baseline required */}
      <Modal open={showEnableModal} onClose={() => { setShowEnableModal(false); setBaselineCounts({}) }} width="640px">
        <h3 className="text-emerald-400 font-bold mb-1.5 flex items-center gap-2"><Settings className="w-4 h-4" /> Turn ON Note-wise Cash Tracking</h3>
        <p className="text-xs text-slate-400 mb-4">
          Before tracking starts, count exactly what's physically in the drawer right now.
          Tracking will run from this count forward.
        </p>

        {suggestedBaseline !== null && suggestedBaseline > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-3.5 py-2.5 mb-3.5">
            <div className="text-[11px] font-bold text-blue-400">Today's Cash Drawer closing balance: ₹{suggestedBaseline}</div>
            <div className="text-[11px] text-slate-500">For reference — still count physically for the real value</div>
          </div>
        )}

        <DenomStepperGrid counts={baselineCounts} onBump={bumpBaseline} />

        <div className="mt-4 mb-1">
          <strong className="text-white">Total: ₹{ALL_DENOMS.reduce((s, d) => s + (Number(baselineCounts[d]) || 0) * d, 0)}</strong>
        </div>

        <div className="flex gap-2.5 mt-4">
          <SecondaryButton type="button" className="flex-1 justify-center" onClick={() => { setShowEnableModal(false); setBaselineCounts({}) }}>Cancel</SecondaryButton>
          <LoadingButton loading={enableSaving} type="button" onClick={handleEnableTracking} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
            Set & Turn ON
          </LoadingButton>
        </div>
      </Modal>

      {/* DISABLE-TRACKING WARNING — ON→OFF */}
      <Modal open={showDisableModal} onClose={() => setShowDisableModal(false)} width="420px">
        <h3 className="text-amber-400 font-bold mb-2.5 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Turn OFF Tracking?</h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Turning this off removes the Note Counting (denomination counter) option from Orders,
          Sales, Expense, Salary, and Vendor everywhere. Amounts will need to be typed directly.
        </p>
        <p className="text-xs text-red-400 mb-5 leading-relaxed">
          Galla count tracking will also pause — the note-wise count won't match again until you turn it back on.
        </p>
        <div className="flex gap-2.5">
          <SecondaryButton type="button" className="flex-1 justify-center" onClick={() => setShowDisableModal(false)}>Cancel</SecondaryButton>
          <LoadingButton loading={disableSaving} type="button" onClick={handleDisableTracking} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold">
            Yes, Turn OFF
          </LoadingButton>
        </div>
      </Modal>
    </div>
  )
}

export default DailySales