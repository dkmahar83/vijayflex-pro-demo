import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getUpiQrHistory, addUpiQrHistory, toggleUpiQrPaid, deleteUpiQrHistory, clearUpiQrHistory } from '../services/api'
import {
  Smartphone, Printer, ClipboardList, Check, Zap, Download,
  RefreshCw, StickyNote, Trash2, X, CheckCircle2, Calendar,
} from 'lucide-react'
import SectionLoader from '../components/SectionLoader'

const UPI_ACCOUNTS = [
  { label: 'BOI Shop Account',               upi: 'boism-9950580621@boi',        name: 'Vijay Flex' },
  { label: 'Google Pay - Rampratap Painter', upi: 'gpay-11263065173@okbizaxis',      name: 'Rampratap Painter' },
  { label: 'PhonePe - Bhavya Printers',      upi: 'q214575569@ybl',   name: 'Bhavya Printers' },
  { label: 'Amazon Pay - Deepak',            upi: '7073580621@yapl',           name: 'Deepak' },
]

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

  const acc = UPI_ACCOUNTS[selectedIdx]

  useEffect(() => { refreshHistory() }, [])

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
    if (!amount || parseFloat(amount) <= 0) return alert('Amount daalo pehle')
    setGenerating(true)
    try {
      const upiStr = buildUpiString()
      const url = await QRCode.toDataURL(upiStr, {
        width: 320, margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
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
      alert('QR generate karne mein error: ' + e.message)
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
      alert('Update fail hua: ' + (e.response?.data?.error || e.message))
    }
  }

  async function deleteEntry(id) {
    try {
      await deleteUpiQrHistory(id)
      setHistory(history.filter(h => h.id !== id))
    } catch (e) {
      alert('Delete fail hua: ' + (e.response?.data?.error || e.message))
    }
  }

  async function clearAll() {
    if (!window.confirm('Saari history delete karni hai?')) return
    try {
      await clearUpiQrHistory()
      setHistory([])
    } catch (e) {
      alert('Clear fail hua: ' + (e.response?.data?.error || e.message))
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

  const accColors = ['#1a237e','#1a73e8','#5f259f','#ff9900']

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 0 40px' }}>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}><Smartphone size={20} /> UPI QR Generator</h2>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: "Today Received (Marked)", val: `₹${todayTotal.toFixed(0)}`, color: '#27ae60', bg: '#f0fdf4' },
          { label: "Pending Confirmations",   val: pendingCount,                 color: '#f39c12', bg: '#fffbeb' },
          { label: "Total QRs Today",         val: todayHistory.length,          color: '#3b82f6', bg: '#eff6ff' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} style={{ flex: 1, minWidth: '140px', background: bg, border: `1px solid ${color}30`, borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{val}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['generator',<><Printer size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Generate QR</>],['history',<><ClipboardList size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Payment History</>]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px',
            background: activeTab === key ? '#1a1a2e' : '#fff',
            color: activeTab === key ? '#fff' : '#555',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'generator' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

              <div style={{ marginBottom: '20px' }}>
                <label style={ls.label}>UPI Account Select karo *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {UPI_ACCOUNTS.map((a, i) => (
                    <button key={i} onClick={() => { setSelectedIdx(i); setQrUrl('') }} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      border: selectedIdx === i ? `2px solid ${accColors[i]}` : '2px solid #eee',
                      background: selectedIdx === i ? accColors[i] + '12' : '#fafafa',
                      transition: 'all .15s'
                    }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: accColors[i], flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a2e' }}>{a.label}</div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>{a.upi}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Selected UPI ID</div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a2e' }}>{acc.upi}</div>
                </div>
                <button onClick={copyUpiId} style={{ background: copied ? '#27ae60' : '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {copied ? <><Check size={12} /> Copied</> : 'Copy'}
                </button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={ls.label}>Amount (₹) *</label>
                <input
                  type="number" placeholder="0" value={amount}
                  onChange={e => { setAmount(e.target.value); setQrUrl('') }}
                  style={{ ...ls.input, fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={ls.label}>Remarks (Optional)</label>
                <input placeholder="e.g. Invoice #45, Flex Order" value={remarks}
                  onChange={e => { setRemarks(e.target.value); setQrUrl('') }}
                  style={ls.input}
                />
              </div>

              <button onClick={generateQR} disabled={generating || !amount} style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: !amount ? '#ccc' : '#1a1a2e', color: '#fff',
                fontSize: '16px', fontWeight: 700, cursor: !amount ? 'not-allowed' : 'pointer'
              }}>
                {generating ? 'Generating…' : <><Zap size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Generate QR Code</>}
              </button>

              <div style={{ marginTop: '16px', textAlign: 'center', color: '#aaa', fontSize: '11px' }}>
                Works with GPay • PhonePe • Paytm • BHIM • all UPI apps
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {!qrUrl ? (
                <div style={{ color: '#ccc' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Smartphone size={56} /></div>
                  <div style={{ fontSize: '14px' }}>UPI ID aur amount choose karo,<br/>phir Generate karo</div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#27ae60', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={14} /> QR Ready</div>
                  <img src={qrUrl} alt="UPI QR Code" style={{ width: '240px', height: '240px', borderRadius: '12px', border: '2px solid #eee' }} />
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
                    {acc.label}<br/>
                    <span style={{ color: '#555', fontWeight: 600 }}>{acc.upi}</span>
                  </div>
                  {remarks && <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><StickyNote size={11} /> {remarks}</div>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px', width: '100%', maxWidth: '280px' }}>
                    <button onClick={downloadQR} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <Download size={13} /> Download PNG
                    </button>
                    <button onClick={() => { setQrUrl(''); setAmount(''); setRemarks('') }} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <RefreshCw size={13} /> New QR
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>{history.length} total entries</div>
            {history.length > 0 && (
              <button onClick={clearAll} style={{ background: '#fff', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>

          {loadingHistory ? (
            <SectionLoader label="History load ho rahi hai..." size="large" />
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#aaa', background: '#fff', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><ClipboardList size={36} /></div>
              <div>Abhi koi QR generate nahi hua.<br/>Generator se pehla QR banao!</div>
            </div>
          ) : (
            <div>
              {(() => {
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
                    <div key={date} style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {date === todayStr ? <><Calendar size={13} /> Today</> : date}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Received: <strong style={{ color: '#27ae60' }}>₹{dayTotal}</strong>
                          {dayPending > 0 && <span style={{ color: '#f39c12', marginLeft: '8px' }}> • {dayPending} pending</span>}
                        </div>
                      </div>

                      <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8f8f8' }}>
                              {['Time','UPI Account','Amount','Remarks','Status','Action'].map(h => (
                                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: '#888', fontWeight: 600, borderBottom: '1px solid #eee' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map(e => {
                              const aIdx = UPI_ACCOUNTS.findIndex(a => a.label === e.upi_account)
                              const col = accColors[aIdx] || '#888'
                              return (
                                <tr key={e.id} style={{ borderBottom: '1px solid #f5f5f5', background: e.paid ? '#f0fdf4' : '#fff' }}>
                                  <td style={{ padding: '10px 14px', fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>{fmtTime(e.created_at)}</td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ background: col + '18', color: col, border: `1px solid ${col}40`, borderRadius: '5px', padding: '3px 8px', fontSize: '11px', fontWeight: 600 }}>
                                      {e.upi_account.split('-')[0].trim()}
                                    </span>
                                    <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{e.upi_id}</div>
                                  </td>
                                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '16px', color: '#1a1a2e' }}>₹{e.amount.toLocaleString('en-IN')}</td>
                                  <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666' }}>{e.remarks || '—'}</td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <button onClick={() => togglePaid(e.id)} style={{
                                      padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                      background: e.paid ? '#27ae60' : '#f3f4f6',
                                      color: e.paid ? '#fff' : '#555'
                                    }}>
                                      {e.paid ? <><Check size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Received</> : 'Mark Paid'}
                                    </button>
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '16px', display: 'inline-flex', alignItems: 'center' }}><X size={15} /></button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const ls = {
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '5px', fontWeight: 600 },
  input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }
}