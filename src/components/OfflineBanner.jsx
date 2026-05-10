import { useState, useEffect } from 'react';
import { timeAgo } from '../lib/format';

export default function OfflineBanner({ lastSyncTime, isOnline: isOnlineProp }) {
  const [online, setOnline] = useState(
    isOnlineProp !== undefined ? isOnlineProp : navigator.onLine
  );
  const [visible, setVisible] = useState(!navigator.onLine);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOnlineProp !== undefined) {
      setOnline(isOnlineProp);
      return;
    }

    const goOffline = () => setOnline(false);
    const goOnline = () => setOnline(true);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [isOnlineProp]);

  useEffect(() => {
    if (!online) {
      setVisible(true);
      setAnimating(false);
    } else if (visible) {
      // Animate out, then hide
      setAnimating(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [online]);

  if (!visible) return null;

  const syncText = lastSyncTime
    ? `Offline — last synced ${timeAgo(lastSyncTime)}`
    : 'Offline';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center ${
        animating ? 'animate-slide-up' : 'animate-slide-down'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(36px + env(safe-area-inset-top, 0px))',
        backgroundColor: 'rgba(232, 132, 90, 0.95)',
      }}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-white font-medium">{syncText}</span>
    </div>
  );
}
