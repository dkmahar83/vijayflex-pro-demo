// Thin table primitives so every data table in the app shares the same
// header style, row hover, divider color, and horizontal-scroll wrapper —
// pages still compose their own <tr>/<td> cells since column shapes differ
// a lot page to page, but the base look is now centralized here.

export function Table({ children, minWidth = '640px' }) {
  return (
    <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
      <table className="w-full text-left text-xs" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children }) {
  return (
    <thead>
      <tr className="text-slate-400 border-b border-slate-800">{children}</tr>
    </thead>
  )
}

export function Th({ children, className = '', ...props }) {
  return <th className={`pb-3 pt-1 font-semibold whitespace-nowrap ${className}`} {...props}>{children}</th>
}

export function TFoot({ children }) {
  return <tfoot className="border-t border-slate-800 bg-slate-800/30">{children}</tfoot>
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-800/60">{children}</tbody>
}

export function Tr({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-800/40' : ''} ${className}`}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className = '', ...props }) {
  return <td className={`py-3.5 pr-4 align-top ${className}`} {...props}>{children}</td>
}
