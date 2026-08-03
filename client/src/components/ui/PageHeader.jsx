// The banner every page opens with: title (+ optional pill badge), a
// subtitle line, and a slot on the right for page-specific action buttons.
// Keeps every page's header spacing/typography identical instead of each
// page hand-rolling its own <h1> + padding.

export default function PageHeader({ title, badge, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          {badge && (
            <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-500/20">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  )
}
