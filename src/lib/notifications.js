// Local notifications for the Coach reflection prompt.
// Strategy: when the app is opened (or comes to foreground), check whether
// today's 6pm reminder has already been shown; if not, schedule a setTimeout.
// This works without push subscriptions or a backend.

import { get, set } from '../lib/storage.js';

const ENABLED_KEY = 'coach.notifications.enabled';
const LAST_SHOWN_KEY = 'coach.notifications.lastShown';
const DEFAULT_HOUR = 18; // 6pm

let scheduledTimer = null;

export function isEnabled() {
  return get(ENABLED_KEY) === true;
}

export async function enableNotifications() {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported in this browser');
  }
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') {
    throw new Error('Notification permission denied');
  }
  set(ENABLED_KEY, true);
  schedule();
  return true;
}

export function disableNotifications() {
  set(ENABLED_KEY, false);
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function alreadyShownToday() {
  return get(LAST_SHOWN_KEY) === todayKey();
}

function showReflectionNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  set(LAST_SHOWN_KEY, todayKey());
  try {
    const n = new Notification('Time to reflect', {
      body: 'Open Coach to reflect on today\'s spending — was it worth it?',
      icon: '/receipts/icon-192.png',
      badge: '/receipts/icon-192.png',
      tag: 'coach-reflection',
    });
    n.onclick = () => {
      window.focus();
      window.location.href = '/receipts/coach';
      n.close();
    };
  } catch {
    // Some browsers (iOS) require ServiceWorkerRegistration.showNotification —
    // try that as a fallback.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.showNotification('Time to reflect', {
          body: 'Open Coach to reflect on today\'s spending — was it worth it?',
          icon: '/receipts/icon-192.png',
          badge: '/receipts/icon-192.png',
          tag: 'coach-reflection',
        });
      });
    }
  }
}

/**
 * Schedule today's 6pm reminder if not already shown.
 * Idempotent — safe to call on every app open.
 */
export function schedule(hour = DEFAULT_HOUR) {
  if (!isEnabled()) return;
  if (alreadyShownToday()) return;

  const now = new Date();
  const target = new Date();
  target.setHours(hour, 0, 0, 0);

  if (target.getTime() <= now.getTime()) {
    // Past today's slot — fire immediately (you opened the app at 7pm,
    // so deliver the reflection prompt now)
    showReflectionNotification();
    return;
  }

  const delay = target.getTime() - now.getTime();
  if (scheduledTimer) clearTimeout(scheduledTimer);
  scheduledTimer = setTimeout(showReflectionNotification, delay);
}

/**
 * Initialise on app boot — checks permission state and schedules if enabled.
 */
export function initNotifications() {
  if (!('Notification' in window)) return;
  if (!isEnabled()) return;
  if (Notification.permission !== 'granted') {
    // User revoked permission externally — disable
    set(ENABLED_KEY, false);
    return;
  }
  schedule();
}
