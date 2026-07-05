import api from './axios';
import type { AccountabilityConnection, UserPublicProfile, Goal, Habit, Task, Wallet, SubGoal, Transaction, PartnerSharingScope, Budget, BillReminder } from '@/types';

export const partnerApi = {
  getSharingScope: async (): Promise<PartnerSharingScope> => {
    const { data } = await api.get<PartnerSharingScope>('/partner/sharing-scope');
    return data;
  },

  // Send request using friend code
  sendRequest: async (friendCode: string, consentAcknowledged: boolean): Promise<AccountabilityConnection> => {
    const { data } = await api.post<AccountabilityConnection>(
      `/partner/request/${friendCode}`,
      { consent_acknowledged: consentAcknowledged },
    );
    return data;
  },

  // Accept request
  acceptRequest: async (connectionId: string, consentAcknowledged: boolean): Promise<AccountabilityConnection> => {
    const { data } = await api.put<AccountabilityConnection>(
      `/partner/accept/${connectionId}`,
      { consent_acknowledged: consentAcknowledged },
    );
    return data;
  },

  // Reject request
  rejectRequest: async (connectionId: string): Promise<AccountabilityConnection> => {
    const { data } = await api.put<AccountabilityConnection>(`/partner/reject/${connectionId}`);
    return data;
  },

  // Disconnect
  disconnect: async (connectionId: string): Promise<void> => {
    await api.delete(`/partner/disconnect/${connectionId}`);
  },

  // Get all connections
  getConnections: async (): Promise<AccountabilityConnection[]> => {
    const { data } = await api.get<AccountabilityConnection[]>('/partner/connections');
    return data;
  },

  // View partner profile
  getPartnerProfile: async (partnerId: string): Promise<UserPublicProfile> => {
    const { data } = await api.get(`/partner/${partnerId}/profile`);
    return data;
  },

  // View partner productivity
  getPartnerProductivity: async (partnerId: string): Promise<{
    goals: (Goal & { sub_goals: (SubGoal & { tasks: Task[] })[] })[];
    habits: Habit[];
    tasks: Task[];
  }> => {
    const { data } = await api.get(`/partner/${partnerId}/productivity`);
    return data;
  },

  // View partner tasks
  getPartnerTasks: async (partnerId: string): Promise<Task[]> => {
    const { data } = await api.get<Task[]>(`/partner/${partnerId}/tasks`);
    return data;
  },

  // View partner finance
  getPartnerFinance: async (partnerId: string): Promise<{
    wallets: (Wallet & { transactions: Transaction[] })[];
    transactions: Transaction[];
    budgets: Budget[];
    bills: BillReminder[];
    summary: { total_income: number; total_expense: number; net: number; total_balance: number };
  }> => {
    const { data } = await api.get(`/partner/${partnerId}/finance`);
    return data;
  },
};
