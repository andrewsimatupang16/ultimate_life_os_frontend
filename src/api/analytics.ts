import api from './axios';
import type { DashboardDiagnostics, DashboardSummary, MonthlyComparisonSummary } from '@/types';

export const analyticsApi = {
  getDashboard: async (): Promise<DashboardSummary> => {
    const { data } = await api.get<DashboardSummary>('/analytics/dashboard');
    return data;
  },


  getDashboardDiagnostics: async (): Promise<DashboardDiagnostics> => {
    const { data } = await api.get<DashboardDiagnostics>('/analytics/dashboard/diagnostics');
    return data;
  },

  getMonthlySummary: async (months = 6): Promise<MonthlyComparisonSummary> => {
    const { data } = await api.get<MonthlyComparisonSummary>('/analytics/monthly-summary', { params: { months } });
    return data;
  },

  getLifeScore: async (): Promise<{
    productivity_score: number;
    finance_score: number;
    life_score: number;
  }> => {
    const { data } = await api.get('/analytics/life-score');
    return data;
  },

  getProductivityAnalytics: async (): Promise<{
    task_completion_by_difficulty: { difficulty: string; total: number; completed: number }[];
    top_habits: { id: string; title: string; streak: number; type: string }[];
    goals_progress: { id: string; title: string; is_completed: boolean; progress: number; sub_goals_total: number; sub_goals_completed: number }[];
  }> => {
    const { data } = await api.get('/analytics/productivity');
    return data;
  },

  getFinanceAnalytics: async (period: 'week' | 'month' | 'year' = 'month'): Promise<{
    period: string;
    total_income: number;
    total_expense: number;
    net: number;
    expense_by_category: { category: string; total: number }[];
    daily_cashflow: { date: string; income: number; expense: number }[];
  }> => {
    const { data } = await api.get('/analytics/finance', { params: { period } });
    return data;
  },
};
