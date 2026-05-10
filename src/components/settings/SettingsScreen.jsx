import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { deriveKeyFromPin, encrypt, decrypt } from '../../auth/crypto.js';
import { fetchMeta } from '../../api/sheets.js';
import { getCacheInfo, clearAllCache } from '../../api/cache.js';
import { useSyncStatus } from '../../api/hooks.js';
import { timeAgo } from '../../lib/format.js';
import * as storage from '../../lib/storage.js';
import {
  isEnabled as notificationsEnabled,
  enableNotifications,
  disableNotifications,
} from '../../lib/notifications.js';

function NotificationToggle({ onToast }) {
  const [enabled, setEnabled] = useState(notificationsEnabled());
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const supported = typeof Notification !== 'undefined';

  const handleToggle = async () => {
    if (enabled) {
      disableNotifications();
      setEnabled(false);
      onToast?.('Reflection reminders off');
      return;
    }
    try {
      await enableNotifications();
      setEnabled(true);
      setPermission(Notification.permission);
      onToast?.('Reflection reminders on (6pm daily)');
    } catch (err) {
      onToast?.(err.message || 'Could not enable notifications', 'error');
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-text-muted">
        Notifications are not supported on this device.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text">Daily reflection reminder</p>
          <p className="text-xs text-text-muted mt-0.5">
            6pm prompt to review the day's spending
          </p>
        </div>
        <button
          onClick={handleToggle}
          aria-pressed={enabled}
          aria-label="Toggle reflection reminders"
          className={`relative w-12 h-7 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
            enabled ? 'bg-green/20' : ''
          }`}
        >
          <span className={`block w-12 h-7 rounded-full ${enabled ? 'bg-green' : 'bg-border'} relative`}>
            <span
              className={`absolute top-0.5 w-6 h-6 bg-bg rounded-full transition-transform ${
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>
      {permission === 'denied' && (
        <p className="text-xs text-orange mt-2">
          Permission was denied. Enable notifications for this site in your browser settings.
        </p>
      )}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-4">
      <h2 className="font-heading text-xs uppercase tracking-wider text-text-muted mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium animate-fade-in ${
      type === 'success' ? 'bg-green/20 text-green border border-green/30' : 'bg-orange/20 text-orange border border-orange/30'
    }`}>
      {type === 'success' ? '✓' : '✗'} {message}
    </div>
  );
}

export default function SettingsScreen() {
  const { secret } = useAuth();
  const { lastSync, isOnline } = useSyncStatus();

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // Connection
  const appsScriptUrl = localStorage.getItem('receipts_apps_script_url') || '';
  const maskedUrl = appsScriptUrl.length > 30 ? appsScriptUrl.slice(0, 30) + '...' : appsScriptUrl;
  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await fetchMeta();
      showToast('Connection successful', 'success');
    } catch {
      showToast('Connection failed', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // PIN change
  const [pinStep, setPinStep] = useState(null); // null | 'current' | 'new' | 'confirm'
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const resetPinFlow = () => {
    setPinStep(null);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
  };

  const handlePinSubmit = async () => {
    if (pinStep === 'current') {
      try {
        const key = await deriveKeyFromPin(currentPin);
        const enc = storage.get('receipts_pin_encrypted_secret');
        if (!enc) { setPinError('No PIN encryption found'); return; }
        await decrypt(key, enc.ciphertext, enc.iv);
        setPinStep('new');
        setPinError('');
      } catch {
        setPinError('Incorrect PIN');
      }
    } else if (pinStep === 'new') {
      if (newPin.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
      setPinStep('confirm');
      setPinError('');
    } else if (pinStep === 'confirm') {
      if (confirmPin !== newPin) { setPinError('PINs do not match'); return; }
      try {
        const newKey = await deriveKeyFromPin(newPin);
        const encrypted = await encrypt(newKey, secret);
        storage.set('receipts_pin_encrypted_secret', encrypted);
        showToast('PIN changed successfully');
        resetPinFlow();
      } catch {
        setPinError('Failed to update PIN');
      }
    }
  };

  // Sync / Cache
  const [cacheInfo, setCacheInfo] = useState({ entries: 0 });
  const [clearingCache, setClearingCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getCacheInfo().then(setCacheInfo);
  }, []);

  const handleClearCache = async () => {
    if (!window.confirm('Clear all cached data? The app will re-fetch everything.')) return;
    setClearingCache(true);
    await clearAllCache();
    setCacheInfo({ entries: 0 });
    setClearingCache(false);
    showToast('Cache cleared');
  };

  const handleRefreshNow = async () => {
    setRefreshing(true);
    await clearAllCache();
    try {
      await fetchMeta();
      showToast('Data refreshed');
    } catch {
      showToast('Refresh failed', 'error');
    }
    const info = await getCacheInfo();
    setCacheInfo(info);
    setRefreshing(false);
  };

  const pinLabel = pinStep === 'current' ? 'Enter current PIN' : pinStep === 'new' ? 'Enter new PIN' : 'Confirm new PIN';
  const pinValue = pinStep === 'current' ? currentPin : pinStep === 'new' ? newPin : confirmPin;
  const pinSetter = pinStep === 'current' ? setCurrentPin : pinStep === 'new' ? setNewPin : setConfirmPin;

  return (
    <div className="animate-fade-in px-4 pt-4 pb-28 max-w-md mx-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <h1 className="font-heading text-xl font-semibold mb-4">Settings</h1>

      {/* Connection */}
      <SectionCard title="Connection">
        <p className="text-xs text-text-muted mb-1">Apps Script URL</p>
        <p className="font-mono text-xs text-text-faint mb-3 break-all">{maskedUrl || 'Not set'}</p>
        <button
          onClick={handleTestConnection}
          disabled={testingConnection}
          className="w-full bg-surface border border-border rounded-lg py-2.5 text-sm text-text hover:border-green transition-colors min-h-[44px] disabled:opacity-50"
        >
          {testingConnection ? 'Testing...' : 'Test Connection'}
        </button>
      </SectionCard>

      {/* Security */}
      <SectionCard title="Security">
        {!pinStep ? (
          <button
            onClick={() => setPinStep('current')}
            className="w-full bg-surface border border-border rounded-lg py-2.5 text-sm text-text hover:border-green transition-colors min-h-[44px]"
          >
            Change PIN
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="text-sm text-text-muted">{pinLabel}</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinValue}
              onChange={(e) => pinSetter(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              aria-label={pinLabel}
              autoFocus
              className="w-full bg-bg border border-border rounded-lg py-2.5 px-3 text-center text-lg font-mono tracking-[0.5em] text-text focus:border-green"
            />
            {pinError && <p className="text-xs text-orange">{pinError}</p>}
            <div className="flex gap-2">
              <button
                onClick={resetPinFlow}
                className="flex-1 py-2 text-sm text-text-muted border border-border rounded-lg hover:bg-surface/50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={pinValue.length < 4}
                className="flex-1 py-2 text-sm text-bg bg-green rounded-lg hover:bg-green/90 disabled:opacity-40 min-h-[44px] font-medium"
              >
                {pinStep === 'confirm' ? 'Save' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Data & Sync */}
      <SectionCard title="Data & Sync">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Last synced</span>
            <span className="text-text">{lastSync ? timeAgo(lastSync) : 'Never'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Cache entries</span>
            <span className="font-mono text-text">{cacheInfo.entries}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="flex-1 border border-border rounded-lg py-2.5 text-sm text-text-muted hover:border-orange hover:text-orange transition-colors min-h-[44px] disabled:opacity-50"
            >
              {clearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
            <button
              onClick={handleRefreshNow}
              disabled={refreshing || !isOnline}
              className="flex-1 border border-border rounded-lg py-2.5 text-sm text-text hover:border-green transition-colors min-h-[44px] disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* About */}
      <SectionCard title="Coach">
        <NotificationToggle onToast={showToast} />
      </SectionCard>

      <SectionCard title="About">
        <div className="flex flex-col gap-1.5 text-sm">
          <p className="text-text font-medium">Receipts v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</p>
          <p className="text-text-muted">Your data stays on this device</p>
          <p className="text-text-muted">Built with ❤️ in Nairobi</p>
        </div>
      </SectionCard>
    </div>
  );
}
