import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Banner that appears when a new service worker has finished installing
 * and is waiting to take over. The user taps "Update" to apply.
 *
 * Also polls every 60 minutes for new versions while the app is open.
 */
export default function UpdatePrompt() {
  const [visible, setVisible] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Check for updates every hour while the app is open
      const id = setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
      return () => clearInterval(id);
    },
  });

  useEffect(() => {
    if (needRefresh) setVisible(true);
  }, [needRefresh]);

  if (!visible) return null;

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setVisible(false);
    setNeedRefresh(false);
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md animate-fade-in"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
      role="status"
      aria-live="polite"
    >
      <div className="bg-surface border border-green/40 rounded-xl shadow-lg p-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text font-medium">A new version is ready</p>
          <p className="text-xs text-text-muted mt-0.5">Tap update to reload with the latest.</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-text-muted px-3 py-2 min-h-11"
        >
          Later
        </button>
        <button
          onClick={handleUpdate}
          className="bg-green text-bg text-sm font-medium px-4 py-2 rounded-lg min-h-11"
        >
          Update
        </button>
      </div>
    </div>
  );
}
