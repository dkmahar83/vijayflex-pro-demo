import { useState, useEffect, useRef } from 'react'
import { getWhatsAppStatus, getWhatsAppQR } from '../services/api'
import { Smartphone, CheckCircle2, Clock, XCircle, Lock } from 'lucide-react'

function WhatsAppSetup() {
  const [status, setStatus] = useState('checking')
  const [qr, setQr] = useState(null)
  const intervalRef = useRef(null)

  function checkStatus() {
    getWhatsAppStatus()
      .then(res => {
        setStatus(res.data.status)
        if (res.data.status === 'qr_pending') {
          getWhatsAppQR()
            .then(r => setQr(r.data.qr))
        } else {
          setQr(null)
        }
        // Demo mein WhatsApp permanently disabled hai — status kabhi badlega
        // nahi, isliye har 3 sec polling karte rehna faltu hai. Ek baar
        // 'disabled' confirm hote hi interval band kar dete hain.
        if (res.data.status === 'disabled' && intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => {
    checkStatus()
    intervalRef.current = setInterval(checkStatus, 3000) // check every 3 seconds
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Smartphone size={20} /> WhatsApp Setup</h2>

      {/* Status badge */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '8px',
        marginBottom: '24px',
        backgroundColor: status === 'ready' ? '#f0fff4' : status === 'qr_pending' ? '#fff9e6' : status === 'disabled' ? '#f5f5f5' : '#f8f8f8',
        border: `1px solid ${status === 'ready' ? '#27ae60' : status === 'qr_pending' ? '#f39c12' : status === 'disabled' ? '#ccc' : '#ddd'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            backgroundColor: status === 'ready' ? '#27ae60' : status === 'qr_pending' ? '#f39c12' : status === 'disabled' ? '#999' : '#ccc'
          }} />
          <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: status === 'disabled' ? '#777' : 'inherit' }}>
            {status === 'ready' ? <><CheckCircle2 size={15} /> WhatsApp Connected — Ready to send bills</>
              : status === 'qr_pending' ? <><Clock size={15} /> Scan QR Code to connect</>
              : status === 'initializing' ? <><Clock size={15} /> Starting WhatsApp...</>
              : status === 'authenticated' ? <><Clock size={15} /> Authenticating...</>
              : status === 'checking' ? <><Clock size={15} /> Checking WhatsApp status...</>
              : status === 'disabled' ? <><Lock size={15} /> WhatsApp Disabled in Demo due to security reasons</>
              : <><XCircle size={15} /> WhatsApp Disconnected</>}
          </strong>
        </div>
        {status === 'ready' && (
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px', marginLeft: '22px' }}>
            You can now send bills directly from the Orders page using the <Smartphone size={12} style={{ verticalAlign: 'middle' }} /> WA button.
          </p>
        )}
        {status === 'disabled' && (
          <p style={{ fontSize: '13px', color: '#999', marginTop: '8px', marginLeft: '22px' }}>
            Security reasons ki wajah se demo version mein WhatsApp integration disable rakha gaya hai.
          </p>
        )}
      </div>

      {/* QR Code display */}
      {status === 'qr_pending' && qr && (
        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '16px' }}>Scan with WhatsApp</h3>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
            Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan this code
          </p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`}
            alt="WhatsApp QR Code"
            style={{ width: '250px', height: '250px', border: '1px solid #eee', borderRadius: '8px' }}
          />
          <p style={{ color: '#aaa', fontSize: '12px', marginTop: '16px' }}>
            QR code refreshes automatically every 3 seconds
          </p>
        </div>
      )}

      {status === 'ready' && (
        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '12px' }}>How to send a bill</h3>
          <ol style={{ color: '#555', lineHeight: '2', fontSize: '14px', paddingLeft: '20px' }}>
            <li>Go to <strong>Orders</strong> page</li>
            <li>Find the order you want to bill</li>
            <li>Click the <strong style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Smartphone size={13} /> WA</strong> button</li>
            <li>Bill is automatically sent to customer's WhatsApp</li>
          </ol>
        </div>
      )}

      {(status === 'disconnected' || status === 'error') && (
        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <p style={{ color: '#888' }}>
            WhatsApp is initializing. Please wait a moment and the QR code will appear.
            Make sure the server is running.
          </p>
        </div>
      )}

      {status === 'disabled' && (
        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: '#aaa' }}>
            <Lock size={32} />
          </div>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Ye ek demo/preview environment hai — real customer WhatsApp numbers par
            messages na jaayein isliye ye feature yahan permanently disable kiya gaya hai.
          </p>
        </div>
      )}
    </div>
  )
}

export default WhatsAppSetup