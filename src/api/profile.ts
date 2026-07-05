import api from './axios';
import type { User, UserUpdate, CoinLedger, UserPublicProfile } from '@/types';

export const profileApi = {
  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/profile/me');
    return data;
  },

  update: async (updateData: UserUpdate): Promise<User> => {
    const { data } = await api.put<User>('/profile/update', updateData);
    return data;
  },

  getCoinHistory: async (limit?: number): Promise<CoinLedger[]> => {
    const { data } = await api.get<CoinLedger[]>('/profile/coins/history', {
      params: limit ? { limit } : undefined,
    });
    return data;
  },

  findByFriendCode: async (friendCode: string): Promise<UserPublicProfile> => {
  const { data } = await api.get<UserPublicProfile>(`/profile/find/${friendCode}`);
  return data;
  },

  getPublicProfile: async (userId: string): Promise<UserPublicProfile> => {
    const { data } = await api.get(`/profile/public/${userId}`);
    return data;
  },
};
