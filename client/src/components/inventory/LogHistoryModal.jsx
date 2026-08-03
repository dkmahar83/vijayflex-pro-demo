import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import { History, Plus, Minus, Pencil } from 'lucide-react'
import { getInventoryLog } from '../../services/api'

const TABLE_LABELS = {
  inventory_flex: 'Flex Rolls',
  inventory_stamps: 'Stamps',
  inventory_chemicals: 'Chemicals',
  inventory_frames: 'Photo Frames',
  inventory_ink: 'Ink & Solvent',
  inventory_dynamic_items: 'Custom Category',
}

const ACTION_META = {
  add: { tone: 'emerald', icon: Plus, label: 'Added' },
  use: { tone: 'amber', icon: Minus, label: 'Used' },
  update: { tone: 'blue', icon: Pencil, label: 'Updated' },
}

function formatDate(dateString) {
  if (!dateString) return ''
  const d = new Date(dateString.replace(' ', 'T') + (dateString.includes('Z') ? '' : 'Z'))
  if (isNaN(d)) return dateString
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LogHistoryModal({ open, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getInventoryLog()
      .then(r => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} width="560px">
      <h3 className="text-white font-bold mb-1 flex items-center gap-2"><History className="w-4.5 h-4.5" /> Inventory Log History</h3>
      <p className="text-xs text-slate-400 mb-4">Last 100 stock changes across every category.</p>

      <div className="max-h-[440px] overflow-y-auto space-y-2 pr-1">
        {loading && <p className="text-sm text-slate-500 py-6 text-center">Loading...</p>}
        {!loading && logs.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No stock changes logged yet.</p>}
        {!loading && logs.map(entry => {
          const meta = ACTION_META[entry.action] || ACTION_META.update
          return (
            <div key={entry.id} className="flex items-start justify-between gap-3 bg-slate-800/40 border border-slate-800 rounded-xl px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-white truncate">{entry.item_name}</span>
                  <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {TABLE_LABELS[entry.table_name] || entry.table_name} · {entry.quantity_before} → {entry.quantity_after}
                  {entry.notes ? ` · ${entry.notes}` : ''}
                </p>
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{formatDate(entry.created_at)}</span>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
