import { useState } from 'react'
import { login } from '../services/api'
import { Printer, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) return setError('Please enter username and password.')
    setLoading(true)
    setError('')

    login(username, password)
      .then(res => {
        localStorage.setItem('flexshop_token', res.data.token)
        localStorage.setItem('flexshop_user', JSON.stringify(res.data.user))
        onLogin(res.data.user)
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Login failed. Please try again.')
        setLoading(false)
      })
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoBox}>
          <div style={styles.logoIcon}><Printer size={40} color="#1a1a2e" /></div>
          <h1 style={styles.logoText}>VijayFlex Pro</h1>
          <p style={styles.logoSub}>Pilibangan, Rajasthan</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {error}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            style={{
              ...styles.loginBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : <><Lock size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Login</>}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={{ color: '#aaa', fontSize: '12px' }}>
            FlexShop Manager v1.0 — Secure Access
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  logoBox: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  logoIcon: {
    fontSize: '48px',
    marginBottom: '8px'
  },
  logoText: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a1a2e',
    margin: '0 0 4px 0'
  },
  logoSub: {
    fontSize: '13px',
    color: '#888',
    margin: 0
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fdd',
    color: '#e74c3c',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  field: {
    marginBottom: '20px'
  },
  label: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#555',
    display: 'block',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px'
  },
  loginBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '8px'
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px'
  }
}

export default Login