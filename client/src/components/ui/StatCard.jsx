// Small metric card: label + icon badge, big number, optional sub-line,
// colored accent bar along the bottom. Used for every "Pending Orders /
// Total Outstanding / Today's Orders / Low Stock" style tile in the app.
//
// tone drives the icon badge color + bottom accent bar; valueClassName lets a
// page recolor just the number (e.g. red when there's an outstanding balance).

const TONES = {
  blue:    { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       bar: 'bg-blue-500/40' },
  emerald: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', bar: 'bg-emerald-500/40' },
  red:     { badge: 'bg-red-500/10 text-red-400 border-red-500/20',         bar: 'bg-red-500/40' },
  amber:   { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   bar: 'bg-amber-500/40' },
  orange:  { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', bar: 'bg-orange-500/40' },
}

export default function StatCard({
  label,
  value,
  valueClassName = 'text-white',
  sub,
  icon: Icon,
  tone = 'blue',
  onClick,
}) {
  const t = TONES[tone] || TONES.blue
  const Comp = onClick ? 'button' : 'div'

  return (
    <Comp
      onClick={onClick}
      className={`bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all text-left w-full ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${t.badge}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono ${valueClassName}`}>{value}</span>
      </div>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${t.bar}`} />
    </Comp>
  )
}
