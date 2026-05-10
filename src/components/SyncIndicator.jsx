import { useState, useEffect } from 'react';
import { timeAgo } from '../lib/format';

export default function SyncIndicator({ lastSyncTime, isSyncing = false, isOnline = true }) {
  const [, setTick] = useState(0);

  // Re-render every 60s to update the "X ago" text
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  let dotColor = 'bg-green'; // synced recently
  let label = '';

  if (!isOnline) {
    dotColor = 'bg-orange';
    label = 'Offline';
  } else if (isSyncing) {
    dotColor = 'bg-yellow';
    label = 'Syncing…';
  } else if (lastSyncTime) {
    // Stale if > 10 minutes ago
    const ageMs = Date.now() - new Date(lastSyncTime).getTime();
    if (ageMs > 10 * 60 * 1000) {
      dotColor = 'bg-yellow';
    }
    label = `Last synced ${timeAgo(lastSyncTime)}`;
  } else {
    dotColor = 'bg-text-faint';
    label = 'Not synced';
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor} ${
          isSyncing ? 'animate-pulse' : ''
        }`}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
