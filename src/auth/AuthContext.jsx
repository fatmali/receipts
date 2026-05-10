import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setSecret as sessionSetSecret, clearSecret as sessionClearSecret } from './session.js';
import { clearAllCache } from '../api/cache.js';

const AuthContext = createContext(null);

const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }) {
  const [isSetup, setIsSetup] = useState(
    () => localStorage.getItem('receipts_setup_complete') === 'true'
  );
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [secret, setSecretState] = useState(null);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    setSecretState(null);
    sessionClearSecret();
  }, []);

  const unlock = useCallback((decryptedSecret) => {
    setSecretState(decryptedSecret);
    setIsUnlocked(true);
    sessionSetSecret(decryptedSecret);
    // Clear stale cache so fresh data is fetched after auth
    clearAllCache().catch(() => {});
  }, []);

  const completeSetup = useCallback(() => {
    localStorage.setItem('receipts_setup_complete', 'true');
    setIsSetup(true);
  }, []);

  const setSecret = useCallback((s) => {
    setSecretState(s);
  }, []);

  // Auto-lock on inactivity
  useEffect(() => {
    if (!isUnlocked) return;

    let timer = setTimeout(lock, AUTO_LOCK_MS);

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, AUTO_LOCK_MS);
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [isUnlocked, lock]);

  // Lock on visibility change (app goes to background)
  useEffect(() => {
    if (!isUnlocked) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isUnlocked, lock]);

  return (
    <AuthContext.Provider
      value={{ isSetup, isUnlocked, secret, setSecret, lock, unlock, completeSetup }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
