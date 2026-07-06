// Enums
export type DifficultyEnum = 'easy' | 'medium' | 'hard';
export type PriorityEnum = 'low' | 'medium' | 'high';
export type HabitTypeEnum = 'good' | 'bad';
export type WalletTypeEnum = 'cash' | 'bank' | 'ewallet';
export type TransactionTypeEnum = 'income' | 'expense';
export type BudgetPeriodEnum = 'daily' | 'weekly' | 'monthly' | 'custom';
export type CoinLedgerTypeEnum = 'earned' | 'spent' | 'penalty';
export type ConnectionStatusEnum = 'pending' | 'accepted' | 'rejected';
export type ActivityCategoryEnum = string;
export type GoalProgressMode = 'manual' | 'weighted_subgoals';

// User
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  friend_code: string | null;
  level: number;
  xp_balance: number;
  total_xp_earned: number;
  coin_balance: number;
  active_title: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  avatar_url?: string;
  password?: string;
  active_title?: string;
}

export interface RewardUpdate {
  title?: string;
  description?: string;
  price?: number;
  icon?: string;
  is_active?: boolean;
}

export interface UserPublicProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  level: number;
  xp_balance: number;
  total_xp_earned: number;
  coin_balance: number;
  active_title: string | null;
  friend_code: string | null;
}

// Auth
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// Goal
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  target_value: number | null;
  current_value: number;
  target_unit: string | null;
  progress_mode: GoalProgressMode | string;
  progress_rate: number;
  status: string;
  is_completed: boolean;
  completed_at: string | null;
  xp_rewarded: number;
  coin_rewarded: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sub_goals?: SubGoal[];
}

export interface GoalCreate {
  title: string;
  description?: string;
  target_date?: string;
  target_value?: number;
  current_value?: number;
  target_unit?: string;
  progress_mode?: GoalProgressMode;
}

export interface GoalUpdate {
  title?: string;
  description?: string | null;
  target_date?: string | null;
  target_value?: number | null;
  current_value?: number;
  target_unit?: string | null;
  progress_mode?: GoalProgressMode;
  is_completed?: boolean;
}

// SubGoal
export interface SubGoal {
  id: string;
  goal_id: string;
  title: string;
  weight: number;
  target_value: number | null;
  current_value: number;
  progress_mode: string;
  progress_rate: number;
  is_locked: boolean;
  is_completed: boolean;
  completed_at: string | null;
  xp_rewarded: number;
  coin_rewarded: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tasks?: Task[];
}

export interface SubGoalCreate {
  goal_id: string;
  title: string;
  weight?: number;
  target_value?: number;
  current_value?: number;
  progress_mode?: string;
}

export interface SubGoalUpdate {
  title?: string;
  weight?: number;
  target_value?: number | null;
  current_value?: number;
  progress_mode?: string;
  is_completed?: boolean;
}

export interface KeyResultHistory {
  id: string;
  key_result_id: string;
  nilai_perubahan: number;
  timestamp: string;
}

// Task
export interface Task {
  id: string;
  user_id: string;
  sub_goal_id: string | null;
  title: string;
  difficulty: DifficultyEnum;
  priority: PriorityEnum;
  is_completed: boolean;
  completed_at: string | null;
  is_private: boolean;
  used_timer: boolean;
  is_daily: boolean;
  recurrence_days: number[];
  start_date: string | null;
  due_date: string | null;
  last_generated_date: string | null;
  xp_rewarded: number;
  coin_rewarded: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskCreate {
  title: string;
  difficulty?: DifficultyEnum;
  priority?: PriorityEnum;
  sub_goal_id?: string | null;
  is_private?: boolean;
  is_daily?: boolean;
  recurrence_days?: number[];
  start_date?: string | null;
  due_date?: string | null;
}

export interface TaskUpdate {
  title?: string;
  difficulty?: DifficultyEnum;
  priority?: PriorityEnum;
  is_completed?: boolean;
  is_private?: boolean;
  used_timer?: boolean;
  is_daily?: boolean;
  recurrence_days?: number[];
  start_date?: string | null;
  due_date?: string | null;
  sub_goal_id?: string | null;
}

// Habit
export interface Habit {
  id: string;
  user_id: string;
  title: string;
  habit_type: HabitTypeEnum;
  current_streak: number;
  best_streak: number;
  total_completions: number;
  last_logged_at: string | null;
  reminder_time: string | null;
  xp_rewarded: number;
  coin_rewarded: number;
  logged_today: boolean;
  bad_habit_penalty_preview?: number;
  bad_habit_base_penalty?: number;
  bad_habit_penalty_multiplier?: number;
  bad_habit_penalty_threshold?: number;
  bad_habit_penalty_window_days?: number;
  bad_habit_recent_penalty_count?: number;
  bad_habit_penalty_multiplier_active?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HabitCreate {
  title: string;
  habit_type: HabitTypeEnum;
  reminder_time?: string | null;
}

export interface HabitUpdate {
  title?: string;
  habit_type?: HabitTypeEnum;
  reminder_time?: string | null;
}

export interface HabitLogDatePayload {
  local_date: string;
}

export interface HabitHistoryItem {
  id: string;
  user_id: string;
  habit_id: string;
  habit_type: HabitTypeEnum;
  local_date: string;
  logged_at: string;
  xp_earned: number;
  coin_earned: number;
  penalty: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HabitLogResponse {
  success: boolean;
  message: string;
  xp_earned: number;
  coins_earned: number;
  penalty: number;
  new_streak: number;
  new_balance: {
    level: number;
    xp: number;
    coins: number;
  };
}

// Wallet
export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  wallet_type: WalletTypeEnum;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  transactions?: Transaction[];
}

export interface WalletCreate {
  name: string;
  wallet_type: WalletTypeEnum;
  balance?: number;
}

// Transaction
export interface Transaction {
  id: string;
  wallet_id: string;
  type: TransactionTypeEnum;
  amount: number;
  category: string;
  transaction_date: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransactionCreate {
  wallet_id: string;
  type: TransactionTypeEnum;
  amount: number;
  category: string;
  transaction_date?: string;
  description?: string;
  is_private?: boolean;
}

export interface TransactionUpdate {
  wallet_id?: string;
  type?: TransactionTypeEnum;
  amount?: number;
  category?: string;
  transaction_date?: string;
  description?: string;
  is_private?: boolean;
}

export interface FinanceSummary {
  total_income: number;
  total_expense: number;
  net: number;
  total_balance: number;
  total_wallets: number;
  by_category: { category: string; total: number }[];
}

// Budget
export interface Budget {
  id: string;
  user_id: string;
  category: string;
  limit_amount: number;
  current_spent: number;
  period: BudgetPeriodEnum;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BudgetCreate {
  category: string;
  limit_amount: number;
  period?: BudgetPeriodEnum;
  start_date?: string | null;
  end_date?: string | null;
}

export interface BudgetUpdate {
  category?: string;
  limit_amount?: number;
  current_spent?: number;
  period?: BudgetPeriodEnum;
  start_date?: string | null;
  end_date?: string | null;
}

export interface BillReminder {
  id: string;
  user_id: string;
  title: string;
  category: string;
  amount: number | null;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  paid_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BillReminderCreate {
  title: string;
  category: string;
  amount?: number | null;
  due_date: string;
}

export interface BillReminderUpdate {
  title?: string;
  category?: string;
  amount?: number | null;
  due_date?: string;
  is_paid?: boolean;
}

// Reward
export interface Reward {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  icon: string | null;
  times_purchased: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RewardCreate {
  title: string;
  description?: string;
  price: number;
  icon?: string;
}

export interface RewardPurchaseResponse {
  success: boolean;
  message: string;
  remaining_coins: number;
  reward_title: string;
}

// Gamification
export interface CompletionRewardResponse {
  success: boolean;
  message: string;
  xp_earned: number;
  coins_earned: number;
  penalty: number;
  new_level: number;
  new_xp: number;
  new_coins: number;
  xp_needed_for_next_level: number;
}

export interface GamificationConfig {
  task_easy_xp: number;
  task_easy_coins: number;
  task_easy_on_time_bonus_coins: number;
  task_medium_xp: number;
  task_medium_coins: number;
  task_medium_on_time_bonus_coins: number;
  task_hard_xp: number;
  task_hard_coins: number;
  task_hard_on_time_bonus_coins: number;
  goal_complete_xp: number;
  goal_complete_coins: number;
  subgoal_complete_xp: number;
  subgoal_complete_coins: number;
  good_habit_daily_xp: number;
  good_habit_daily_coins: number;
  good_habit_streak_bonus_multiplier: number;
  bad_habit_penalty_coins: number;
  bad_habit_penalty_multiplier: number;
  bad_habit_penalty_threshold: number;
  bad_habit_penalty_window_days: number;
  level_up_formula_base: number;
}

// Partner Connection
export interface AccountabilityConnection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: ConnectionStatusEnum;
  created_at: string;
  updated_at: string;
  requester?: UserPublicProfile;
  receiver?: UserPublicProfile;
}

export interface PartnerSharingScopeItem {
  key: string;
  label: string;
  description: string;
}

export interface PartnerSharingScope {
  consent_required: boolean;
  visibility_note: string;
  shared_data: PartnerSharingScopeItem[];
}

// Dashboard


export interface MonthlyComparisonItem {
  year_month: string;
  label: string;
  start_date: string;
  end_date: string;
  finance: {
    income: number;
    expense: number;
    net: number;
    savings_rate: number;
    score: number;
  };
  productivity: {
    due_tasks: number;
    completed_tasks: number;
    completion_rate: number;
    goals_completed: number;
    habit_completions: number;
    tracked_minutes: number;
    score: number;
  };
}

export interface MonthlyComparisonSummary {
  months: number;
  generated_at: string;
  items: MonthlyComparisonItem[];
}

export interface DashboardDiagnosticCheck {
  key: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  count: number;
  message: string;
  action_label?: string | null;
  action_path?: string | null;
  details: Record<string, unknown>;
}

export interface DashboardChartDiagnostic {
  key: string;
  label: string;
  visible: boolean;
  status: 'ok' | 'warning' | 'error';
  reason: string;
  required_data: string;
  action_label?: string | null;
  action_path?: string | null;
  details: Record<string, unknown>;
}

export interface DashboardDiagnostics {
  generated_at: string;
  app_env: string;
  analytics_ok: boolean;
  is_fallback: boolean;
  summary_error?: string | null;
  checks: DashboardDiagnosticCheck[];
  charts: DashboardChartDiagnostic[];
}

export interface DashboardSummary {
  is_fallback?: boolean;
  warning?: string | null;
  level: number;
  xp_balance: number;
  total_xp_earned: number;
  coin_balance: number;
  xp_needed_for_next_level: number;
  total_goals: number;
  completed_goals: number;
  total_tasks: number;
  completed_tasks: number;
  good_habits: number;
  bad_habits: number;
  total_habit_completions: number;
  total_wallets: number;
  total_balance: number;
  total_income_month: number;
  total_expense_month: number;
  weekly_task_metrics: {
    total: number;
    completed: number;
    completion_rate: number;
    due_total?: number;
    due_completed?: number;
    completed_this_week?: number;
    created_this_week?: number;
    overdue?: number;
    due_today?: number;
  };
  weekly_cashflow: {
    date: string;
    income: number;
    expense: number;
  }[];
  financial_breakdown: {
    category: string;
    income: number;
    expense: number;
  }[];
  weekly_comparison: {
    label: string;
    current: number;
    previous: number;
    change: number;
  }[];
  task_completion_rates: {
    period: string;
    total: number;
    completed: number;
    completion_rate: number;
  }[];
  daily_task_trend?: {
    date: string;
    total: number;
    completed: number;
    completion_rate: number;
  }[];
  upcoming_deadlines: {
    id: string;
    type: string;
    title: string;
    due_date: string;
    days_left: number;
  }[];
  recent_activities: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    amount: number | null;
    occurred_at: string;
  }[];
  numeric_goal_progress: {
    id: string;
    title: string;
    target_value: number;
    current_value: number;
    target_unit: string | null;
    progress_mode: string;
    progress_rate: number;
  }[];
  time_allocation: {
    category: string;
    duration_minutes: number;
    duration_seconds?: number;
    percentage: number;
  }[];
  productivity_score: number;
  finance_score: number;
  life_score: number;
}

// Coin Ledger
export interface CoinLedger {
  id: string;
  user_id: string;
  transaction_type: CoinLedgerTypeEnum;
  amount: number;
  source_description: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  time_session_id: string | null;
  category: string;
  title: string;
  duration_minutes: number;
  duration_seconds?: number | null;
  activity_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ActivityLogCreate {
  category: string;
  title: string;
  duration_minutes?: number;
  duration_seconds?: number;
  activity_date?: string;
  notes?: string;
}

export interface ActivityLogUpdate {
  category?: string;
  title?: string;
  duration_minutes?: number;
  duration_seconds?: number;
  activity_date?: string;
  notes?: string | null;
}

export interface TimeSession {
  id: string;
  user_id: string;
  task_id: string | null;
  category: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TimeSessionCreate {
  category: string;
  title: string;
  task_id?: string | null;
  started_at?: string;
  notes?: string;
}

export interface TimeSessionStop {
  ended_at?: string;
  create_activity_log?: boolean;
}

export type TimeSummaryPeriod = 'daily' | 'weekly' | 'monthly';

export interface TimeSummaryCategory {
  category: string;
  duration_minutes: number;
  duration_seconds?: number;
  percentage: number;
}

export interface TimeSummaryTrendPoint {
  date: string;
  label: string;
  duration_minutes: number;
  duration_seconds?: number;
}

export interface TimeSummaryCategoryComparison {
  category: string;
  current_duration_minutes: number;
  current_duration_seconds: number;
  previous_duration_minutes: number;
  previous_duration_seconds: number;
  change_seconds: number;
  change_percent: number;
}

export interface TimeSummaryComparison {
  previous_start_date: string;
  previous_end_date: string;
  current_total_minutes: number;
  current_total_seconds: number;
  previous_total_minutes: number;
  previous_total_seconds: number;
  change_seconds: number;
  change_percent: number;
  by_category: TimeSummaryCategoryComparison[];
}

export interface TimeSummary {
  period: TimeSummaryPeriod;
  start_date: string;
  end_date: string;
  total_seconds?: number;
  total_minutes: number;
  total_hours: number;
  log_count: number;
  by_category: TimeSummaryCategory[];
  daily_trend: TimeSummaryTrendPoint[];
  comparison?: TimeSummaryComparison;
}

// Reminder Center
export interface ReminderItem {
  id: string;
  type: 'task' | 'bill' | 'habit' | 'time_session' | string;
  title: string;
  due_at: string | null;
  priority: 'normal' | 'high' | string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface ReminderCenterResponse {
  today: ReminderItem[];
  tomorrow: ReminderItem[];
  overdue: ReminderItem[];
  habits: ReminderItem[];
  active_timers: ReminderItem[];
  total_count: number;
}

export interface ReminderCountResponse {
  count: number;
}

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  channel: string;
  dedupe_key: string | null;
  metadata_json: string | null;
  read_at: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NotificationUnreadCountResponse {
  unread_count: number;
}
