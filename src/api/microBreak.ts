import api from './axios';
import type { CompletionRewardResponse } from '@/types';

const MICRO_BREAK_REQUEST_CONFIG = { timeout: 15000 };

export type MicroBreakDurationKey = '5-10' | '15-30' | '30-60' | 'relaxed';

export interface MicroBreakRewardInfo {
  xp: number;
  coins: number;
}

export interface MicroBreakTask {
  id: string;
  title: string;
  hint?: string | null;
  duration_key: MicroBreakDurationKey;
  category: string;
  created_at: string;
}

export interface MicroBreakTaskCreatePayload {
  title: string;
  hint?: string | null;
  duration_key: MicroBreakDurationKey;
}

export interface MicroBreakTaskUpdatePayload {
  title?: string;
  hint?: string | null;
  duration_key?: MicroBreakDurationKey;
}

export interface MicroBreakSummary {
  micro_break_streak: number;
  daily_completions: number;
  daily_limit: number;
  rewards: Record<MicroBreakDurationKey, MicroBreakRewardInfo>;
}

export interface MicroBreakCompletePayload {
  task_id: string;
  task_title: string;
  duration_key: MicroBreakDurationKey;
  category: string;
}

export interface MicroBreakCompleteResponse extends CompletionRewardResponse {
  micro_break_streak: number;
  daily_completions: number;
  daily_limit: number;
}

export const microBreakApi = {
  getSummary: async (): Promise<MicroBreakSummary> => {
    const { data } = await api.get<MicroBreakSummary>('/productivity/micro-breaks/summary', MICRO_BREAK_REQUEST_CONFIG);
    return data;
  },

  getTasks: async (durationKey?: MicroBreakDurationKey): Promise<MicroBreakTask[]> => {
    const { data } = await api.get<MicroBreakTask[]>('/productivity/micro-breaks/tasks', {
      ...MICRO_BREAK_REQUEST_CONFIG,
      params: durationKey ? { duration_key: durationKey } : undefined,
    });
    return data;
  },

  createTask: async (payload: MicroBreakTaskCreatePayload): Promise<MicroBreakTask> => {
    const { data } = await api.post<MicroBreakTask>('/productivity/micro-breaks/tasks', payload, MICRO_BREAK_REQUEST_CONFIG);
    return data;
  },

  updateTask: async (taskId: string, payload: MicroBreakTaskUpdatePayload): Promise<MicroBreakTask> => {
    const { data } = await api.put<MicroBreakTask>(`/productivity/micro-breaks/tasks/${taskId}`, payload, MICRO_BREAK_REQUEST_CONFIG);
    return data;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await api.delete(`/productivity/micro-breaks/tasks/${taskId}`, MICRO_BREAK_REQUEST_CONFIG);
  },

  complete: async (payload: MicroBreakCompletePayload): Promise<MicroBreakCompleteResponse> => {
    const { data } = await api.post<MicroBreakCompleteResponse>('/productivity/micro-breaks/complete', payload, MICRO_BREAK_REQUEST_CONFIG);
    return data;
  },
};
