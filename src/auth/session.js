import { clearKeyCache } from '../api/auth.js';

// In-memory secret store + auto-lock timer + visibility lock
// Secret is NEVER persisted — only held in memory while app is unlocked

const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
const APPS_SCRIPT_URL_KEY = 'receipts_apps_script_url';

let _secret = null;
let _lockTimer = null;
let _onLockCallback = null;
let _activityHandler = null;
let _visibilityHandler = null;

export function getSecret() {
  return _secret;
}

export function setSecret(secret) {
  _secret = secret;
}

export function clearSecret() {
  _secret = null;
  clearKeyCache();
  if (_lockTimer) {
    clearTimeout(_lockTimer);
    _lockTimer = null;
  }
}

export function isUnlocked() {
  return _secret !== null;
}

// ---- auto-lock timer ----

export function resetLockTimer() {
  if (_lockTimer) clearTimeout(_lockTimer);
  if (!_onLockCallback) return;
  _lockTimer = setTimeout(() => {
    clearSecret();
    _onLockCallback();
  }, AUTO_LOCK_MS);
}

export function startAutoLock(onLock) {
  _onLockCallback = onLock;
  _activityHandler = () => resetLockTimer();

  ACTIVITY_EVENTS.forEach((evt) =>
    window.addEventListener(evt, _activityHandler, { passive: true })
  );

  resetLockTimer();
}

export function stopAutoLock() {
  if (_lockTimer) {
    clearTimeout(_lockTimer);
    _lockTimer = null;
  }
  if (_activityHandler) {
    ACTIVITY_EVENTS.forEach((evt) =>
      window.removeEventListener(evt, _activityHandler)
    );
    _activityHandler = null;
  }
  _onLockCallback = null;
}

// ---- visibility lock ----

export function startVisibilityLock(onLock) {
  _visibilityHandler = () => {
    if (document.hidden) {
      clearSecret();
      onLock();
    }
  };
  document.addEventListener('visibilitychange', _visibilityHandler);
}

export function stopVisibilityLock() {
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
}

// ---- config ----

export function getAppsScriptUrl() {
  return localStorage.getItem(APPS_SCRIPT_URL_KEY);
}

export function isLocked() {
  return _secret === null;
}
