import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'receipts_install_dismissed';

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

function isStandalone() {
  if (typeof window === 'undefined') return true;
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosSafari() || isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  const steps = [
    {
      num: 1,
      text: 'Tap the Share button',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      num: 2,
      text: "Scroll down and tap 'Add to Home Screen'",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      num: 3,
      text: "Tap 'Add' to confirm",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-overlay"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md mx-4 mb-6 p-6 bg-surface border border-border rounded-2xl animate-slide-up-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg font-semibold text-text mb-4">
          Install Receipts
        </h2>

        <div className="space-y-4 mb-6">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green/15 text-green flex items-center justify-center text-sm font-semibold font-mono">
                {step.num}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-text-muted">{step.icon}</span>
                <span className="text-sm text-text">{step.text}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="w-full py-3 rounded-xl bg-green text-bg font-semibold text-sm active:opacity-80 transition-opacity"
          style={{ minHeight: 44 }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
