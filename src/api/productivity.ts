import api from './axios';
import type {
  Goal, GoalCreate, GoalUpdate,
  SubGoal, SubGoalCreate, SubGoalUpdate, KeyResultHistory,
  Task, TaskCreate, TaskUpdate,
  Habit, HabitCreate, HabitUpdate, HabitLogResponse,
  CompletionRewardResponse,
} from '@/types';

// Goals
export const goalApi = {
  getAll: async (): Promise<Goal[]> => {
    const { data } = await api.get<Goal[]>('/productivity/goals');
    return data;
  },

  getById: async (id: string): Promise<Goal & { sub_goals: (SubGoal & { tasks: Task[] })[] }> => {
    const { data } = await api.get(`/productivity/goals/${id}`);
    return data;
  },

  create: async (goal: GoalCreate): Promise<Goal> => {
    const { data } = await api.post<Goal>('/productivity/goals', goal);
    return data;
  },

  update: async (id: string, goal: GoalUpdate): Promise<Goal> => {
    const { data } = await api.put<Goal>(`/productivity/goals/${id}`, goal);
    return data;
  },

  updateProgress: async (id: string, currentValue: number): Promise<Goal> => {
    const { data } = await api.patch<Goal>(`/productivity/goals/${id}/progress`, {
      current_value: currentValue,
    });
    return data;
  },

  complete: async (id: string): Promise<CompletionRewardResponse> => {
    const { data } = await api.post<CompletionRewardResponse>(`/productivity/goals/${id}/complete`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/productivity/goals/${id}`);
  },
};

// SubGoals
export const subGoalApi = {
  create: async (subGoal: SubGoalCreate): Promise<SubGoal> => {
    const { data } = await api.post<SubGoal>('/productivity/subgoals', subGoal);
    return data;
  },

  update: async (id: string, subGoal: SubGoalUpdate): Promise<SubGoal> => {
    const { data } = await api.put<SubGoal>(`/productivity/subgoals/${id}`, subGoal);
    return data;
  },

  complete: async (id: string): Promise<CompletionRewardResponse> => {
    const { data } = await api.post<CompletionRewardResponse>(`/productivity/subgoals/${id}/complete`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/productivity/subgoals/${id}`);
  },

  history: async (id: string): Promise<KeyResultHistory[]> => {
    const { data } = await api.get<KeyResultHistory[]>(`/productivity/subgoals/${id}/history`);
    return data;
  },
};

// Tasks
export const taskApi = {
  getAll: async (): Promise<Task[]> => {
    const { data } = await api.get<Task[]>('/productivity/tasks');
    return data;
  },

  getStandalone: async (): Promise<Task[]> => {
    const { data } = await api.get<Task[]>('/productivity/tasks/standalone');
    return data;
  },

  create: async (task: TaskCreate): Promise<Task> => {
    const { data } = await api.post<Task>('/productivity/tasks', task);
    return data;
  },

  update: async (id: string, task: TaskUpdate): Promise<Task> => {
    const { data } = await api.put<Task>(`/productivity/tasks/${id}`, task);
    return data;
  },

  complete: async (id: string): Promise<CompletionRewardResponse> => {
    const { data } = await api.post<CompletionRewardResponse>(`/productivity/tasks/${id}/complete`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/productivity/tasks/${id}`);
  },
};

// Habits
export const habitApi = {
  getAll: async (): Promise<Habit[]> => {
    const { data } = await api.get<Habit[]>('/productivity/habits');
    return data;
  },

  create: async (habit: HabitCreate): Promise<Habit> => {
    const { data } = await api.post<Habit>('/productivity/habits', habit);
    return data;
  },

  update: async (id: string, habit: HabitUpdate): Promise<Habit> => {
    const { data } = await api.put<Habit>(`/productivity/habits/${id}`, habit);
    return data;
  },

  log: async (id: string): Promise<HabitLogResponse> => {
    const { data } = await api.post<HabitLogResponse>(`/productivity/habits/${id}/log`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/productivity/habits/${id}`);
  },
};
