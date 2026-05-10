/**
 * Format amount as KES currency string.
 * @param {number} amount
 * @returns {string} e.g. "KES 12,500"
 */
export function formatKES(amount) {
  if (amount == null || isNaN(amount)) return 'KES 0';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `-KES ${formatted}` : `KES ${formatted}`;
}

/**
 * Format raw account ID for display.
 * e.g. "bank-c-1234" → "Bank C 1234", "mpesa" → "M-Pesa"
 */
export function formatAccount(raw) {
  if (!raw) return '';
  const s = String(raw).toLowerCase();
  if (s === 'mpesa') return 'M-Pesa';
  return s
    .split('-')
    .map((part) => /^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Format ISO date string to a readable format.
 * @param {string} dateStr - ISO 8601 date string
 * @returns {string} e.g. "10 May 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a decimal as a percentage string.
 * @param {number} value - e.g. 0.27 or 27
 * @returns {string} e.g. "27%"
 */
export function formatPercent(value) {
  if (value == null || isNaN(value)) return '0%';
  // If value is already in percentage form (> 1 or < -1), use as-is
  // If it's a decimal ratio, multiply by 100
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

/**
 * Format delta between current and previous as a signed percentage string.
 * @param {number} current
 * @param {number} previous
 * @returns {string} e.g. "+12%" or "-5%"
 */
export function formatDelta(current, previous) {
  if (previous == null || previous === 0 || current == null) return 'N/A';
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change);
  return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
}

/**
 * Human-readable time ago string.
 * @param {string|number|Date} timestamp
 * @returns {string} e.g. "2 min ago", "1 hour ago"
 */
export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return '';
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
