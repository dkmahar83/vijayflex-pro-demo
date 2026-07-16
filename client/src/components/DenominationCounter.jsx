import { useState } from 'react'
import { Calculator, ChevronUp, ChevronDown } from 'lucide-react'

const DENOMINATIONS = [
  { label: '₹500', value: 500 },
  { label: '₹200', value: 200 },
  { label: '₹100', value: 100 },
  { label: '₹50',  value: 50 },
  { label: '₹20',  value: 20 },
  { label: '₹10',  value: 10 },
  { label: '₹5',   value: 5 },
  { label: '₹2',   value: 2 },
  { label: '₹1',   value: 1 },
]

function calcTotal(counts) {
  return DENOMINATIONS.reduce((sum, d) => sum + (Number(counts[d.value]) || 0) * d.value, 0)
}

/**
 * Reusable denomination counter — collapsible, optional.
 * Tracks Cash Received and Change Returned separately, applies the NET total.
 *
 * Props:
 *  - onApply(netTotal, breakdown): breakdown = { received: {...}, returned: {...} }
 */
function DenominationCounter({ onApply, context = 'income', availableNotes = null }) {
  const [open, setOpen] = useState(false)
  const [received, setReceived] = useState({})
  const [returned, setReturned] = useState({})

  const receivedTotal = calcTotal(received)
  const returnedTotal = calcTotal(returned)
  const netTotal = receivedTotal - returnedTotal

  const labels = context === 'expense'
    ? { section1: 'Cash Given', section2: 'In Return', color1: '#e74c3c', color2: '#27ae60' }
    : { section1: 'Cash Received', section2: 'Change Returned', color1: '#27ae60', color2: '#e74c3c' }

  // Drawer se cash bahar jaane wala side — isi ko available notes ke against cap karna hai.
  // 'expense' context (Cash Given) mein section1 outflow hai; 'income' (default) mein section2 (Change Returned) outflow hai.
  const section1IsOutflow = context === 'expense'

  function bump(setter, value, delta, isOutflowSection) {
    setter(prev => {
      const current = Number(prev[value]) || 0
      let next = Math.max(0, current + delta)
      // Outflow side ko available notes se zyada nahi badhne dena — jitna physically drawer
      // mein hai usse zyada "diya" ya "wapas kiya" nahi ja sakta.
      if (availableNotes && isOutflowSection && delta > 0) {
        const available = Number(availableNotes[value]) || 0
        if (next > available) next = current
      }
      return { ...prev, [value]: next }
    })
  }

  function handleApply() {
    onApply(netTotal, { received, returned })
  }

  function handleClear() {
    setReceived({})
    setReturned({})
  }

  function renderSection(title, counts, setCounts, accentColor, total, isOutflowSection) {
    return (
      <div style={{ ...styles.section, borderColor: accentColor }}>
        <div style={{ ...styles.sectionHeader, color: accentColor }}>
          {title} <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>₹{total.toLocaleString('en-IN')}</span>
        </div>
        <div style={styles.grid}>
          {DENOMINATIONS.map(d => {
            const count = Number(counts[d.value]) || 0
            const available = availableNotes ? (Number(availableNotes[d.value]) || 0) : null
            const atLimit = isOutflowSection && available !== null && count >= available
            return (
              <div key={d.value}>
                <div style={styles.row}>
                  <span style={styles.denomLabel}>{d.label}</span>
                  <div style={styles.stepper}>
                    <button
                      type="button"
                      onClick={() => bump(setCounts, d.value, -1, isOutflowSection)}
                      style={{ ...styles.stepBtn, opacity: count === 0 ? 0.4 : 1 }}
                      disabled={count === 0}
                    >
                      −
                    </button>
                    <span style={styles.count}>{count}</span>
                    <button
                      type="button"
                      onClick={() => bump(setCounts, d.value, 1, isOutflowSection)}
                      style={{ ...styles.stepBtn, backgroundColor: accentColor, color: '#fff', borderColor: accentColor, opacity: atLimit ? 0.4 : 1 }}
                      disabled={atLimit}
                    >
                      +
                    </button>
                  </div>
                </div>
                {atLimit && (
                  <div style={{ fontSize: '10px', color: '#e74c3c', marginTop: '2px', textAlign: 'center' }}>
                    {available === 0 ? 'Cash hi nahi hai' : `Sirf ${available} bache hain`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...styles.toggleBtn, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <Calculator size={14} /> {open ? 'Hide' : 'Note Counting (Galla Check)'} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div style={styles.panel}>
          {renderSection(labels.section1, received, setReceived, labels.color1, receivedTotal, section1IsOutflow)}
          {renderSection(labels.section2, returned, setReturned, labels.color2, returnedTotal, !section1IsOutflow)}

          <div style={styles.footer}>
            <div style={styles.totalBox}>
              Net Total: <strong style={{ color: netTotal >= 0 ? '#1a1a2e' : '#e74c3c' }}>
                ₹{netTotal.toLocaleString('en-IN')}
              </strong>
              {returnedTotal > 0 && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  {context === 'expense'
                    ? `₹${receivedTotal.toLocaleString('en-IN')} given − ₹${returnedTotal.toLocaleString('en-IN')} in return`
                    : `₹${receivedTotal.toLocaleString('en-IN')} received − ₹${returnedTotal.toLocaleString('en-IN')} returned`}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={handleClear} style={styles.clearBtn}>Clear</button>
              <button type="button" onClick={handleApply} style={styles.applyBtn} disabled={netTotal === 0}>
                Use this total
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: { marginTop: '10px', marginBottom: '10px' },
  toggleBtn: {
    backgroundColor: '#f8f8f8', border: '1px solid #ddd', borderRadius: '6px',
    padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#555'
  },
  panel: {
    border: '1px solid #ddd', borderRadius: '8px', padding: '14px',
    marginTop: '8px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '14px'
  },
  section: { backgroundColor: '#fff', borderRadius: '8px', border: '1.5px solid', padding: '10px' },
  sectionHeader: { display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', backgroundColor: '#f9f9f9', padding: '6px 8px', borderRadius: '6px' },
  denomLabel: { fontSize: '13px', fontWeight: 'bold', color: '#1a1a2e', minWidth: '36px' },
  stepper: { display: 'flex', alignItems: 'center', gap: '6px' },
  stepBtn: { width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 },
  count: { fontSize: '14px', fontWeight: 'bold', minWidth: '18px', textAlign: 'center' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  totalBox: { fontSize: '15px', color: '#1a1a2e' },
  clearBtn: { backgroundColor: '#fff', border: '1px solid #ddd', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#888' },
  applyBtn: { backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }
}

export default DenominationCounter