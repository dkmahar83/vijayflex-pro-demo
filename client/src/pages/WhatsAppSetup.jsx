import { useState, useEffect, useRef } from 'react'
import { getWhatsAppStatus, getWhatsAppQR } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import { Smartphone, CheckCircle2, Clock, XCircle, Lock } from 'lucide-react'

const STATUS_META = {
  ready:         { dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2, label: 'WhatsApp Connected — Ready to send bills' },
  qr_pending:    { dot: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: Clock,        label: 'Scan QR Code to connect' },
  initializing:  { dot: 'bg-slate-500',   text: 'text-slate-300',   bg: 'bg-slate-800/60',   border: 'border-slate-700',      icon: Clock,        label: 'Starting WhatsApp...' },
  authenticated: { dot: 'bg-slate-500',   text: 'text-slate-300',   bg: 'bg-slate-800/60',   border: 'border-slate-700',      icon: Clock,        label: 'Authenticating...' },
  checking:      { dot: 'bg-slate-500',   text: 'text-slate-300',   bg: 'bg-slate-800/60',   border: 'border-slate-700',      icon: Clock,        label: 'Checking WhatsApp status...' },
  disabled:      { dot: 'bg-slate-600',   text: 'text-slate-400',   bg: 'bg-slate-800/40',   border: 'border-slate-700',      icon: Lock,         label: 'WhatsApp Disabled in Demo due to security reasons' },
  disconnected:  { dot: 'bg-slate-600',   text: 'text-slate-300',   bg: 'bg-slate-800/60',   border: 'border-slate-700',      icon: XCircle,      label: 'WhatsApp Disconnected' },
  error:         { dot: 'bg-red-500',     text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     icon: XCircle,      label: 'WhatsApp Disconnected' },
}

function WhatsAppSetup() {
  const [status, setStatus] = useState('checking')
  const [qr, setQr] = useState(null)
  const intervalRef = useRef(null)

  function checkStatus() {
    getWhatsAppStatus()
      .then(res => {
        setStatus(res.data.status)
        if (res.data.status === 'qr_pending') {
          getWhatsAppQR().then(r => setQr(r.data.qr))
        } else {
          setQr(null)
        }
        // In the demo, WhatsApp is permanently disabled — the status will
        // never change, so polling every 3s forever is wasted work. Stop the
        // interval as soon as 'disabled' is confirmed once.
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

  const meta = STATUS_META[status] || STATUS_META.disconnected
  const StatusIcon = meta.icon

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="WhatsApp Setup" subtitle="Connect WhatsApp to send bills directly from Orders" />

      <div className={`rounded-2xl p-5 border ${meta.bg} ${meta.border}`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full shrink-0 ${meta.dot}`} />
          <strong className={`flex items-center gap-2 text-sm ${meta.text}`}>
            <StatusIcon className="w-4 h-4" /> {meta.label}
          </strong>
        </div>

        {status === 'ready' && (
          <p className="text-xs text-slate-400 mt-2.5 ml-6">
            You can now send bills directly from the Orders page using the{' '}
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold"><Smartphone className="w-3 h-3" /> WA</span> button.
          </p>
        )}
        {status === 'disabled' && (
          <p className="text-xs text-slate-500 mt-2.5 ml-6">
            For security reasons, WhatsApp integration is kept disabled in this demo version.
          </p>
        )}
      </div>

      {status === 'qr_pending' && qr && (
        <Card className="text-center">
          <h3 className="text-white font-bold mb-3">Scan with WhatsApp</h3>
          <p className="text-slate-400 text-xs mb-5">
            Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan this code
          </p>
          <div className="inline-block bg-white p-3 rounded-2xl shadow-lg">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`}
              alt="WhatsApp QR Code"
              className="w-[220px] h-[220px] rounded-xl"
            />
          </div>
          <p className="text-slate-500 text-[11px] mt-4">QR code refreshes automatically every 3 seconds</p>
        </Card>
      )}

      {status === 'ready' && (
        <Card>
          <h3 className="text-white font-bold mb-3">How to send a bill</h3>
          <ol className="text-slate-300 text-sm space-y-2 pl-5 list-decimal">
            <li>Go to <strong className="text-white">Orders</strong> page</li>
            <li>Find the order you want to bill</li>
            <li>Click the <span className="inline-flex items-center gap-1 text-[#25D366] font-bold"><Smartphone className="w-3.5 h-3.5" /> WA</span> button</li>
            <li>Bill is automatically sent to customer's WhatsApp</li>
          </ol>
        </Card>
      )}

      {(status === 'disconnected' || status === 'error') && (
        <Card>
          <p className="text-slate-400 text-sm">
            WhatsApp is initializing. Please wait a moment and the QR code will appear.
            Make sure the server is running.
          </p>
        </Card>
      )}

      {status === 'disabled' && (
        <Card className="text-center">
          <Lock className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            This is a demo/preview environment — this feature is permanently disabled here
            so messages are never sent to real customer WhatsApp numbers.
          </p>
        </Card>
      )}
    </div>
  )
}

export default WhatsAppSetup