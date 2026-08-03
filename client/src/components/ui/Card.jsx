// The one card container the whole app should use for panels, tables-in-a-box,
// forms, etc. `padded` controls the standard p-6 inset (turn off when a child
// needs edge-to-edge content, e.g. a table that manages its own cell padding).

export default function Card({ children, className = '', padded = true, as: As = 'div', ...props }) {
  return (
    <As
      className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-xl ${padded ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </As>
  )
}
