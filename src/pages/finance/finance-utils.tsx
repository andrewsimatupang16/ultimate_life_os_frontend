import type { Budget, BudgetPeriodEnum } from '@/types';
export { toDateTimeLocal } from '@/lib/format';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';

export const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
export const FINANCE_CATEGORIES = ['Kebutuhan Pokok', 'Transportasi', 'Gaya Hidup', 'Tagihan', 'Investasi', 'Lainnya'];
export const compactGridClass = 'app-list-grid';
export const compactCardClass = 'modern-panel app-data-card min-w-0 py-0 gap-0 rounded-2xl h-full self-start';
export const compactContentClass = 'app-list-card-content';
export const budgetPeriods: { value: BudgetPeriodEnum; label: string }[] = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'custom', label: 'Khusus' },
];

export function budgetPeriodLabel(value: BudgetPeriodEnum | string) {
  return budgetPeriods.find((period) => period.value === value)?.label ?? value;
}

export function walletTypeLabel(value: string) {
  if (value === 'cash') return 'Tunai';
  if (value === 'bank') return 'Bank';
  if (value === 'ewallet') return 'Dompet Digital';
  return value;
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getBudgetDailyLimit(budget: Budget) {
  if (!budget.start_date || !budget.end_date) return budget.limit_amount;
  const start = new Date(budget.start_date);
  const end = new Date(budget.end_date);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  return budget.limit_amount / days;
}

export const walletIcons = {
  cash: <Banknote className="w-5 h-5" />,
  bank: <CreditCard className="w-5 h-5" />,
  ewallet: <Smartphone className="w-5 h-5" />,
};
