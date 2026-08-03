// Reusable status pill. `tone` maps to one consistent color recipe so every
// "pending / paid / overdue / out of stock" badge across the whole app looks
// the same instead of each page inventing its own colors.
//
// Usage: <Badge tone="amber">Pending</Badge>

const TONES = {
  slate:   'bg-slate-800 text-slate-400 border-slate-700',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  sky:     'bg-sky-500/15 text-sky-400 border-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  teal:    'bg-teal-500/15 text-teal-400 border-teal-500/30',
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red:     'bg-red-500/15 text-red-400 border-red-500/30',
  orange:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

export default function Badge({ tone = 'slate', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${TONES[tone] || TONES.slate} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  )
}
