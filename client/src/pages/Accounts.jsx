import { useState, useEffect, Fragment } from 'react'
import PageLock from '../components/PageLock'
import {
  getCheques, addCheque, updateChequeStatus, getChequeSummary, getCheque, updateCheque,
  getUpiTransactions, getUpiSummary, addUpiTransaction,
  getVendors, getVendor, addVendor, updateVendor, deleteVendor,
  addVendorPurchase, addVendorPayment,
  getCustomers, getExpenses, deleteLedgerEntry, getSetting, getDenominationDrawer,
  getCommissionIncome
} from '../services/api'
import DenominationCounter from '../components/DenominationCounter'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { PrimaryButton, SecondaryButton, IconButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'
import {
  Receipt, Smartphone, Store, Coins, Pencil, Trash2, Plus, X,
  Banknote, Building2, Inbox, CheckCircle2, XCircle, Package,
  Clock, AlertTriangle, Lightbulb,
} from 'lucide-react'

const UPI_ACCOUNTS = [
  'Demo UPI Account 1',
  'Demo UPI Account 2',
  'Demo UPI Account 3',
  'Demo UPI Account 4'
]

const BANK_TYPES = ['NEFT', 'RTGS', 'IMPS', 'NACH']

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

const CHEQUE_STATUS_TONE = { received: 'amber', deposited: 'blue', cleared: 'emerald', bounced: 'red' }
const UPI_ACCOUNT_TONE   = ['bg-indigo-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500']

// ─── Vendor form (add / edit) ───────────────────────────────────────────────
function VendorForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', shop_type: '', city: '', notes: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fields = [
    { key: 'name',      label: 'Vendor Name *',       placeholder: 'e.g. SV Traders' },
    { key: 'phone',     label: 'Phone',                placeholder: '9876543210' },
    { key: 'shop_type', label: 'Shop Type / Products',  placeholder: 'e.g. Flex Supplier, Ink' },
    { key: 'city',      label: 'City',                 placeholder: 'e.g. Chandigarh' },
    { key: 'notes',     label: 'Notes',                placeholder: 'Any extra details' },
  ]
  return (
    <div className="space-y-3">
      {fields.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className={labelClasses}>{label}</label>
          <input className={inputClasses} placeholder={placeholder} value={form[key]} onChange={e => set(key, e.target.value)} />
        </div>
      ))}
      <div className="flex gap-2.5 pt-1">
        <SecondaryButton onClick={onCancel} className="flex-1 justify-center">Cancel</SecondaryButton>
        <LoadingButton
          onClick={() => form.name.trim() && onSave(form)}
          disabled={!form.name.trim()}
          loading={saving}
          className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
        >
          {initial ? 'Save Changes' : 'Add Vendor'}
        </LoadingButton>
      </div>
    </div>
  )
}

// ─── Purchase items table editor ────────────────────────────────────────────
function PurchaseItemsEditor({ items, setItems }) {
  const addRow = () => setItems(p => [...p, { id: Date.now(), name: '', qty: '', unit: '', rate: '', amount: '' }])
  const update = (id, key, val) => setItems(p => p.map(r => {
    if (r.id !== id) return r
    const upd = { ...r, [key]: val }
    if (key === 'qty' || key === 'rate') {
      const q = parseFloat(key === 'qty' ? val : r.qty) || 0
      const rt = parseFloat(key === 'rate' ? val : r.rate) || 0
      upd.amount = (q * rt).toFixed(2)
    }
    return upd
  }))
  const remove = id => setItems(p => p.filter(r => r.id !== id))
  const total = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-center mb-2">
        <label className={`${labelClasses} !mb-0`}>Purchase Items</label>
        <button type="button" onClick={addRow} className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 font-bold text-xs">+ Add Item</button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-3.5 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-xs">
          Click "+ Add Item" to list what was purchased
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid gap-2 px-2.5 py-1.5 bg-slate-800/60 text-[11px] font-bold text-slate-500 uppercase" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 28px' }}>
            <span>Item</span><span>Qty</span><span>Unit</span><span>Rate (₹)</span><span>Amount</span><span></span>
          </div>
          {items.map((row, i) => (
            <div
              key={row.id}
              className={`grid gap-2 px-2.5 py-1.5 items-center ${i > 0 ? 'border-t border-slate-800/60' : ''} ${i % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'}`}
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 28px' }}
            >
              {[
                { k: 'name', ph: 'Flex roll, Ink…' },
                { k: 'qty',  ph: '2', tp: 'number' },
                { k: 'unit', ph: 'rolls' },
                { k: 'rate', ph: '0', tp: 'number' },
              ].map(({ k, ph, tp }) => (
                <input
                  key={k} type={tp || 'text'} value={row[k]} placeholder={ph}
                  onChange={e => update(row.id, k, e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none px-1 py-0.5"
                />
              ))}
              <span className="text-sm font-semibold text-slate-200 pl-1">{row.amount || '0'}</span>
              <button type="button" onClick={() => remove(row.id)} className="text-red-400 text-base leading-none">×</button>
            </div>
          ))}
          <div className="flex justify-end px-3 py-2 border-t-2 border-slate-800 bg-slate-800/40 text-sm font-bold text-white">
            Total: ₹{total.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment method selector ─────────────────────────────────────────────────
function PaymentMethodSelector({ method, setMethod, upiAccount, setUpiAccount, bankType, setBankType }) {
  const OPTIONS = [
    { key: 'cash', label: 'Cash', icon: Banknote, tone: 'emerald' },
    { key: 'upi',  label: 'UPI',  icon: Smartphone, tone: 'purple' },
    { key: 'bank', label: 'Bank', icon: Building2, tone: 'blue' },
  ]
  const TONE_CLASSES = {
    emerald: 'border-emerald-500 bg-emerald-500/15 text-emerald-400',
    purple:  'border-purple-500 bg-purple-500/15 text-purple-400',
    blue:    'border-blue-500 bg-blue-500/15 text-blue-400',
  }
  return (
    <div className="mb-3.5">
      <label className={labelClasses}>Payment Method</label>
      <div className="flex gap-2 mb-2.5">
        {OPTIONS.map(o => {
          const Icon = o.icon
          const active = method === o.key
          return (
            <button
              key={o.key} type="button" onClick={() => setMethod(o.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${
                active ? TONE_CLASSES[o.tone] : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {o.label}
            </button>
          )
        })}
      </div>

      {method === 'upi' && (
        <div>
          <label className={labelClasses}>Select UPI Account</label>
          <select value={upiAccount} onChange={e => setUpiAccount(e.target.value)} className={inputClasses}>
            <option value="">-- Select Account --</option>
            {UPI_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {method === 'bank' && (
        <div>
          <label className={labelClasses}>Transfer Type</label>
          <div className="flex gap-2 flex-wrap">
            {BANK_TYPES.map(t => (
              <button
                key={t} type="button" onClick={() => setBankType(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                  bankType === t ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Accounts component ─────────────────────────────────────────────────
function Accounts() {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const currentYear  = String(new Date().getFullYear())

  const [activeTab, setActiveTab]     = useState('cheques')
  const [message, setMessage]         = useState('')
  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterYear, setFilterYear]   = useState(currentYear)

  // ── Cheques ──
  const [cheques, setCheques]             = useState([])
  const [chequeSummary, setChequeSummary] = useState([])
  const [chequeForm, setChequeForm]       = useState({ cheque_number: '', firm_name: '', customer_id: '', bank_name: '', amount: '', received_date: '', order_id: '', notes: '' })
  const [showChequeForm, setShowChequeForm] = useState(false)
  const [selectedCheque, setSelectedCheque] = useState(null)
  const [chequesLoading, setChequesLoading] = useState(false)
  const [chequeDetail, setChequeDetail]     = useState(null)
  const [editingCheque, setEditingCheque]   = useState(false)
  const [chequeEditForm, setChequeEditForm] = useState({})

  // ── UPI ──
  const [upiTransactions, setUpiTransactions] = useState([])
  const [upiSummary, setUpiSummary]           = useState([])
  const [upiForm, setUpiForm]                 = useState({ upi_account: '', customer_name: '', customer_id: '', amount: '', transaction_date: '', utr_number: '', order_id: '', notes: '' })
  const [showUpiForm, setShowUpiForm]         = useState(false)
  const [upiFilter, setUpiFilter]             = useState('')
  const [upiDeleteModal, setUpiDeleteModal]       = useState(null) // { type, id, label }
  const [upiDeletePassword, setUpiDeletePassword] = useState('')
  const [upiDeleteLoading, setUpiDeleteLoading]   = useState(false)

  // ── Vendors ──
  const [vendors, setVendors]               = useState([])
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorDetail, setVendorDetail]     = useState(null)

  // Vendor add/edit/delete modals
  const [showAddVendor, setShowAddVendor]       = useState(false)
  const [editVendorData, setEditVendorData]     = useState(null)   // null = closed
  const [deleteConfirmV, setDeleteConfirmV]     = useState(null)   // vendor obj
  const [vendorSaving, setVendorSaving]         = useState(false)
  const [chequeSaving, setChequeSaving]         = useState(false)
  const [chequeEditSaving, setChequeEditSaving] = useState(false)
  const [upiSaving, setUpiSaving]               = useState(false)
  const [purchaseSaving, setPurchaseSaving]     = useState(false)
  const [paymentSaving, setPaymentSaving]       = useState(false)
  const [vendorDeleting, setVendorDeleting]     = useState(false)

  // Transaction form
  const [txnType, setTxnType]   = useState('purchase')
  const [txnDate, setTxnDate]   = useState('')
  const [txnDesc, setTxnDesc]   = useState('')

  // Purchase-specific
  const [purchaseItems, setPurchaseItems] = useState([])

  // Payment-specific
  const [payAmount, setPayAmount]       = useState('')
  const [payMethod, setPayMethod]       = useState('cash')
  const [payUpiAcc, setPayUpiAcc]       = useState('')
  const [payBankType, setPayBankType]   = useState('NEFT')
  const [payDenomination, setPayDenomination] = useState({})

  // Note-wise Cash Tracking — global setting (same key as the Cash Drawer tab)
  const [noteTrackingEnabled, setNoteTrackingEnabled] = useState(true)

  // Vendor transaction history — click-to-expand denomination breakdown
  const [expandedTxnId, setExpandedTxnId] = useState(null)

  // Live drawer notes — keeps the vendor cash payment from exceeding what's in the drawer
  const [availableNotes, setAvailableNotes] = useState(null)

  // Customers
  const [customers, setCustomers] = useState([])
  const [commissionEntries, setCommissionEntries] = useState([])
  const [commissionLoading, setCommissionLoading] = useState(false)

  useEffect(() => { fetchAll(); getCustomers().then(r => setCustomers(r.data)).catch(() => {}) }, [filterMonth, filterYear]) // eslint-disable-line

  // notify() already auto-clears after 3s — this just clears immediately on
  // tab change too, otherwise a message like "Cheque recorded" could still
  // show up on the UPI or Vendors tab if switched within that window.
  useEffect(() => {
    queueMicrotask(() => setMessage(''))
  }, [activeTab])

  useEffect(() => {
    getSetting('note_tracking_enabled')
      .then(res => setNoteTrackingEnabled(res.data.value === null ? true : res.data.value === 'true'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAvailableNotes()
  }, [])

  function refreshAvailableNotes() {
    getDenominationDrawer()
      .then(res => setAvailableNotes(res.data.denominations))
      .catch(() => {})
  }

  function fetchAll()    { fetchCheques(); fetchUpi(); fetchVendors() }
  function fetchCommission() {
    setCommissionLoading(true)
    Promise.all([
      getExpenses(filterMonth, filterYear),
      getCommissionIncome({ month: filterMonth, year: filterYear })
    ])
      .then(([expRes, incomeRes]) => {
        const incomeByExpenseId = {}
        ;(incomeRes.data || []).forEach(row => { incomeByExpenseId[row.expense_id] = row })
        const entries = (expRes.data || [])
          .filter(e => e.category === 'Commission')
          .map(e => ({ ...e, commission_income: incomeByExpenseId[e.id] || null }))
        setCommissionEntries(entries)
        setCommissionLoading(false)
      })
      .catch(() => setCommissionLoading(false))
  }
  function fetchCheques() {
    setChequesLoading(true)
    Promise.all([
      getCheques({ month: filterMonth, year: filterYear }),
      getChequeSummary({ month: filterMonth, year: filterYear })
    ])
      .then(([chequesRes, summaryRes]) => {
        setCheques(chequesRes.data)
        setChequeSummary(summaryRes.data)
      })
      .catch(() => {})
      .finally(() => setChequesLoading(false))
  }
  function fetchUpi() {
    getUpiTransactions({ month: filterMonth, year: filterYear, upi_account: upiFilter || undefined }).then(r => setUpiTransactions(r.data)).catch(() => {})
    getUpiSummary(filterMonth, filterYear).then(r => setUpiSummary(r.data.summary || [])).catch(() => {})
  }
  function fetchVendors() { getVendors().then(r => setVendors(r.data)).catch(() => {}) }
  function fetchVendorDetail(id) {
    getVendor(id).then(r => { setVendorDetail(r.data); setSelectedVendor(r.data) }).catch(() => {})
  }

  function notify(msg) { setMessage(msg); setTimeout(() => setMessage(''), 3000) }

  // ── Cheque handlers ──
  function handleAddCheque(e) {
    e.preventDefault()
    if (!chequeForm.firm_name || !chequeForm.amount) return notify('Firm name and amount required.')
    setChequeSaving(true)
    addCheque(chequeForm).then(() => {
      notify('Cheque recorded.')
      setChequeForm({ cheque_number: '', firm_name: '', customer_id: '', bank_name: '', amount: '', received_date: '', order_id: '', notes: '' })
      setShowChequeForm(false); fetchCheques()
    }).catch(() => notify('Error recording cheque.'))
      .finally(() => setChequeSaving(false))
  }
  function handleChequeStatusUpdate(id, status) {
    updateChequeStatus(id, status).then(() => { notify(`Cheque marked as ${status}`); fetchCheques() }).catch(() => notify('Error updating cheque.'))
  }

  // ── UPI handler ──
  function handleAddUpi(e) {
    e.preventDefault()
    if (!upiForm.upi_account || !upiForm.amount) return notify('UPI account and amount required.')
    setUpiSaving(true)
    addUpiTransaction(upiForm).then(() => {
      notify('UPI transaction recorded.')
      setUpiForm({ upi_account: '', customer_name: '', customer_id: '', amount: '', transaction_date: '', utr_number: '', order_id: '', notes: '' })
      setShowUpiForm(false); fetchUpi()
    }).catch(() => notify('Error recording UPI transaction.'))
      .finally(() => setUpiSaving(false))
  }

  function handleUpiDelete(e) {
    e.preventDefault()
    if (!upiDeletePassword) return notify('Enter the password.')
    setUpiDeleteLoading(true)
    deleteLedgerEntry(upiDeletePassword, upiDeleteModal.type, upiDeleteModal.id)
      .then(() => {
        notify('Entry deleted ✅')
        setUpiDeleteModal(null)
        setUpiDeletePassword('')
        fetchUpi()
      })
      .catch(err => notify(err.response?.data?.error || 'Delete failed.'))
      .finally(() => setUpiDeleteLoading(false))
  }

  // ── Vendor handlers ──
  function handleAddVendor(form) {
    setVendorSaving(true)
    addVendor(form).then(() => {
      notify('Vendor added.'); setShowAddVendor(false); setVendorSaving(false); fetchVendors()
    }).catch(() => { notify('Error adding vendor.'); setVendorSaving(false) })
  }

  function handleEditVendor(form) {
    setVendorSaving(true)
    updateVendor(editVendorData.id, form).then(() => {
      notify('Vendor updated.')
      setEditVendorData(null); setVendorSaving(false)
      fetchVendors()
      if (selectedVendor?.id === editVendorData.id) fetchVendorDetail(editVendorData.id)
    }).catch(() => { notify('Error updating vendor.'); setVendorSaving(false) })
  }

  function handleDeleteVendor() {
    setVendorDeleting(true)
    deleteVendor(deleteConfirmV.id).then(() => {
      notify('Vendor deleted.')
      setDeleteConfirmV(null)
      if (selectedVendor?.id === deleteConfirmV.id) { setSelectedVendor(null); setVendorDetail(null) }
      fetchVendors()
    }).catch(() => notify('Error deleting vendor.'))
      .finally(() => setVendorDeleting(false))
  }

  function resetTxnForm() {
    setTxnDate(''); setTxnDesc(''); setPurchaseItems([])
    setPayAmount(''); setPayMethod('cash'); setPayUpiAcc(''); setPayBankType('NEFT')
    setPayDenomination({})
  }

  function handleVendorPurchase(e) {
    e.preventDefault()
    const total = purchaseItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    if (!total && !txnDesc.trim()) return notify('Add items or a description.')
    const payload = {
      amount: total,
      description: txnDesc,
      transaction_date: txnDate,
      items: purchaseItems.filter(i => i.name.trim())
    }
    setPurchaseSaving(true)
    addVendorPurchase(selectedVendor.id, payload).then(() => {
      notify('Purchase recorded.'); resetTxnForm(); fetchVendorDetail(selectedVendor.id); fetchVendors()
    }).catch(() => notify('Error recording purchase.'))
      .finally(() => setPurchaseSaving(false))
  }

  function handleVendorPayment(e) {
    e.preventDefault()
    if (!payAmount || parseFloat(payAmount) <= 0) return notify('Amount required.')
    const payload = {
      amount: parseFloat(payAmount),
      description: txnDesc,
      transaction_date: txnDate,
      payment_method: payMethod,
      upi_account: payMethod === 'upi' ? payUpiAcc : null,
      bank_transfer_type: payMethod === 'bank' ? payBankType : null,
      denomination_breakdown: payMethod === 'cash' && Object.keys(payDenomination).length > 0
        ? payDenomination : null
    }
    setPaymentSaving(true)
    addVendorPayment(selectedVendor.id, payload).then(() => {
      notify('Payment recorded — ledger & expenses updated.')
      resetTxnForm(); fetchVendorDetail(selectedVendor.id); fetchVendors()
      refreshAvailableNotes()
    }).catch(() => notify('Error recording payment.'))
      .finally(() => setPaymentSaving(false))
  }

  function fmtDT(dateStr) {
    if (!dateStr) return '—'
    // Comes from the DB as an IST string "2026-06-19 12:33:15" — add T to parse it
    const normalized = dateStr.replace(' ', 'T')
    const d = new Date(normalized); if (isNaN(d)) return dateStr
    const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const pad = n => String(n).padStart(2, '0')
    return `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())}  ${pad(ist.getDate())}.${pad(ist.getMonth()+1)}.${ist.getFullYear()}`
  }

  // Denomination order — same as DenominationCounter.jsx, largest to smallest
  const DENOM_ORDER = [500, 200, 100, 50, 20, 10, 5, 2, 1]

  function sumDenom(counts) {
    return Object.values(counts || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  }

  // Does this transaction have an expandable breakdown? (cash payments only)
  function hasBreakdown(t) {
    if (t.type !== 'payment' || !t.denomination_breakdown) return false
    const { received, returned } = t.denomination_breakdown
    return sumDenom(received) > 0 || sumDenom(returned) > 0
  }

  function renderDenomChips(counts, tone) {
    const entries = DENOM_ORDER.map(d => [d, Number(counts?.[d]) || 0]).filter(([, c]) => c > 0)
    if (entries.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([d, c]) => (
          <span key={d} className={`text-[11px] font-bold px-2 py-1 rounded-md ${tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            ₹{d} × {c}
          </span>
        ))}
      </div>
    )
  }

  const payMethodBadge = (t) => {
    if (t.type !== 'payment') return null
    const m = t.payment_method || 'cash'
    if (m === 'upi') return <Badge tone="purple" icon={Smartphone} className="ml-1.5">{(t.upi_account || 'UPI').split('-')[0].trim()}</Badge>
    if (m === 'bank') return <Badge tone="blue" icon={Building2} className="ml-1.5">{t.bank_transfer_type || 'NEFT'}</Badge>
    return <Badge tone="emerald" icon={Banknote} className="ml-1.5">Cash</Badge>
  }

  const TABS = [
    { key: 'cheques',    label: 'Cheque Register', icon: Receipt },
    { key: 'upi',        label: 'UPI Accounts',     icon: Smartphone },
    { key: 'vendors',    label: 'Vendor Accounts',  icon: Store },
    { key: 'commission', label: 'Commission',       icon: Coins },
  ]

  return (
    <PageLock pageKey="accounts" pageTitle="Accounts">
      <div className="space-y-6">
        <PageHeader title="Accounts" subtitle="Cheques, UPI accounts, vendor ledgers, and commission history" />

        {message && (
          <p onClick={() => setMessage('')} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl cursor-pointer text-sm">
            {message}
          </p>
        )}

        {/* Month filter */}
        <div className="flex gap-3">
          <select className={`${inputClasses} max-w-[160px]`} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
              <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
            ))}
          </select>
          <select className={`${inputClasses} max-w-[110px]`} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            {['2024','2025','2026','2027'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); if (t.key === 'commission') fetchCommission() }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>

        {/* ══════════════════ CHEQUES TAB ══════════════════ */}
        {activeTab === 'cheques' && (
          <div className="space-y-5">
            {chequesLoading && <SectionLoader label="Loading cheques..." size="small" />}

            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 transition-opacity ${chequesLoading ? 'opacity-50' : ''}`}>
              {chequeSummary.map(s => (
                <div key={s.status} className={`bg-slate-900 border-t-4 border border-slate-800 rounded-2xl p-4 ${
                  s.status === 'received' ? 'border-t-amber-500' : s.status === 'deposited' ? 'border-t-blue-500' : s.status === 'cleared' ? 'border-t-emerald-500' : 'border-t-red-500'
                }`}>
                  <div className={`text-lg font-bold font-mono ${
                    s.status === 'received' ? 'text-amber-400' : s.status === 'deposited' ? 'text-blue-400' : s.status === 'cleared' ? 'text-emerald-400' : 'text-red-400'
                  }`}>₹{s.total}</div>
                  <div className="text-xs text-slate-400 mt-1 capitalize">{s.status} ({s.count})</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <PrimaryButton icon={showChequeForm ? X : Plus} onClick={() => setShowChequeForm(!showChequeForm)}>
                {showChequeForm ? 'Cancel' : 'Add Cheque'}
              </PrimaryButton>
            </div>

            {showChequeForm && (
              <Card>
                <h3 className="text-white font-bold mb-4">Record New Cheque</h3>
                <form onSubmit={handleAddCheque} className="space-y-3">
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Cheque Number</label><input className={inputClasses} placeholder="e.g. 123456" value={chequeForm.cheque_number} onChange={e => setChequeForm({ ...chequeForm, cheque_number: e.target.value })} /></div>
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Firm / Person Name *</label><input className={inputClasses} placeholder="Who gave the cheque" value={chequeForm.firm_name} onChange={e => setChequeForm({ ...chequeForm, firm_name: e.target.value })} /></div>
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelClasses}>Link to Customer (optional)</label>
                      <select className={inputClasses} value={chequeForm.customer_id} onChange={e => setChequeForm({ ...chequeForm, customer_id: e.target.value })}>
                        <option value="">Select Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.firm_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Bank Name</label><input className={inputClasses} placeholder="e.g. SBI, PNB, BOI" value={chequeForm.bank_name} onChange={e => setChequeForm({ ...chequeForm, bank_name: e.target.value })} /></div>
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Amount (₹) *</label><input className={inputClasses} type="number" placeholder="0" value={chequeForm.amount} onChange={e => setChequeForm({ ...chequeForm, amount: e.target.value })} /></div>
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Received Date</label><input className={inputClasses} type="date" value={chequeForm.received_date} onChange={e => setChequeForm({ ...chequeForm, received_date: e.target.value })} /></div>
                  </div>
                  <div><label className={labelClasses}>Notes</label><input className={inputClasses} placeholder="e.g. Against order #5" value={chequeForm.notes} onChange={e => setChequeForm({ ...chequeForm, notes: e.target.value })} /></div>
                  <LoadingButton loading={chequeSaving} type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25">Save Cheque</LoadingButton>
                </form>
              </Card>
            )}

            <div className="flex gap-5 flex-wrap items-start">
              <div className="flex-1 min-w-[300px]">
                {cheques.length === 0 ? <p className="text-slate-500 text-sm">No cheques for this period.</p> : (
                  <Card padded={false} className="overflow-hidden">
                    <Table minWidth="500px">
                      <THead>
                        <Th className="pl-4">Date</Th><Th>Cheque No.</Th><Th>Firm</Th><Th>Amount</Th><Th className="pr-4">Status</Th>
                      </THead>
                      <TBody>
                        {cheques.map(c => (
                          <Tr
                            key={c.id}
                            onClick={() => { setSelectedCheque(c); getCheque(c.id).then(r => { setChequeDetail(r.data); setChequeEditForm({ cheque_number: r.data.cheque_number || '', bank_name: r.data.bank_name || '', notes: r.data.notes || '', received_date: r.data.received_date || '' }) }) }}
                            className={selectedCheque?.id === c.id ? '!bg-blue-500/10 border-l-2 border-l-blue-500' : ''}
                          >
                            <Td className="pl-4 text-slate-300">{c.received_date}</Td>
                            <Td className="font-bold text-white">{c.cheque_number || '—'}</Td>
                            <Td className="text-slate-300">{c.firm_name}</Td>
                            <Td className="font-bold text-white font-mono">₹{c.amount}</Td>
                            <Td className="pr-4"><Badge tone={CHEQUE_STATUS_TONE[c.status] || 'slate'}>{c.status}</Badge></Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </Card>
                )}
              </div>

              {chequeDetail && (
                <Card className="flex-1 min-w-[280px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold">Cheque Details</h3>
                    <SecondaryButton icon={editingCheque ? undefined : Pencil} onClick={() => setEditingCheque(!editingCheque)}>
                      {editingCheque ? 'Cancel Edit' : 'Edit'}
                    </SecondaryButton>
                  </div>

                  {!editingCheque ? (
                    <div>
                      {[['Cheque Number', chequeDetail.cheque_number || '—'], ['Firm / Person', chequeDetail.firm_name], ['Bank', chequeDetail.bank_name || '—'], ['Amount', `₹${chequeDetail.amount}`], ['Received Date', chequeDetail.received_date], ['Notes', chequeDetail.notes || '—']].map(([l, v]) => (
                        <div key={l} className="flex justify-between py-2.5 border-b border-slate-800/60">
                          <span className="text-xs font-bold text-slate-400">{l}</span>
                          <span className="text-sm text-slate-200 text-right">{v}</span>
                        </div>
                      ))}
                      {chequeDetail.customer_firm && chequeDetail.customer_firm !== chequeDetail.firm_name && (
                        <div className="flex justify-between py-2.5 border-b border-slate-800/60">
                          <span className="text-xs font-bold text-slate-400">Linked Customer</span>
                          <span className="text-sm text-slate-200">{chequeDetail.customer_firm}</span>
                        </div>
                      )}

                      <div className="mt-5 mb-4 flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400">Current Status:</span>
                        <Badge tone={CHEQUE_STATUS_TONE[chequeDetail.status] || 'slate'} className="!text-xs !px-3.5 !py-1">{chequeDetail.status}</Badge>
                      </div>
                      <div className="text-xs font-bold text-slate-300 mb-2.5">Update Status:</div>
                      <div className="flex gap-2 flex-wrap">
                        {['received','deposited','cleared','bounced'].map(s => {
                          const active = chequeDetail.status === s
                          const tone = CHEQUE_STATUS_TONE[s]
                          return (
                            <button
                              key={s}
                              onClick={() => { handleChequeStatusUpdate(chequeDetail.id, s); setChequeDetail({ ...chequeDetail, status: s }); setCheques(cheques.map(c => c.id === chequeDetail.id ? { ...c, status: s } : c)) }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                active
                                  ? tone === 'amber' ? 'bg-amber-600 border-amber-500 text-white'
                                    : tone === 'blue' ? 'bg-blue-600 border-blue-500 text-white'
                                    : tone === 'emerald' ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-red-600 border-red-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                              }`}
                            >
                              {s === 'received' ? <><Inbox className="w-3 h-3 inline mr-1" /> Received</>
                                : s === 'deposited' ? <><Building2 className="w-3 h-3 inline mr-1" /> In Bank</>
                                : s === 'cleared' ? <><CheckCircle2 className="w-3 h-3 inline mr-1" /> Cleared</>
                                : <><XCircle className="w-3 h-3 inline mr-1" /> Bounced</>}
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-3 p-2.5 bg-slate-800/40 rounded-xl text-xs text-slate-400">
                        {chequeDetail.status === 'received' && <span className="flex items-center gap-1.5"><Inbox className="w-3 h-3" /> Cheque is with you, not yet deposited.</span>}
                        {chequeDetail.status === 'deposited' && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Deposited in bank, waiting to clear.</span>}
                        {chequeDetail.status === 'cleared' && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Payment received. Counted in customer dues.</span>}
                        {chequeDetail.status === 'bounced' && <span className="flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Cheque bounced. Follow up with customer.</span>}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={e => {
                      e.preventDefault()
                      setChequeEditSaving(true)
                      updateCheque(chequeDetail.id, chequeEditForm)
                        .then(() => { notify('Cheque updated.'); setEditingCheque(false); getCheque(chequeDetail.id).then(r => setChequeDetail(r.data)); fetchCheques() })
                        .catch(() => notify('Error updating cheque.'))
                        .finally(() => setChequeEditSaving(false))
                    }} className="space-y-3">
                      {[['Cheque Number', 'cheque_number'], ['Bank Name', 'bank_name'], ['Notes', 'notes']].map(([l, k]) => (
                        <div key={k}><label className={labelClasses}>{l}</label><input className={inputClasses} value={chequeEditForm[k]} onChange={e => setChequeEditForm({ ...chequeEditForm, [k]: e.target.value })} /></div>
                      ))}
                      <div><label className={labelClasses}>Received Date</label><input className={inputClasses} type="date" value={chequeEditForm.received_date} onChange={e => setChequeEditForm({ ...chequeEditForm, received_date: e.target.value })} /></div>
                      <LoadingButton loading={chequeEditSaving} type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25">Save Changes</LoadingButton>
                    </form>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ UPI TAB ══════════════════ */}
        {activeTab === 'upi' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {UPI_ACCOUNTS.map((acc, i) => {
                const s = upiSummary.find(x => x.upi_account === acc)
                const active = upiFilter === acc
                return (
                  <button
                    key={acc}
                    onClick={() => { setUpiFilter(active ? '' : acc); fetchUpi() }}
                    className={`text-left bg-slate-900 border-t-4 border border-slate-800 rounded-2xl p-4 transition-all ${active ? 'ring-2 ring-blue-500' : ''}`}
                    style={{ borderTopColor: undefined }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${UPI_ACCOUNT_TONE[i]}`} />
                      <div className="text-lg font-bold text-white font-mono">₹{s ? s.total : 0}</div>
                    </div>
                    <div className="text-xs text-slate-300">{acc}</div>
                    <div className="text-[11px] text-slate-500">{s ? s.count : 0} transactions</div>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end">
              <PrimaryButton icon={showUpiForm ? X : Plus} onClick={() => setShowUpiForm(!showUpiForm)}>
                {showUpiForm ? 'Cancel' : 'Record UPI Payment'}
              </PrimaryButton>
            </div>

            {showUpiForm && (
              <Card>
                <h3 className="text-white font-bold mb-4">Record UPI Transaction</h3>
                <form onSubmit={handleAddUpi} className="space-y-3">
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelClasses}>UPI Account Received In *</label>
                      <select className={inputClasses} value={upiForm.upi_account} onChange={e => setUpiForm({ ...upiForm, upi_account: e.target.value })}>
                        <option value="">Select UPI Account</option>
                        {UPI_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Amount (₹) *</label><input className={inputClasses} type="number" placeholder="0" value={upiForm.amount} onChange={e => setUpiForm({ ...upiForm, amount: e.target.value })} /></div>
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Date</label><input className={inputClasses} type="date" value={upiForm.transaction_date} onChange={e => setUpiForm({ ...upiForm, transaction_date: e.target.value })} /></div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Customer Name</label><input className={inputClasses} placeholder="Who paid" value={upiForm.customer_name} onChange={e => setUpiForm({ ...upiForm, customer_name: e.target.value })} /></div>
                    <div className="flex-1 min-w-[150px]">
                      <label className={labelClasses}>Link to Customer (optional)</label>
                      <select className={inputClasses} value={upiForm.customer_id} onChange={e => setUpiForm({ ...upiForm, customer_id: e.target.value })}>
                        <option value="">Select Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.firm_name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]"><label className={labelClasses}>UTR / Reference Number</label><input className={inputClasses} placeholder="e.g. 123456789012" value={upiForm.utr_number} onChange={e => setUpiForm({ ...upiForm, utr_number: e.target.value })} /></div>
                  </div>
                  <div><label className={labelClasses}>Notes</label><input className={inputClasses} placeholder="e.g. Payment for flex order" value={upiForm.notes} onChange={e => setUpiForm({ ...upiForm, notes: e.target.value })} /></div>
                  <LoadingButton loading={upiSaving} type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25">Save UPI Transaction</LoadingButton>
                </form>
              </Card>
            )}

            {upiTransactions.length === 0 ? <p className="text-slate-500 text-sm">No UPI transactions for this period.</p> : (
              <Card padded={false} className="overflow-hidden">
                <Table minWidth="800px">
                  <THead>
                    <Th className="pl-4">Date</Th><Th>UPI Account</Th><Th>From</Th><Th>Amount</Th>
                    <Th>UTR No.</Th><Th>Notes</Th><Th>Type</Th><Th className="pr-4">Action</Th>
                  </THead>
                  <TBody>
                    {upiTransactions.map(t => {
                      const aIdx = UPI_ACCOUNTS.indexOf(t.upi_account)
                      return (
                        <Tr key={`${t.direction}-${t.id}`}>
                          <Td className="pl-4 text-slate-300">{t.transaction_date}</Td>
                          <Td>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                              <span className={`w-2 h-2 rounded-full ${UPI_ACCOUNT_TONE[aIdx] || 'bg-slate-500'}`} />
                              {t.upi_account}
                            </span>
                          </Td>
                          <Td className="text-slate-300">{t.customer_name || '—'}</Td>
                          <Td><strong className={`font-mono ${t.direction === 'debit' ? 'text-red-400' : 'text-emerald-400'}`}>{t.direction === 'debit' ? '-' : '+'}₹{Math.abs(t.amount)}</strong></Td>
                          <Td className="text-xs text-slate-500">{t.utr_number || '—'}</Td>
                          <Td className="text-xs text-slate-500">{t.notes || '—'}</Td>
                          <Td><Badge tone={t.direction === 'debit' ? 'red' : 'emerald'}>{t.direction === 'debit' ? '↑ Paid Out' : '↓ Received'}</Badge></Td>
                          <Td className="pr-4">
                            {t.direction === 'credit' && (
                              <IconButton
                                icon={Trash2}
                                onClick={() => setUpiDeleteModal({
                                  type: t.source === 'cash_income' ? 'cash_income' : 'upi_income',
                                  id: t.id,
                                  label: `${t.customer_name || 'Unknown'} — ₹${t.amount} (${t.upi_account})`
                                })}
                                className="!p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              />
                            )}
                          </Td>
                        </Tr>
                      )
                    })}
                  </TBody>
                </Table>
              </Card>
            )}
          </div>
        )}

        {/* ══════════════════ VENDORS TAB ══════════════════ */}
        {activeTab === 'vendors' && (
          <div className="flex gap-5 flex-wrap items-start">
            <div className="flex-1 min-w-[280px]">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-bold">Vendors <span className="text-slate-500 font-normal text-sm">({vendors.length})</span></h3>
                <PrimaryButton icon={Plus} onClick={() => setShowAddVendor(true)}>Add Vendor</PrimaryButton>
              </div>

              <div className="space-y-2.5">
                {vendors.map(v => (
                  <Card
                    key={v.id}
                    onClick={() => fetchVendorDetail(v.id)}
                    className={`!p-3.5 cursor-pointer transition-all ${selectedVendor?.id === v.id ? '!border-blue-500' : 'hover:!border-slate-700'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-sm">{v.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{v.shop_type} • {v.city}</div>
                      </div>
                      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <IconButton icon={Pencil} onClick={() => setEditVendorData(v)} className="!p-1.5 bg-slate-800/60" />
                        <IconButton icon={Trash2} onClick={() => setDeleteConfirmV(v)} className="!p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" />
                      </div>
                    </div>
                    <div className="flex justify-between mt-2.5 text-xs">
                      <span className="text-emerald-400">Purchased: ₹{v.total_purchased}</span>
                      <span className="text-red-400 font-bold">Due: ₹{v.balance_due}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {vendorDetail && (
              <Card className="flex-[2] min-w-[300px]">
                <h3 className="text-white font-bold mb-1">{vendorDetail.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{vendorDetail.shop_type} • {vendorDetail.city}{vendorDetail.phone ? ` • ${vendorDetail.phone}` : ''}</p>

                <div className="flex gap-3 flex-wrap mb-5">
                  {[
                    { label: 'Total Purchased', val: vendorDetail.total_purchased, color: 'text-red-400' },
                    { label: 'Total Paid', val: vendorDetail.total_paid, color: 'text-emerald-400' },
                    { label: 'Balance Due', val: vendorDetail.balance_due, color: vendorDetail.balance_due > 0 ? 'text-red-400' : 'text-emerald-400', bg: vendorDetail.balance_due > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10' },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className={`flex-1 min-w-[100px] rounded-xl p-3 text-center ${bg || 'bg-slate-800/40'}`}>
                      <div className={`text-lg font-bold font-mono ${color}`}>₹{val}</div>
                      <div className="text-[11px] text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 mb-5">
                  <h4 className="text-white font-bold mb-3 text-sm">Record Transaction</h4>
                  <div className="flex gap-2 mb-3.5">
                    {[
                      { key: 'purchase', label: 'Purchase (We Bought)', icon: Package, tone: 'red' },
                      { key: 'payment', label: 'Payment (We Paid)', icon: Banknote, tone: 'emerald' },
                    ].map(({ key, label, icon: Icon, tone }) => {
                      const active = txnType === key
                      return (
                        <button
                          key={key} type="button" onClick={() => { setTxnType(key); resetTxnForm() }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border-2 flex items-center gap-1.5 transition-all ${
                            active
                              ? tone === 'red' ? 'bg-red-600 border-red-500 text-white' : 'bg-emerald-600 border-emerald-500 text-white'
                              : tone === 'red' ? 'border-red-500/40 text-red-400 bg-transparent' : 'border-emerald-500/40 text-emerald-400 bg-transparent'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                      )
                    })}
                  </div>

                  {txnType === 'purchase' && (
                    <form onSubmit={handleVendorPurchase}>
                      <PurchaseItemsEditor items={purchaseItems} setItems={setPurchaseItems} />
                      <div className="flex gap-2 flex-wrap mb-2">
                        <div className="flex-1 min-w-[130px]"><label className={labelClasses}>Date</label><input className={inputClasses} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} /></div>
                        <div className="flex-[2] min-w-[200px]"><label className={labelClasses}>Note (optional)</label><input className={inputClasses} placeholder="Any additional note" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} /></div>
                      </div>
                      <LoadingButton loading={purchaseSaving} type="submit" className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Save Purchase</LoadingButton>
                    </form>
                  )}

                  {txnType === 'payment' && (
                    <form onSubmit={handleVendorPayment}>
                      <div className="flex gap-2 flex-wrap mb-2">
                        <div className="flex-1 min-w-[130px]">
                          <label className={labelClasses}>Amount (₹) *</label>
                          <input
                            className={`${inputClasses} font-bold`}
                            type="number" placeholder="0"
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value)}
                            readOnly={payMethod === 'cash' && noteTrackingEnabled}
                          />
                          {payMethod === 'cash' && noteTrackingEnabled && (
                            <div className="text-[11px] text-slate-500 mt-1">Fill this from the Note Counting below</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-[130px]"><label className={labelClasses}>Date</label><input className={inputClasses} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} /></div>
                      </div>
                      <PaymentMethodSelector method={payMethod} setMethod={setPayMethod} upiAccount={payUpiAcc} setUpiAccount={setPayUpiAcc} bankType={payBankType} setBankType={setPayBankType} />
                      {payMethod === 'cash' && noteTrackingEnabled && (
                        <DenominationCounter
                          context="expense"
                          availableNotes={availableNotes}
                          onApply={(total, counts) => { setPayAmount(String(total)); setPayDenomination(counts) }}
                        />
                      )}
                      <div className="mb-2.5"><label className={labelClasses}>Description (optional)</label><input className={inputClasses} placeholder="e.g. Paid for last month's flex order" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} /></div>
                      <LoadingButton loading={paymentSaving} type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Save Payment</LoadingButton>
                    </form>
                  )}
                </div>

                <h4 className="text-white font-bold mb-2.5 text-sm">Transaction History</h4>
                {(!vendorDetail.transactions || vendorDetail.transactions.length === 0) ? (
                  <p className="text-slate-500 text-sm">No transactions yet.</p>
                ) : (
                  <Card padded={false} className="overflow-hidden">
                    <Table minWidth="600px">
                      <THead>
                        <Th className="pl-4">Date</Th><Th>Type</Th><Th>Amount</Th><Th className="pr-4">Details</Th>
                      </THead>
                      <TBody>
                        {vendorDetail.transactions.map(t => {
                          const expandable = hasBreakdown(t)
                          const isExpanded = expandedTxnId === t.id
                          return (
                            <Fragment key={t.id}>
                              <Tr onClick={() => expandable && setExpandedTxnId(isExpanded ? null : t.id)} className={isExpanded ? '!bg-emerald-500/5' : ''}>
                                <Td className="pl-4">
                                  <div className="text-slate-300">{t.transaction_date}</div>
                                  {t.created_at && <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" /> {fmtDT(t.created_at)}</div>}
                                </Td>
                                <Td>
                                  <Badge tone={t.type === 'purchase' ? 'red' : 'emerald'} icon={t.type === 'purchase' ? Package : Banknote}>
                                    {t.type === 'purchase' ? 'Purchase' : 'Payment'}
                                  </Badge>
                                  {payMethodBadge(t)}
                                </Td>
                                <Td><strong className={`font-mono ${t.type === 'purchase' ? 'text-red-400' : 'text-emerald-400'}`}>₹{t.amount}</strong></Td>
                                <Td className="pr-4 text-xs text-slate-400">
                                  {t.description && <div>{t.description}</div>}
                                  {t.items && t.items.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {t.items.map((it, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 bg-slate-800 rounded-md px-2 py-0.5 text-xs">
                                          <span>{it.name}</span>
                                          {it.qty && <span className="text-slate-500">×{it.qty}{it.unit}</span>}
                                          {it.amount && <span className="font-bold">₹{it.amount}</span>}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </Td>
                              </Tr>
                              {isExpanded && (
                                <tr className="bg-emerald-500/5">
                                  <td colSpan="4" className="px-3.5 pb-3.5 pt-1 border-b border-slate-800/60">
                                    <div className="flex flex-wrap gap-5">
                                      <div>
                                        <div className="text-[11px] font-bold text-emerald-400 mb-1.5">+ Received</div>
                                        {renderDenomChips(t.denomination_breakdown.received, 'emerald') || <span className="text-xs text-slate-500">—</span>}
                                      </div>
                                      {sumDenom(t.denomination_breakdown.returned) > 0 && (
                                        <div>
                                          <div className="text-[11px] font-bold text-red-400 mb-1.5">− Returned</div>
                                          {renderDenomChips(t.denomination_breakdown.returned, 'red')}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </TBody>
                    </Table>
                  </Card>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ══════════════════ COMMISSION TAB ══════════════════ */}
        {activeTab === 'commission' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm px-4 py-3 rounded-xl">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Commission entries are only added via <strong className="text-white">Daily Sales → Add Expense → Category: Commission</strong>. This is a read-only history.</span>
            </div>

            {commissionLoading ? (
              <SectionLoader label="Loading commission entries..." />
            ) : commissionEntries.length === 0 ? (
              <p className="text-slate-500 text-sm">No commission entries this month.</p>
            ) : (
              <Card padded={false} className="overflow-hidden">
                <Table minWidth="800px">
                  <THead>
                    <Th className="pl-4">Date & Time</Th><Th>Customer</Th><Th>Extra Bill (Gross)</Th><Th>Kept (Income)</Th><Th>Returned (Expense)</Th><Th>Payment Mode</Th><Th className="pr-4">Notes</Th>
                  </THead>
                  <TBody>
                    {commissionEntries.map(e => (
                      <Tr key={e.id}>
                        <Td className="pl-4">
                          <div className="text-slate-300">{e.expense_date}</div>
                          {e.created_at && <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" /> {fmtDT(e.created_at)}</div>}
                        </Td>
                        <Td className="font-bold text-white">{e.customer_name || '—'}</Td>
                        <Td className="text-slate-400 font-mono">{e.commission_income ? `₹${e.commission_income.gross_amount}` : '—'}</Td>
                        <Td>
                          {e.commission_income
                            ? <strong className="text-emerald-400 text-base font-mono">₹{e.commission_income.amount}</strong>
                            : <span className="text-slate-500 text-xs">—</span>}
                        </Td>
                        <Td><strong className="text-orange-400 text-base font-mono">₹{e.amount}</strong></Td>
                        <Td><Badge tone={e.payment_mode === 'upi' ? 'blue' : 'emerald'} icon={e.payment_mode === 'upi' ? Smartphone : Banknote}>{e.payment_mode === 'upi' ? (e.upi_account || 'UPI') : 'Cash'}</Badge></Td>
                        <Td className="pr-4 text-xs text-slate-400">{e.description || '—'}</Td>
                      </Tr>
                    ))}
                  </TBody>
                  <tfoot>
                    <tr className="bg-orange-500/5 border-t border-slate-800">
                      <td colSpan="2" className="py-3 pl-4 pr-4 font-bold text-white">Totals</td>
                      <td className="py-3 pr-4 font-bold text-slate-400 font-mono">₹{commissionEntries.reduce((s, e) => s + (e.commission_income?.gross_amount || 0), 0)}</td>
                      <td className="py-3 pr-4 font-bold text-emerald-400 text-base font-mono">₹{commissionEntries.reduce((s, e) => s + (e.commission_income?.amount || 0), 0)}</td>
                      <td className="py-3 pr-4 font-bold text-orange-400 text-base font-mono">₹{commissionEntries.reduce((s, e) => s + e.amount, 0)}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </Table>
              </Card>
            )}
          </div>
        )}

        {/* UPI ENTRY DELETE MODAL */}
        <Modal open={!!upiDeleteModal} onClose={() => { setUpiDeleteModal(null); setUpiDeletePassword('') }} width="360px">
          {upiDeleteModal && (
            <>
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Entry</h3>
              <p className="text-xs text-slate-400 mb-1.5">Entry:</p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5 text-xs text-red-400 font-bold mb-4">{upiDeleteModal.label}</div>
              <p className="text-xs text-red-400 mb-4 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> This entry will be permanently deleted everywhere. Enter password to confirm:</p>
              <form onSubmit={handleUpiDelete}>
                <input
                  type="password" placeholder="Enter password" value={upiDeletePassword}
                  onChange={e => setUpiDeletePassword(e.target.value)} autoFocus
                  className={`${inputClasses} mb-4 text-lg tracking-widest text-center`}
                />
                <div className="flex gap-2.5">
                  <SecondaryButton type="button" className="flex-1 justify-center" onClick={() => { setUpiDeleteModal(null); setUpiDeletePassword('') }}>Cancel</SecondaryButton>
                  <LoadingButton loading={upiDeleteLoading} loadingText="Deleting..." type="submit" className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </LoadingButton>
                </div>
              </form>
            </>
          )}
        </Modal>

        {/* ADD VENDOR MODAL */}
        <Modal open={showAddVendor} onClose={() => setShowAddVendor(false)} width="480px">
          <h3 className="text-white font-bold mb-4">Add New Vendor</h3>
          <VendorForm saving={vendorSaving} onSave={handleAddVendor} onCancel={() => setShowAddVendor(false)} />
        </Modal>

        {/* EDIT VENDOR MODAL */}
        <Modal open={!!editVendorData} onClose={() => setEditVendorData(null)} width="480px">
          <h3 className="text-white font-bold mb-4">Edit Vendor</h3>
          {editVendorData && <VendorForm initial={editVendorData} saving={vendorSaving} onSave={handleEditVendor} onCancel={() => setEditVendorData(null)} />}
        </Modal>

        {/* DELETE VENDOR CONFIRM MODAL */}
        <Modal open={!!deleteConfirmV} onClose={() => setDeleteConfirmV(null)} width="380px">
          {deleteConfirmV && (
            <>
              <h3 className="text-white font-bold mb-3">Delete Vendor</h3>
              <p className="text-sm text-slate-300 mb-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{deleteConfirmV.name}</strong>?
              </p>
              <p className="text-xs text-red-400 mb-5">This will permanently remove all their transactions.</p>
              <div className="flex gap-2.5">
                <SecondaryButton className="flex-1 justify-center" onClick={() => setDeleteConfirmV(null)}>Cancel</SecondaryButton>
                <LoadingButton loading={vendorDeleting} onClick={handleDeleteVendor} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">
                  Yes, Delete
                </LoadingButton>
              </div>
            </>
          )}
        </Modal>
      </div>
    </PageLock>
  )
}

export default Accounts