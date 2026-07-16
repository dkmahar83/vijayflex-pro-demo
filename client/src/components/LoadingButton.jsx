import { Loader2 } from 'lucide-react'

// Poori site ke liye ek consistent loading-button — jahan bhi "Saving..." text-only
// tha ya kuch nahi tha, wahan is se replace karenge. Existing style/color as-is
// pass hota hai, sirf loading=true hone par spinner + disabled add hota hai.
function LoadingButton({ loading, disabled, children, loadingText, style, ...rest }) {
  return (
    <button
      disabled={loading || disabled}
      style={{
        ...style,
        cursor: (loading || disabled) ? 'not-allowed' : (style?.cursor || 'pointer'),
        opacity: (loading || disabled) ? 0.6 : (style?.opacity ?? 1),
        display: 'inline-flex', alignItems: 'center',
        justifyContent: style?.justifyContent || 'center', gap: '8px'
      }}
      {...rest}
    >
      {loading && <Loader2 size={14} className="lb-spin" />}
      {loading ? (loadingText || 'Saving...') : children}
    </button>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('loading-btn-spin-style')) {
  const style = document.createElement('style')
  style.id = 'loading-btn-spin-style'
  style.textContent = `.lb-spin { animation: lb-spin-anim 0.7s linear infinite; } @keyframes lb-spin-anim { to { transform: rotate(360deg); } }`
  document.head.appendChild(style)
}

export default LoadingButton