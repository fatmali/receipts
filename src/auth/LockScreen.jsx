import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { unlockWithWebAuthn, unlockWithPin } from './webauthn';

function FaceIdIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green">
      <path d="M6 12V8a2 2 0 0 1 2-2h4" />
      <path d="M28 6h4a2 2 0 0 1 2 2v4" />
      <path d="M6 28v4a2 2 0 0 0 2 2h4" />
      <path d="M28 34h4a2 2 0 0 0 2-2v-4" />
      <path d="M15 15v3" />
      <path d="M25 15v3" />
      <path d="M20 16v6h-2" />
      <path d="M16 28a4 4 0 0 0 8 0" />
    </svg>
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

export default function LockScreen() {
  const { unlock } = useAuth();
  const [mode, setMode] = useState('faceid');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleWebAuthn = async () => {
    setLoading(true);
    setError(null);
    try {
      const secret = await unlockWithWebAuthn();
      unlock(secret);
    } catch {
      setError('Face ID failed. Try your PIN.');
      setMode('pin');
    } finally {
      setLoading(false);
    }
  };

  const submitPin = async (pinValue) => {
    setLoading(true);
    setError(null);
    try {
      const secret = await unlockWithPin(pinValue);
      unlock(secret);
    } catch {
      setError('Incorrect PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const addDigit = (digit) => {
    if (pin.length >= 6 || loading) return;
    setError(null);
    setPin((prev) => prev + digit);
  };

  const backspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  // Auto-submit when PIN reaches 6 digits
  useEffect(() => {
    if (pin.length === 6 && !loading) {
      submitPin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 animate-fade-in">
      {/* App branding */}
      <div className="mb-12">
        <h1 className="font-heading text-3xl font-bold text-center tracking-tight">Receipts</h1>
        <p className="text-text-muted text-sm text-center mt-1">Your finances, secured</p>
      </div>

      {mode === 'faceid' ? (
        <div className="flex flex-col items-center">
          {/* Face ID button */}
          <button
            onClick={handleWebAuthn}
            disabled={loading}
            className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center mb-6 active:scale-95 transition-transform disabled:opacity-50"
            aria-label="Unlock with Face ID"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
            ) : (
              <FaceIdIcon />
            )}
          </button>

          {loading ? (
            <p className="text-text-muted text-sm">Verifying…</p>
          ) : (
            <>
              <p className="text-text-muted text-sm mb-6">Tap to unlock with Face ID</p>
              <button
                onClick={() => setMode('pin')}
                className="text-green text-sm font-medium min-h-[44px] min-w-[44px] px-4"
              >
                Use PIN instead
              </button>
            </>
          )}

          {error && (
            <p className="text-orange text-sm mt-4 animate-fade-in">{error}</p>
          )}
        </div>
      ) : (
        <div className="w-full max-w-xs animate-slide-in">
          <p className="text-text-muted text-sm text-center mb-6">Enter your PIN</p>

          {/* PIN dots */}
          <div className={`flex justify-center gap-3 mb-8 ${error ? 'animate-shake' : ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors duration-150 ${
                  i < pin.length ? 'bg-green' : 'bg-border'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-orange text-sm text-center mb-4 animate-fade-in">{error}</p>
          )}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => addDigit(String(n))}
                disabled={loading || pin.length >= 6}
                className="h-14 rounded-xl bg-surface border border-border text-xl font-medium text-text active:bg-border transition-colors disabled:opacity-50 min-w-[44px]"
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => {
                if (pin.length >= 4 && !loading) submitPin(pin);
              }}
              disabled={loading || pin.length < 4}
              className="h-14 rounded-xl text-green text-sm font-semibold active:bg-surface transition-colors disabled:opacity-30 min-w-[44px]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                pin.length >= 4 ? 'OK' : ''
              )}
            </button>
            <button
              onClick={() => addDigit('0')}
              disabled={loading || pin.length >= 6}
              className="h-14 rounded-xl bg-surface border border-border text-xl font-medium text-text active:bg-border transition-colors disabled:opacity-50 min-w-[44px]"
            >
              0
            </button>
            <button
              onClick={backspace}
              disabled={loading || pin.length === 0}
              className="h-14 rounded-xl text-text-muted active:bg-surface transition-colors disabled:opacity-30 min-w-[44px] flex items-center justify-center"
              aria-label="Backspace"
            >
              <BackspaceIcon />
            </button>
          </div>

          <button
            onClick={() => { setMode('faceid'); setPin(''); setError(null); }}
            className="w-full text-text-muted text-sm min-h-[44px]"
          >
            Use Face ID instead
          </button>
        </div>
      )}
    </div>
  );
}
