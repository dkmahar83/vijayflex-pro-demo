// Halka, dependency-free section-level loader — Dashboard stats, table-fetch,
// customer-profile jaisi jagah "Loading..." text ki jagah use hoga.
// Brand colors follow karta hai (navy primary), koi external library nahi.

function SectionLoader({ label = 'Loading...', size = 'medium', minHeight }) {
  const dims = { small: 22, medium: 34, large: 46 }[size] || 34

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '10px',
      padding: size === 'small' ? '12px' : '32px',
      minHeight: minHeight || (size === 'small' ? 'auto' : '120px')
    }}>
      <svg
        width={dims} height={dims} viewBox="0 0 50 50"
        style={{ animation: 'section-loader-spin 0.9s linear infinite' }}
      >
        <circle
          cx="25" cy="25" r="20"
          fill="none" stroke="#e8e8ee" strokeWidth="5"
        />
        <circle
          cx="25" cy="25" r="20"
          fill="none" stroke="#1a1a2e" strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="31.4 94.2"
        />
      </svg>
      {label && (
        <span style={{ fontSize: size === 'small' ? '12px' : '13px', color: '#888' }}>
          {label}
        </span>
      )}
    </div>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('section-loader-spin-style')) {
  const style = document.createElement('style')
  style.id = 'section-loader-spin-style'
  style.textContent = `@keyframes section-loader-spin { to { transform: rotate(360deg); } }`
  document.head.appendChild(style)
}

export default SectionLoader