/**
 * Resolve budgets from config endpoint response.
 *
 * Config shape from API:
 *   { budgets: { food: 15000, transport: 8000 }, monthOverrides: { "food:2026-05": 20000 } }
 *
 * Lookup priority: monthOverrides[cat:month] → budgets[cat] → null (unbudgeted)
 *
 * @param {Object} config - Config object from API
 * @param {string} monthKey - ISO month e.g. "2026-05"
 * @returns {Object} { category: amount } resolved budgets for the month
 */
export function resolveBudgets(config, monthKey) {
  if (!config || typeof config !== 'object') return {};

  const defaults = config.budgets || {};
  const overrides = config.monthOverrides || {};

  // Start with defaults
  const result = { ...defaults };

  // Apply month-specific overrides
  if (monthKey) {
    for (const [key, value] of Object.entries(overrides)) {
      const sep = key.lastIndexOf(':');
      if (sep > 0) {
        const cat = key.slice(0, sep);
        const month = key.slice(sep + 1);
        if (month === monthKey) {
          result[cat] = Number(value) || 0;
        }
      }
    }
  }

  return result;
}

/**
 * Resolve monthly salary from config for a given month.
 *
 * Config shape from API:
 *   { salary: { amount: 100000, day: 1, account: "bank-a" } }
 *
 * For past months: always include salary.
 * For the current month: include only if today >= salary day.
 * For future months: never include.
 *
 * @param {Object} config - Config object from API
 * @param {string} monthKey - ISO month e.g. "2026-05"
 * @returns {number} salary amount for that month, or 0
 */
export function resolveSalary(config, monthKey) {
  if (!config || !monthKey) return 0;

  const salary = config.salary;
  if (!salary) return 0;

  const amount = Number(salary.amount) || 0;
  if (amount <= 0) return 0;

  const salaryDay = Number(salary.day) || 1;

  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    // Past month — salary already landed
    return amount;
  }
  if (year === currentYear && month === currentMonth) {
    // Current month — only if we're past salary day
    return today.getDate() >= salaryDay ? amount : 0;
  }
  // Future month
  return 0;
}
