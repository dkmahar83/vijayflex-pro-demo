// client/src/components/BackupManager.jsx
// Navbar mein "💾 Backup" button — panel khulta hai
// Replaces purana BackupButton.jsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../services/api'
import { Save, XCircle, CheckCircle2, Clock, Trash2, Package, Calendar, Download } from 'lucide-react'

export default function BackupManager() {
  const [showPanel, setShowPanel]       = useState(false)
  const [backups, setBackups]           = useState([])
  const btnRef = useRef(null)
  // Portal se render karne ke liye button ka screen-position chahiye —
  // sidebar ke overflow:hidden se bahar nikal ke document.body mein
  // render hoga, isliye parent-relative (position:absolute) kaam nahi
  // karega, seedha fixed-coordinates chahiye.
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const [loading, setLoading]           = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)
  const [msg, setMsg]                   = useState('')
  const [msgSuccess, setMsgSuccess]     = useState(false)

  const fetchBackups = useCallback(() => {
    setLoading(true)
    api.get('/backup/list')
      .then(r => setBackups(r.data.backups || []))
      .catch(() => { setMsg('List load nahi hui'); setMsgSuccess(false) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
  if (!showPanel) return
  fetchBackups() // eslint-disable-line react-hooks/set-state-in-effect
}, [showPanel, fetchBackups])

  function handleManualBackup() {
    setRunningBackup(true)
    setMsg('')
    api.post('/backup/run')
      .then(() => { setMsg('Backup complete ho gaya!'); setMsgSuccess(true); fetchBackups() })
      .catch(e => { setMsg(e.response?.data?.error || 'Backup fail hua'); setMsgSuccess(false) })
      .finally(() => setRunningBackup(false))
  }

  function handleDownload(filename) {
    api.get(`/backup/download/${filename}`, { responseType: 'blob' })
      .then(r => {
        const url = window.URL.createObjectURL(new Blob([r.data]))
        const a   = document.createElement('a')
        a.href     = url
        a.download = filename
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => { setMsg('Download fail hua'); setMsgSuccess(false) })
  }

  // ── Styles (inline — koi extra CSS file nahi chahiye) ──────────────────────
  const btn = {
    background: 'transparent', border: '1px solid #444', color: '#ccc',
    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
  }

  function togglePanel() {
    if (!showPanel && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const panelWidth = 320
      let left = rect.left
      if (left + panelWidth > window.innerWidth - 16) {
        left = window.innerWidth - panelWidth - 16
      }
      if (left < 16) left = 16
      setPanelPos({ bottom: window.innerHeight - rect.top + 8, left })
    }
    setShowPanel(s => !s)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Navbar button */}
      <button ref={btnRef} onClick={togglePanel} style={btn}>
        <Save size={14} /> Backup
      </button>

      {showPanel && createPortal(
        <>
          {/* Click-outside overlay */}
          <div
            onClick={() => setShowPanel(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
          />

          {/* Panel — button sidebar ke bottom mein hai, isliye upar (top ki taraf)
              khulta hai (neeche khulta to viewport ke bahar chala jaata). Aur
              left:0 se anchor kiya (right:0 nahi) — sidebar khud sirf ~200px
              chauda hai jabki panel 320px ka hai; right-anchor karne se panel
              left-direction mein overflow hoke screen ke bahar chala jaata tha.
              left:0 se ye sidebar ke right-side (main content ke upar) overlay
              hoga, jahan jagah available hai. */}
          <div style={{
            position: 'fixed', bottom: `${panelPos.bottom}px`, left: `${panelPos.left}px`, zIndex: 999,
            background: '#fff', borderRadius: '12px', padding: '18px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.18)', width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            border: '1px solid #eee'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={15} /> Database Backup</div>
              <button onClick={() => setShowPanel(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}>
                ×
              </button>
            </div>

            {/* Info box */}
            <div style={{
              background: '#f0fff4', border: '1px solid #c3e6cb', borderRadius: '8px',
              padding: '10px 12px', fontSize: '12px', color: '#2e7d32',
              marginBottom: '14px', lineHeight: '1.6'
            }}>
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '4px' }}><Clock size={12} style={{ marginTop: '2px', flexShrink: 0 }} /> <span><strong>Auto backup:</strong> Har raat 11:00 PM IST</span></span>
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '4px' }}><CheckCircle2 size={12} style={{ marginTop: '2px', flexShrink: 0 }} /> <span><strong>Backup mein kya hai:</strong> Orders, payments, customers, ledger, cash, expenses, employees — sab kuch!</span></span>
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}><Trash2 size={12} style={{ marginTop: '2px', flexShrink: 0 }} /> <span>30 din purane backups auto-delete</span></span>
            </div>

            {/* Manual backup button */}
            <button
              onClick={handleManualBackup}
              disabled={runningBackup}
              style={{
                width: '100%', padding: '10px',
                background: runningBackup ? '#ccc' : '#1a1a2e',
                color: '#fff',
                border: runningBackup ? '1px solid #ccc' : '1px solid #1a1a2e',
                borderRadius: '8px',
                cursor: runningBackup ? 'not-allowed' : 'pointer',
                fontWeight: '600', fontSize: '13px', marginBottom: '12px'
              }}
            >
              {runningBackup ? <><Clock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Backup ho raha hai...</> : <><Package size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />Abhi Backup Lo</>}
            </button>

            {/* Message */}
            {msg && (
              <div style={{
                fontSize: '12px', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px',
                background: msgSuccess ? '#f0fff4' : '#fff5f5',
                color: msgSuccess ? '#2e7d32' : '#c62828',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                {msgSuccess ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {msg}
              </div>
            )}

            {/* Backup list header */}
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '8px' }}>
              Saved Backups ({backups.length})
            </div>

            {/* List */}
            {loading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '12px', fontSize: '13px' }}>Loading...</div>
            ) : backups.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#aaa', padding: '12px', fontSize: '12px' }}>
                Koi backup nahi hai.<br/>Upar se "Abhi Backup Lo" karo.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {backups.map(b => (
                  <div key={b.filename} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid #f5f5f5'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#333', display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={12} /> {b.date}</div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{b.size_mb} MB</div>
                    </div>
                    <button
                      onClick={() => handleDownload(b.filename)}
                      style={{
                        background: '#fff', border: '1px solid #1a1a2e', color: '#1a1a2e',
                        borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: '600',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Download size={11} /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#bbb', marginTop: '10px', textAlign: 'center' }}>
              Recovery: backup file ko flexshop.db naam se replace karo, server restart karo
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
