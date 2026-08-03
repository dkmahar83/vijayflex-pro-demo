import { useState } from 'react'
import { LogOut } from 'lucide-react'
import Navbar from './Navbar'
import Header from './Header'
import Modal from './ui/Modal'
import { DangerButton, SecondaryButton } from './ui/Button'

// The one place that assembles Sidebar + Topbar + page content + the shared
// logout-confirm dialog (triggered from either the sidebar's Logout button
// or the header's user-menu Sign Out — same dialog, no duplication).
function AppLayout({ user, onLogout, children }) {
  const [contentMargin, setContentMargin] = useState(256)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar
        user={user}
        onRequestLogout={() => setShowLogoutConfirm(true)}
        onLayoutChange={setContentMargin}
      />

      <div
        style={{ marginLeft: contentMargin }}
        className="flex flex-col min-h-screen min-w-0 overflow-x-hidden transition-[margin-left] duration-200 ease-in-out"
      >
        <Header user={user} onRequestLogout={() => setShowLogoutConfirm(true)} />
        <main className="flex-1 min-w-0 p-6">{children}</main>
      </div>

      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} width="340px">
        <h3 className="text-white font-bold flex items-center gap-2 mb-2.5">
          <LogOut className="w-4 h-4" /> Log Out?
        </h3>
        <p className="text-sm text-slate-400 mb-5">
          You'll need to sign in again to start a new session.
        </p>
        <div className="flex gap-2.5">
          <SecondaryButton className="flex-1 justify-center py-2.5" onClick={() => setShowLogoutConfirm(false)}>
            Cancel
          </SecondaryButton>
          <DangerButton
            className="flex-1 justify-center py-2.5"
            onClick={() => { setShowLogoutConfirm(false); onLogout() }}
          >
            Yes, Logout
          </DangerButton>
        </div>
      </Modal>
    </div>
  )
}

export default AppLayout
