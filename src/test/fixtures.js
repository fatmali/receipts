// Factory function for creating test transactions
export function makeTxn(overrides = {}) {
  return {
    date: "2026-05-01T10:00:00",
    txn_id: `txn_${Math.random().toString(36).slice(2)}`,
    type: "expense",
    amount: 1000,
    cost: 0,
    description: "Test Merchant",
    balance: "",
    source: "mpesa",
    currency: "KES",
    category: "food",
    account: "mpesa",
    recurring: "",
    fuliza_amount: "",
    fuliza_outstanding: "",
    ...overrides,
  };
}

// Preset datasets
export const EMPTY_TRANSACTIONS = [];

export const MIXED_TRANSACTIONS = [
  makeTxn({ type: "income", amount: 50000, description: "Salary", category: "salary" }),
  makeTxn({ type: "expense", amount: 15000, description: "Rent", category: "housing" }),
  makeTxn({ type: "expense", amount: 8000, description: "Groceries", category: "food" }),
  makeTxn({ type: "transfer", amount: 20000, description: "To Bank Account", category: "" }),
  makeTxn({ type: "expense", amount: 3000, description: "Uber", category: "transport", cost: 50 }),
  makeTxn({ type: "income", amount: 10000, description: "Freelance", category: "income" }),
  makeTxn({ type: "transfer", amount: 10000, description: "Unit Trust Fund", category: "savings" }),
  makeTxn({ type: "transfer", amount: 5000, description: "Investment Fund", category: "investment" }),
];

export const FULIZA_TRANSACTIONS = [
  makeTxn({ type: "fuliza_credit", amount: 5000, description: "Fuliza", fuliza_amount: 5000, date: "2026-05-01" }),
  makeTxn({ type: "fuliza_credit", amount: 3000, description: "Fuliza", fuliza_amount: 3000, date: "2026-05-03" }),
  makeTxn({ type: "expense", amount: 5000, description: "Fuliza Full Repayment", date: "2026-05-05" }),
  makeTxn({ type: "expense", amount: 1000, description: "Fuliza Partial Repayment", date: "2026-05-07" }),
];

export const ZERO_INCOME = [
  makeTxn({ type: "expense", amount: 5000, category: "food" }),
  makeTxn({ type: "expense", amount: 3000, category: "transport" }),
];

// Uncategorized
export const UNCATEGORIZED_TRANSACTIONS = [
  makeTxn({ type: "expense", amount: 2000, category: "" }),
  makeTxn({ type: "expense", amount: 3000, category: "" }),
  makeTxn({ type: "expense", amount: 1000, category: "food" }),
];
