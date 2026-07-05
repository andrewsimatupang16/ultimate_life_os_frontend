import api from './axios';
import type { Reward, RewardCreate, RewardUpdate, RewardPurchaseResponse, GamificationConfig } from '@/types';

export const rewardsApi = {
  getConfig: async (): Promise<GamificationConfig> => {
    const { data } = await api.get<GamificationConfig>('/rewards/config');
    return data;
  },

  getMyRewards: async (): Promise<Reward[]> => {
    const { data } = await api.get<Reward[]>('/rewards/my');
    return data;
  },

  create: async (reward: RewardCreate): Promise<Reward> => {
    const { data } = await api.post<Reward>('/rewards/create', reward);
    return data;
  },

  update: async (id: string, reward: RewardUpdate): Promise<Reward> => {
    const { data } = await api.put<Reward>(`/rewards/${id}`, reward);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rewards/${id}`);
  },

  purchase: async (id: string): Promise<RewardPurchaseResponse> => {
    const { data } = await api.post<RewardPurchaseResponse>(`/rewards/${id}/purchase`);
    return data;
  },
};
