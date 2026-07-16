import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Lock, AlertTriangle, Delete } from 'lucide-react';

// ─── PageLock wrapper ─────────────────────────────────────────────────────────
// Usage: wrap your page with <PageLock pageKey="accounts" pageTitle="Accounts"> ... </PageLock>
// pageKey: 'accounts' or 'employees'

export default function PageLock({ pageKey, pageTitle, children }) {
  const [status, setStatus] = useState('loading'); // loading | locked | unlocked | no-pin
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef(null);

  async function checkLockStatus() {
    try {
      const res = await api.get(`/page-locks/${pageKey}`);
      const { is_locked } = res.data;
      // PIN ab fixed/global hai — 'no-pin' setup-screen ka concept khatam,
      // koi bhi page seedha 'locked' ya 'unlocked' hi ho sakti hai.
      setStatus(is_locked ? 'locked' : 'unlocked');
    } catch {
      setStatus('unlocked'); // If error, don't block
    }
  }

  async function handleVerify() {
    if (pin.length !== 4) { setError('4 digit PIN daalo'); return; }
    setVerifying(true);
    setError('');
    try {
      await api.post(`/page-locks/${pageKey}/verify`, { pin });
      setStatus('unlocked');
      setPin('');
    } catch (e) {
      setError(e.response?.data?.error || 'Galat PIN');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkLockStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  useEffect(() => {
    if (status === 'locked' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [status]);

  const handlePinKey = (e) => {
    if (e.key === 'Enter') handleVerify();
  };

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ color: '#888' }}>Loading...</div>
      </div>
    );
  }

  if (status === 'unlocked') {
    return (
      <>
        {children}
        <LockSettingsButton pageKey={pageKey} onLock={() => setStatus('locked')} />
      </>
    );
  }

  // LOCKED screen — PIN fixed hai, isliye ab sirf ek hi state possible hai
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px 36px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
        maxWidth: '320px', width: '100%', border: '1px solid #eee'
      }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#e65100' }}>
          <Lock size={44} />
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: '18px', color: '#333' }}>
          {pageTitle} Locked
        </h2>

        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#888', lineHeight: '1.5' }}>
          Access ke liye apna PIN daalo
        </p>

        <PinEntry
          pin={pin}
          setPin={setPin}
          error={error}
          verifying={verifying}
          inputRef={inputRef}
          onVerify={handleVerify}
          onKeyDown={handlePinKey}
        />
      </div>
    </div>
  );
}

// ─── PIN Entry (number pad style) ─────────────────────────────────────────────
function PinEntry({ pin, setPin, error, verifying, inputRef, onVerify, onKeyDown }) {
  const digits = [1,2,3,4,5,6,7,8,9,'',0,'⌫'];

  const handleDigit = (d) => {
    if (d === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (d === '') return;
    if (pin.length >= 4) return;
    setPin(p => p + String(d));
  };

  return (
    <>
      {/* PIN dots display */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '20px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: '14px', height: '14px', borderRadius: '50%',
            background: i < pin.length ? '#e65100' : '#e0e0e0',
            transition: 'background 0.1s'
          }} />
        ))}
      </div>

      {/* Hidden input for keyboard entry */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,4))}
        onKeyDown={onKeyDown}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />

      {/* Number pad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px', maxWidth: '240px', margin: '0 auto 16px'
      }}>
        {digits.map((d, i) => (
          <button
            key={i}
            onClick={() => handleDigit(d)}
            style={{
              padding: '14px', fontSize: '20px',
              fontWeight: '500', border: '1px solid #eee', borderRadius: '10px',
              background: d === '' ? 'transparent' : '#fafafa',
              cursor: d === '' ? 'default' : 'pointer',
              color: '#333', transition: 'background 0.1s',
              visibility: d === '' ? 'hidden' : 'visible',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => { if (d !== '') e.target.style.background = '#fff3e0'; }}
            onMouseLeave={e => { if (d !== '') e.target.style.background = '#fafafa'; }}
          >
            {d === '⌫' ? <Delete size={18} /> : d}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ color: '#c62828', fontSize: '13px', marginBottom: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button
        onClick={onVerify}
        disabled={verifying || pin.length !== 4}
        style={{
          width: '100%', padding: '12px',
          background: pin.length === 4 ? '#e65100' : '#ccc',
          color: '#fff', border: 'none', borderRadius: '8px',
          fontSize: '14px', fontWeight: '600', cursor: pin.length === 4 ? 'pointer' : 'not-allowed'
        }}
      >
        {verifying ? 'Verify ho raha hai...' : 'Unlock'}
      </button>
    </>
  );
}

// ─── Lock Settings Button (shown when unlocked) ────────────────────────────────
function LockSettingsButton({ pageKey, onLock }) {
  const [showPanel, setShowPanel] = useState(false);

  const handleLockNow = async () => {
    try {
      await api.post(`/page-locks/${pageKey}/toggle`, { is_locked: true });
      onLock();
    } catch {
      alert('Lock nahi hua');
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={{
          background: '#333', color: '#fff', border: 'none', borderRadius: '50px',
          padding: '8px 16px', fontSize: '12px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}
      >
        <Lock size={14} /> Lock Settings
      </button>

      {showPanel && (
        <div style={{
          position: 'absolute', bottom: '44px', right: 0,
          background: '#fff', borderRadius: '12px', padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', width: '200px',
          border: '1px solid #eee'
        }}>
          <button
            onClick={handleLockNow}
            style={{
              width: '100%', padding: '8px', marginBottom: '8px',
              background: '#e65100', color: '#fff', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <Lock size={14} /> Abhi Lock Karo
          </button>

          <button
            onClick={() => setShowPanel(false)}
            style={{
              width: '100%', padding: '6px', background: 'none',
              border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#888'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
