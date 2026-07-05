import api from './axios';
import type {
  Wallet, WalletCreate,
  Transaction, TransactionCreate, TransactionUpdate,
  Budget, BudgetCreate, BudgetUpdate,
  BillReminder, BillReminderCreate, BillReminderUpdate,
  FinanceSummary,
} from '@/types';

// Wallets
export const walletApi = {
  getAll: async (): Promise<Wallet[]> => {
    const { data } = await api.get<Wallet[]>('/finance/wallets');
    return data;
  },

  getById: async (id: string): Promise<Wallet & { transactions: Transaction[] }> => {
    const { data } = await api.get(`/finance/wallets/${id}`);
    return data;
  },

  create: async (wallet: WalletCreate): Promise<Wallet> => {
    const { data } = await api.post<Wallet>('/finance/wallets', wallet);
    return data;
  },

  update: async (id: string, wallet: Partial<WalletCreate>): Promise<Wallet> => {
    const { data } = await api.put<Wallet>(`/finance/wallets/${id}`, wallet);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/finance/wallets/${id}`);
  },
};

// Transactions
export type TransactionFilters = {
  start_date?: string;
  end_date?: string;
  category?: string;
  tx_type?: 'income' | 'expense';
  wallet_id?: string;
  search?: string;
};

export const transactionApi = {
  getAll: async (filters?: TransactionFilters): Promise<Transaction[]> => {
    const { data } = await api.get<Transaction[]>('/finance/transactions', { params: filters });
    return data;
  },

  create: async (transaction: TransactionCreate): Promise<Transaction> => {
    const { data } = await api.post<Transaction>('/finance/transactions', transaction);
    return data;
  },

  update: async (id: string, transaction: TransactionUpdate): Promise<Transaction> => {
    const { data } = await api.put<Transaction>(`/finance/transactions/${id}`, transaction);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/finance/transactions/${id}`);
  },

  getSummary: async (): Promise<FinanceSummary> => {
    const { data } = await api.get<FinanceSummary>('/finance/transactions/summary');
    return data;
  },
};

// Budgets
export const budgetApi = {
  getAll: async (): Promise<Budget[]> => {
    const { data } = await api.get<Budget[]>('/finance/budgets');
    return data;
  },

  create: async (budget: BudgetCreate): Promise<Budget> => {
    const { data } = await api.post<Budget>('/finance/budgets', budget);
    return data;
  },

  update: async (id: string, budget: BudgetUpdate): Promise<Budget> => {
    const { data } = await api.put<Budget>(`/finance/budgets/${id}`, budget);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/finance/budgets/${id}`);
  },
};

// Bill Reminders
export const billReminderApi = {
  getAll: async (): Promise<BillReminder[]> => {
    const { data } = await api.get<BillReminder[]>('/finance/bills');
    return data;
  },

  create: async (bill: BillReminderCreate): Promise<BillReminder> => {
    const { data } = await api.post<BillReminder>('/finance/bills', bill);
    return data;
  },

  update: async (id: string, bill: BillReminderUpdate): Promise<BillReminder> => {
    const { data } = await api.put<BillReminder>(`/finance/bills/${id}`, bill);
    return data;
  },

  markPaid: async (id: string, walletId?: string): Promise<BillReminder> => {
    const { data } = await api.post<BillReminder>(`/finance/bills/${id}/pay`, null, {
      params: walletId ? { wallet_id: walletId } : undefined,
    });
    return data;
  },

  markUnpaid: async (id: string): Promise<BillReminder> => {
    const { data } = await api.post<BillReminder>(`/finance/bills/${id}/unpay`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/finance/bills/${id}`);
  },
};
