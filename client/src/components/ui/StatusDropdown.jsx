import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// Native <select> elements render their open option-list using the browser's
// own styling, which can't be reliably forced into a dark theme across
// browsers (that's the washed-out white/orange dropdown you saw). This is a
// fully custom dropdown instead — same look everywhere, same interaction
// pattern as the other dropdowns in this app (filter menu, customer search).

const ORDER_STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending',     classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'in_progress', label: 'In Progress', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'ready',       label: 'Ready',       classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'delivered',   label: 'Delivered',   classes: 'bg-slate-800 text-slate-400 border-slate-700' },
]

export default function StatusDropdown({ value, onChange, options = ORDER_STATUS_OPTIONS }) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value) || options[0]

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${current.classes}`}
      >
        {current.label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute top-[calc(100%+4px)] left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[100] min-w-[150px] overflow-hidden py-1">
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-slate-700/60 transition-colors text-left"
              >
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${o.classes}`}>
                  {o.label}
                </span>
                {o.value === value && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
