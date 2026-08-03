// Shared modal shell: dark backdrop, click-outside-to-close, centered dark
// card. Every confirm dialog / small form popup in the app should use this
// instead of re-implementing the same fixed-inset-backdrop-flex pattern.

export default function Modal({ open, onClose, children, width = '380px' }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl w-full"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  )
}
