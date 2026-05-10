// Salary-cycle grouping — slices transactions into pay-period "months"

/**
 * Build salary-based cycles from transactions.
 * Each cycle starts on a salary payment date and ends the day before the next salary.
 *
 * @param {Array} transactions - all transactions (any order)
 * @returns {Array<{ label: string, startDate: string, endDate: string|null, transactions: Array }>}
 *   Sorted oldest cycle first. endDate is null for the current (open) cycle.
 */
export function buildSalaryCycles(transactions) {
  if (!transactions?.length) return [];

  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Find salary transaction dates
  const salaryDates = [];
  for (const t of sorted) {
    if (t.type === 'income' && (t.category || '').toLowerCase() === 'salary') {
      const d = t.date.slice(0, 10);
      if (!salaryDates.length || salaryDates[salaryDates.length - 1] !== d) {
        salaryDates.push(d);
      }
    }
  }

  // No salary found — return all as a single cycle
  if (!salaryDates.length) {
    const first = sorted[0].date.slice(0, 10);
    return [{
      label: formatCycleLabel(first, null),
      startDate: first,
      endDate: null,
      transactions: sorted,
    }];
  }

  const cycles = [];

  // Transactions before first salary
  const preTxns = sorted.filter(t => t.date.slice(0, 10) < salaryDates[0]);
  if (preTxns.length) {
    cycles.push({
      label: formatCycleLabel(preTxns[0].date.slice(0, 10), salaryDates[0]),
      startDate: preTxns[0].date.slice(0, 10),
      endDate: salaryDates[0],
      transactions: preTxns,
    });
  }

  // Each salary-to-salary cycle
  for (let i = 0; i < salaryDates.length; i++) {
    const start = salaryDates[i];
    const end = i < salaryDates.length - 1 ? salaryDates[i + 1] : null;

    const cycleTxns = sorted.filter(t => {
      const d = t.date.slice(0, 10);
      if (d < start) return false;
      if (end && d >= end) return false;
      return true;
    });

    cycles.push({
      label: formatCycleLabel(start, end),
      startDate: start,
      endDate: end,
      transactions: cycleTxns,
    });
  }

  return cycles;
}

/**
 * Get the cycle that contains a given date, or the latest cycle.
 */
export function currentCycle(cycles, date = new Date()) {
  if (!cycles?.length) return null;
  const d = date.toISOString().slice(0, 10);
  for (let i = cycles.length - 1; i >= 0; i--) {
    if (d >= cycles[i].startDate) return cycles[i];
  }
  return cycles[cycles.length - 1];
}

/**
 * Get the cycle immediately before a given cycle.
 */
export function previousCycle(cycles, cycle) {
  if (!cycles?.length || !cycle) return null;
  const idx = cycles.indexOf(cycle);
  return idx > 0 ? cycles[idx - 1] : null;
}

function formatCycleLabel(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00');
  const opts = { day: 'numeric', month: 'short' };

  if (!endDate) {
    return `${s.toLocaleDateString('en-KE', opts)} – now`;
  }

  const e = new Date(endDate + 'T00:00:00');
  e.setDate(e.getDate() - 1); // end date is exclusive, show last day
  return `${s.toLocaleDateString('en-KE', opts)} – ${e.toLocaleDateString('en-KE', opts)}`;
}
