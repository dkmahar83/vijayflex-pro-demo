import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getUpiQrHistory, addUpiQrHistory, toggleUpiQrPaid, deleteUpiQrHistory, clearUpiQrHistory } from '../services/api'
import {
  Smartphone, Printer, ClipboardList, Check, Zap, Download,
  RefreshCw, StickyNote, Trash2, X, CheckCircle2, Calendar, Copy,
} from 'lucide-react'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import { SecondaryButton, IconButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'

const UPI_ACCOUNTS = [
  { label: 'BOI Shop Account',               upi: 'boism-9950580621@boi',        name: 'Vijay Flex' },
  { label: 'Google Pay - Rampratap Painter', upi: 'gpay-11263065173@okbizaxis',      name: 'Rampratap Painter' },
  { label: 'PhonePe - Bhavya Printers',      upi: 'q214575569@ybl',   name: 'Bhavya Printers' },
  { label: 'Amazon Pay - Deepak',            upi: '7073580621@yapl',           name: 'Deepak' },
]

// One dot color per account, kept distinct from the app's semantic colors
// (blue/emerald/red/amber) since these are just visual account identifiers.
const ACCOUNT_TONES = ['bg-indigo-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500']

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

export default function UpiQR() {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [amount, setAmount]           = useState('')
  const [remarks, setRemarks]         = useState('')
  const [qrUrl, setQrUrl]             = useState('')
  const [generating, setGenerating]   = useState(false)
  const [activeTab, setActiveTab]     = useState('generator')
  const [history, setHistory]         = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [copied, setCopied]           = useState(false)
  const [errorMsg, setErrorMsg]       = useState('')

  const acc = UPI_ACCOUNTS[selectedIdx]

  useEffect(() => { refreshHistory() }, [])

  useEffect(() => {
    if (!errorMsg) return
    const timer = setTimeout(() => setErrorMsg(''), 4000)
    return () => clearTimeout(timer)
  }, [errorMsg])

  async function refreshHistory() {
    setLoadingHistory(true)
    try {
      const res = await getUpiQrHistory()
      setHistory(res.data.map(h => ({ ...h, paid: !!h.paid })))
    } catch (e) {
      console.error('History load failed:', e)
    }
    setLoadingHistory(false)
  }

  function buildUpiString() {
    const base = `upi://pay?pa=${encodeURIComponent(acc.upi)}&pn=${encodeURIComponent(acc.name)}&cu=INR`
    const amt  = parseFloat(amount)
    const withAmt = !isNaN(amt) && amt > 0 ? `${base}&am=${amt.toFixed(2)}` : base
    return remarks.trim() ? `${withAmt}&tn=${encodeURIComponent(remarks.trim())}` : withAmt
  }

  async function generateQR() {
    if (!amount || parseFloat(amount) <= 0) return setErrorMsg('Enter an amount first.')
    setGenerating(true)
    try {
      const upiStr = buildUpiString()
      const url = await QRCode.toDataURL(upiStr, {
        width: 320, margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      })
      setQrUrl(url)

      await addUpiQrHistory({
        upi_account: acc.label,
        upi_id: acc.upi,
        payee_name: acc.name,
        amount: parseFloat(amount),
        remarks: remarks.trim()
      })
      await refreshHistory()
    } catch (e) {
      setErrorMsg('Error generating QR: ' + e.message)
    }
    setGenerating(false)
  }

  function downloadQR() {
    if (!qrUrl) return
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `UPI-QR-${acc.name}-₹${amount}-${Date.now()}.png`
    a.click()
  }

  function copyUpiId() {
    navigator.clipboard.writeText(acc.upi).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  async function togglePaid(id) {
    try {
      await toggleUpiQrPaid(id)
      setHistory(history.map(h => h.id === id ? { ...h, paid: !h.paid } : h))
    } catch (e) {
      setErrorMsg('Update failed: ' + (e.response?.data?.error || e.message))
    }
  }

  async function deleteEntry(id) {
    try {
      await deleteUpiQrHistory(id)
      setHistory(history.filter(h => h.id !== id))
    } catch (e) {
      setErrorMsg('Delete failed: ' + (e.response?.data?.error || e.message))
    }
  }

  async function clearAll() {
    if (!window.confirm('Delete all QR history?')) return
    try {
      await clearUpiQrHistory()
      setHistory([])
    } catch (e) {
      setErrorMsg('Clear failed: ' + (e.response?.data?.error || e.message))
    }
  }

  function fmtTime(iso) {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const todayStr = new Date().toDateString()
  const todayHistory = history.filter(h => new Date(h.created_at).toDateString() === todayStr)
  const todayTotal   = todayHistory.filter(h => h.paid).reduce((s, h) => s + h.amount, 0)
  const pendingCount = todayHistory.filter(h => !h.paid).length

  return (
    <div className="space-y-6">
      <PageHeader title="UPI QR Generator" subtitle="Generate a scannable QR for quick payment collection" />

      {errorMsg && (
        <p
          onClick={() => setErrorMsg('')}
          className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl cursor-pointer text-sm"
        >
          {errorMsg}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today Received (Marked)" value={`₹${todayTotal.toFixed(0)}`} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Pending Confirmations" value={pendingCount} valueClassName={pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'} icon={Calendar} tone={pendingCount > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Total QRs Today" value={todayHistory.length} icon={Smartphone} tone="blue" />
      </div>

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'generator', label: 'Generate QR',       icon: Printer },
          { key: 'history',   label: 'Payment History',   icon: ClipboardList },
        ].map(t => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                active ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ══════════════════ GENERATOR ══════════════════ */}
      {activeTab === 'generator' && (
        <div className="flex gap-5 flex-wrap items-start">
          <Card className="flex-1 min-w-[280px]">
            <div className="mb-5">
              <label className={labelClasses}>Select UPI Account *</label>
              <div className="flex flex-col gap-2 mt-1.5">
                {UPI_ACCOUNTS.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedIdx(i); setQrUrl('') }}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-left border-2 transition-all ${
                      selectedIdx === i ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ACCOUNT_TONES[i] || 'bg-slate-500'}`} />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">{a.label}</div>
                      <div className="text-[11px] text-slate-500 truncate">{a.upi}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3.5 py-2.5 mb-4">
              <div>
                <div className="text-[11px] text-slate-500">Selected UPI ID</div>
                <div className="font-bold text-sm text-white font-mono">{acc.upi}</div>
              </div>
              <button
                onClick={copyUpiId}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>

            <div className="mb-4">
              <label className={labelClasses}>Amount (₹) *</label>
              <input
                type="number" placeholder="0" value={amount}
                onChange={e => { setAmount(e.target.value); setQrUrl('') }}
                className={`${inputClasses} text-xl font-bold`}
              />
            </div>

            <div className="mb-5">
              <label className={labelClasses}>Remarks (Optional)</label>
              <input
                placeholder="e.g. Invoice #45, Flex Order" value={remarks}
                onChange={e => { setRemarks(e.target.value); setQrUrl('') }}
                className={inputClasses}
              />
            </div>

            <button
              onClick={generateQR}
              disabled={generating || !amount}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : <><Zap className="w-4 h-4" /> Generate QR Code</>}
            </button>

            <p className="text-center text-slate-500 text-[11px] mt-3">
              Works with GPay • PhonePe • Paytm • BHIM • all UPI apps
            </p>
          </Card>

          <Card className="flex-1 min-w-[280px] min-h-[400px] flex flex-col items-center justify-center text-center">
            {!qrUrl ? (
              <div className="text-slate-600">
                <Smartphone className="w-14 h-14 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Choose a UPI account and amount,<br />then generate the QR.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> QR Ready
                </div>
                <img src={qrUrl} alt="UPI QR Code" className="w-60 h-60 rounded-2xl border-2 border-slate-800" />
                <div className="mt-3 text-xs text-slate-400">
                  {acc.label}<br />
                  <span className="text-slate-300 font-semibold font-mono">{acc.upi}</span>
                </div>
                {remarks && (
                  <div className="text-xs text-blue-400 mt-1.5 flex items-center justify-center gap-1.5">
                    <StickyNote className="w-3 h-3" /> {remarks}
                  </div>
                )}
                <div className="flex gap-2.5 mt-4 w-full max-w-[280px]">
                  <SecondaryButton icon={Download} onClick={downloadQR} className="flex-1 justify-center">Download PNG</SecondaryButton>
                  <SecondaryButton icon={RefreshCw} onClick={() => { setQrUrl(''); setAmount(''); setRemarks('') }} className="flex-1 justify-center">New QR</SecondaryButton>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ══════════════════ HISTORY ══════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <p className="text-sm text-slate-400">{history.length} total entries</p>
            {history.length > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            )}
          </div>

          {loadingHistory ? (
            <SectionLoader label="Loading history..." size="large" />
          ) : history.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl">
              <ClipboardList className="w-9 h-9 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-500 text-sm">No QR generated yet.<br />Generate your first one from the Generate QR tab!</p>
            </div>
          ) : (
            (() => {
              const groups = {}
              history.forEach(h => {
                const d = new Date(h.created_at).toDateString()
                if (!groups[d]) groups[d] = []
                groups[d].push(h)
              })
              return Object.entries(groups).map(([date, entries]) => {
                const dayTotal   = entries.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)
                const dayPending = entries.filter(e => !e.paid).length
                return (
                  <div key={date}>
                    <div className="flex justify-between items-center mb-2.5">
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        {date === todayStr ? <><Calendar className="w-3.5 h-3.5" /> Today</> : date}
                      </div>
                      <div className="text-xs text-slate-400">
                        Received: <strong className="text-emerald-400">₹{dayTotal}</strong>
                        {dayPending > 0 && <span className="text-amber-400 ml-2"> • {dayPending} pending</span>}
                      </div>
                    </div>

                    <Card padded={false} className="overflow-hidden">
                      <Table minWidth="650px">
                        <THead>
                          <Th className="pl-4">Time</Th><Th>UPI Account</Th><Th>Amount</Th>
                          <Th>Remarks</Th><Th>Status</Th><Th className="pr-4">Action</Th>
                        </THead>
                        <TBody>
                          {entries.map(e => {
                            const aIdx = UPI_ACCOUNTS.findIndex(a => a.label === e.upi_account)
                            const tone = ACCOUNT_TONES[aIdx] || 'bg-slate-500'
                            return (
                              <Tr key={e.id} className={e.paid ? 'bg-emerald-500/5' : ''}>
                                <Td className="pl-4 text-slate-300 whitespace-nowrap">{fmtTime(e.created_at)}</Td>
                                <Td>
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                                    <span className={`w-2 h-2 rounded-full ${tone}`} />
                                    {e.upi_account.split('-')[0].trim()}
                                  </span>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{e.upi_id}</div>
                                </Td>
                                <Td className="font-bold text-base text-white font-mono">₹{e.amount.toLocaleString('en-IN')}</Td>
                                <Td className="text-slate-400 text-xs">{e.remarks || '—'}</Td>
                                <Td>
                                  <button
                                    onClick={() => togglePaid(e.id)}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                      e.paid ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700/80'
                                    }`}
                                  >
                                    {e.paid ? <><Check className="w-3 h-3" /> Received</> : 'Mark Paid'}
                                  </button>
                                </Td>
                                <Td className="pr-4">
                                  <IconButton icon={X} onClick={() => deleteEntry(e.id)} className="!p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" />
                                </Td>
                              </Tr>
                            )
                          })}
                        </TBody>
                      </Table>
                    </Card>
                  </div>
                )
              })
            })()
          )}
        </div>
      )}
    </div>
  )
}