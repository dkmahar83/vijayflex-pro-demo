import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import { verifyToken } from './services/api'

// Lazy-loaded pages — each becomes its own chunk, loaded on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'))
const Orders = lazy(() => import('./pages/Orders'))
const Employees = lazy(() => import('./pages/Employees'))
const DailySales = lazy(() => import('./pages/DailySales'))
const Accounts = lazy(() => import('./pages/Accounts'))
const RecycleBin = lazy(() => import('./pages/RecycleBin'))
const Reports = lazy(() => import('./pages/Reports'))
const Inventory = lazy(() => import('./pages/Inventory'))
const WhatsAppSetup = lazy(() => import('./pages/WhatsAppSetup'))
const UpiQR = lazy(() => import('./pages/UpiQR'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-base">
      Loading...
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('flexshop_token')
    const savedUser = localStorage.getItem('flexshop_user')

    if (token && savedUser) {
      verifyToken(token)
        .then(res => {
          if (res.data.valid) {
            setUser(JSON.parse(savedUser))
          } else {
            localStorage.removeItem('flexshop_token')
            localStorage.removeItem('flexshop_user')
          }
        })
        .catch(() => {
          localStorage.removeItem('flexshop_token')
          localStorage.removeItem('flexshop_user')
        })
        .finally(() => {
          setChecking(false)   // ✅ finally mein move kiya
        })
    } else {
        setTimeout(() => setChecking(false), 0)   // ✅ ye karo
      }
  }, [])

  function handleLogin(userData) {
    setUser(userData)
  }

  function handleLogout() {
    localStorage.removeItem('flexshop_token')
    localStorage.removeItem('flexshop_user')
    setUser(null)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-300 text-lg">🖨️ Loading VijayFlex Pro...</div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <BrowserRouter>
      <AppLayout user={user} onLogout={handleLogout}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerProfile />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/daily-sales" element={<DailySales />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/bin" element={<RecycleBin />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/whatsapp" element={<WhatsAppSetup />} />
            <Route path="/upi-qr" element={<UpiQR />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  )
}

export default App