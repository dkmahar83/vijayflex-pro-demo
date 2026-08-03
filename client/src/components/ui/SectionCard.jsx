import Card from './Card'

// A Card with a standard header row: title + subtitle on the left, an
// optional "View All →" style link/button on the right, then a divider
// before the body. Used for every table-in-a-panel section (Today's Orders,
// Top Outstanding Dues, Low Stock Alerts, etc.) so they all match.

export default function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}
