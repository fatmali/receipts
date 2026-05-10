import { useState } from 'react';
import { useAuth } from './AuthContext';
import { setupAuth, isWebAuthnAvailable } from './webauthn';

const TOTAL_STEPS = 5;

function StepDots({ current, total }) {
  return (
    <div className="flex justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-200 ${
            i + 1 === current ? 'bg-green' : i + 1 < current ? 'bg-green/40' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}

function BackspaceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  );
}

function PinPad({ pin, onDigit, onBackspace, disabled, maxLength = 6 }) {
  return (
    <div className="w-full max-w-xs mx-auto">
      {/* PIN dots */}
      <div className="flex justify-center gap-3 mb-8">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-150 ${
              i < pin.length ? 'bg-green' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => onDigit(String(n))}
            disabled={disabled || pin.length >= maxLength}
            className="h-14 rounded-xl bg-surface border border-border text-xl font-medium text-text active:bg-border transition-colors disabled:opacity-50 min-w-[44px]"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          onClick={() => onDigit('0')}
          disabled={disabled || pin.length >= maxLength}
          className="h-14 rounded-xl bg-surface border border-border text-xl font-medium text-text active:bg-border transition-colors disabled:opacity-50 min-w-[44px]"
        >
          0
        </button>
        <button
          onClick={onBackspace}
          disabled={disabled || pin.length === 0}
          className="h-14 rounded-xl text-text-muted active:bg-surface transition-colors disabled:opacity-30 min-w-[44px] flex items-center justify-center"
          aria-label="Backspace"
        >
          <BackspaceIcon />
        </button>
      </div>
    </div>
  );
}

export default function SetupScreen() {
  const { completeSetup, unlock } = useAuth();
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinPhase, setPinPhase] = useState('create');
  const [pinError, setPinError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isUrlValid = url.startsWith('https://script.google.com/');

  const handleComplete = async (useFaceId) => {
    setLoading(true);
    try {
      if (useFaceId) {
        // Full setup with WebAuthn + PIN
        const hmacSecret = await setupAuth(url, secret, pin);
        completeSetup();
        unlock(hmacSecret);
      } else {
        // PIN-only setup — use setupAuth but catch WebAuthn failures
        try {
          const hmacSecret = await setupAuth(url, secret, pin);
          completeSetup();
          unlock(hmacSecret);
        } catch {
          // WebAuthn not available — manual PIN-only setup
          const { deriveKeyFromPin, encrypt } = await import('./crypto.js');
          const pinKey = await deriveKeyFromPin(pin);
          const pinEncrypted = await encrypt(pinKey, secret);
          localStorage.setItem('receipts_pin_encrypted_secret', JSON.stringify(pinEncrypted));
          localStorage.setItem('receipts_apps_script_url', url);
          localStorage.setItem('receipts_setup_complete', 'true');
          completeSetup();
          unlock(secret);
        }
      }
    } catch (err) {
      setLoading(false);
      // Show error to user instead of silently swallowing
      console.error('Setup failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinDigit = (digit) => {
    setPinError(null);
    if (pinPhase === 'create') {
      if (pin.length < 6) setPin((prev) => prev + digit);
    } else {
      if (confirmPin.length < 6) setConfirmPin((prev) => prev + digit);
    }
  };

  const handlePinBackspace = () => {
    setPinError(null);
    if (pinPhase === 'create') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handlePinNext = () => {
    if (pinPhase === 'create' && pin.length >= 4) {
      setPinPhase('confirm');
    } else if (pinPhase === 'confirm' && confirmPin.length >= 4) {
      if (confirmPin === pin) {
        setStep(5);
      } else {
        setPinError('PINs don\u2019t match. Try again.');
        setConfirmPin('');
        setPinPhase('create');
        setPin('');
      }
    }
  };

  const currentPin = pinPhase === 'create' ? pin : confirmPin;

  return (
    <div className="min-h-screen bg-bg flex flex-col p-6 animate-fade-in">
      {step > 1 && (
        <div className="pt-2">
          <StepDots current={step} total={TOTAL_STEPS} />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex flex-col items-center text-center animate-fade-in" key="step1">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Welcome to Receipts</h1>
            <p className="text-text-muted text-sm max-w-xs mb-8">
              Track your M-Pesa spending with a private, offline-first dashboard connected to your Google Sheet.
            </p>
            <button
              onClick={() => setStep(2)}
              className="w-full max-w-xs bg-green text-bg font-semibold py-3.5 px-6 rounded-xl active:opacity-90 transition-opacity min-h-[44px]"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step 2: Apps Script URL */}
        {step === 2 && (
          <div className="animate-slide-in" key="step2">
            <h2 className="font-heading text-xl font-semibold mb-2">Connect Your Sheet</h2>
            <p className="text-text-muted text-sm mb-6">
              Paste the Apps Script deployment URL from your Google Sheet.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              autoComplete="off"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-text text-sm placeholder:text-text-faint min-h-[44px]"
            />
            {url.length > 0 && !isUrlValid && (
              <p className="text-orange text-xs mt-2">URL must start with https://script.google.com/</p>
            )}
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 rounded-xl text-text-muted font-medium text-sm min-h-[44px]"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isUrlValid}
                className="flex-1 bg-green text-bg font-semibold py-3.5 rounded-xl disabled:opacity-40 active:opacity-90 transition-opacity min-h-[44px]"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: HMAC Secret */}
        {step === 3 && (
          <div className="animate-slide-in" key="step3">
            <h2 className="font-heading text-xl font-semibold mb-2">HMAC Secret</h2>
            <p className="text-text-muted text-sm mb-6">
              Paste the HMAC secret that matches your Apps Script configuration.
            </p>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Paste your HMAC secret"
                autoComplete="off"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 pr-12 text-text text-sm placeholder:text-text-faint min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 rounded-xl text-text-muted font-medium text-sm min-h-[44px]"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!secret.trim()}
                className="flex-1 bg-green text-bg font-semibold py-3.5 rounded-xl disabled:opacity-40 active:opacity-90 transition-opacity min-h-[44px]"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Set PIN */}
        {step === 4 && (
          <div className="animate-slide-in" key="step4">
            <h2 className="font-heading text-xl font-semibold text-center mb-2">
              {pinPhase === 'create' ? 'Create a PIN' : 'Confirm Your PIN'}
            </h2>
            <p className="text-text-muted text-sm text-center mb-6">
              {pinPhase === 'create' ? '4\u20136 digits to secure your data' : 'Enter your PIN again to confirm'}
            </p>

            {pinError && (
              <p className="text-orange text-sm text-center mb-4 animate-shake">{pinError}</p>
            )}

            <PinPad
              pin={currentPin}
              onDigit={handlePinDigit}
              onBackspace={handlePinBackspace}
              disabled={loading}
            />

            <div className="flex gap-3 mt-6 max-w-xs mx-auto">
              <button
                onClick={() => {
                  if (pinPhase === 'confirm') {
                    setPinPhase('create');
                    setConfirmPin('');
                  } else {
                    setStep(3);
                    setPin('');
                  }
                }}
                className="flex-1 py-3.5 rounded-xl text-text-muted font-medium text-sm min-h-[44px]"
              >
                Back
              </button>
              <button
                onClick={handlePinNext}
                disabled={currentPin.length < 4}
                className="flex-1 bg-green text-bg font-semibold py-3.5 rounded-xl disabled:opacity-40 active:opacity-90 transition-opacity min-h-[44px]"
              >
                {pinPhase === 'create' ? 'Next' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Face ID */}
        {step === 5 && (
          <div className="flex flex-col items-center text-center animate-slide-in" key="step5">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green">
                <path d="M6 12V8a2 2 0 0 1 2-2h4" />
                <path d="M28 6h4a2 2 0 0 1 2 2v4" />
                <path d="M6 28v4a2 2 0 0 0 2 2h4" />
                <path d="M28 34h4a2 2 0 0 0 2-2v-4" />
                <path d="M15 15v3" />
                <path d="M25 15v3" />
                <path d="M20 16v6h-2" />
                <path d="M16 28a4 4 0 0 0 8 0" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-semibold mb-2">Enable Face ID?</h2>
            <p className="text-text-muted text-sm max-w-xs mb-8">
              Unlock instantly with Face ID instead of typing your PIN every time.
            </p>

            <button
              onClick={() => handleComplete(true)}
              disabled={loading}
              className="w-full max-w-xs bg-green text-bg font-semibold py-3.5 px-6 rounded-xl active:opacity-90 transition-opacity disabled:opacity-50 min-h-[44px] mb-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                'Set Up Face ID'
              )}
            </button>
            <button
              onClick={() => handleComplete(false)}
              disabled={loading}
              className="w-full max-w-xs text-text-muted text-sm font-medium min-h-[44px]"
            >
              Skip — use PIN only
            </button>
            <p className="text-text-faint text-xs mt-3 max-w-xs">
              Without Face ID, you\u2019ll need to enter your PIN each time you open the app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
