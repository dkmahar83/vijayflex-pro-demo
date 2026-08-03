// Shared button variants — every "New Order" / "Cancel" / icon-only button
// in the app should compose one of these instead of hand-rolling padding,
// radius, and color combinations per page.

export function PrimaryButton({ icon: Icon, children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}

export function SecondaryButton({ icon: Icon, children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}

export function DangerButton({ icon: Icon, children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, className = '', ...props }) {
  return (
    <button
      className={`p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all ${className}`}
      {...props}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
