import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { goalApi, taskApi } from '@/api/productivity';
import { rewardsApi } from '@/api/rewards';
import type { CompletionRewardResponse, DifficultyEnum, GamificationConfig, Goal, PriorityEnum, Task } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Circle, Lock, Pencil, Plus, Shield, Target, Trash2, Zap } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { fromDateTimeLocal } from '@/lib/format';
import { isBlank } from '@/lib/form-validation';
import { useAuth } from '@/context/useAuth';
import {
  compactBadgeClass,
  compactIconButtonClass,
  compactIconClass,
  flattenSubGoals,
  isTaskLocked,
  toDateTimeLocal,
} from './productivity-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';

type TaskStatusFilter = 'all' | 'open' | 'completed' | 'locked';
type TaskVisibilityFilter = 'all' | 'public' | 'private';
type TaskScheduleFilter = 'all' | 'daily' | 'one_time';

function getDifficultyColor(difficulty: DifficultyEnum) {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-50 text-green-600 border-green-200';
    case 'medium':
      return 'bg-yellow-50 text-yellow-600 border-yellow-200';
    case 'hard':
      return 'bg-red-50 text-red-600 border-red-200';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

function getDifficultyLabel(difficulty: DifficultyEnum) {
  if (difficulty === 'easy') return 'Mudah';
  if (difficulty === 'medium') return 'Sedang';
  return 'Sulit';
}

function getPriorityLabel(priority: PriorityEnum) {
  if (priority === 'high') return 'Tinggi';
  if (priority === 'low') return 'Rendah';
  return 'Sedang';
}

function getTaskPriority(task: Task): PriorityEnum {
  return task.priority || 'medium';
}

function getTaskRewardPreview(config: GamificationConfig | null, difficulty: DifficultyEnum) {
  if (!config) return 'Hadiah mengikuti pengaturan aplikasi';

  const rewardByDifficulty: Record<DifficultyEnum, { xp: number; coins: number; onTimeBonus: number }> = {
    easy: {
      xp: config.task_easy_xp,
      coins: config.task_easy_coins,
      onTimeBonus: config.task_easy_on_time_bonus_coins,
    },
    medium: {
      xp: config.task_medium_xp,
      coins: config.task_medium_coins,
      onTimeBonus: config.task_medium_on_time_bonus_coins,
    },
    hard: {
      xp: config.task_hard_xp,
      coins: config.task_hard_coins,
      onTimeBonus: config.task_hard_on_time_bonus_coins,
    },
  };

  const reward = rewardByDifficulty[difficulty];
  const bonusInfo = reward.onTimeBonus > 0 ? `, +${reward.onTimeBonus} koin jika tepat waktu` : '';

  return `Dasar ${reward.xp} XP, ${reward.coins} koin${bonusInfo}`;
}

function getCompletionRewardInfo(result: CompletionRewardResponse) {
  const parts = [];

  if (result.xp_earned > 0) parts.push(`+${result.xp_earned} XP`);
  if (result.coins_earned > 0) parts.push(`+${result.coins_earned} koin`);
  if (result.penalty > 0) parts.push(`-${result.penalty} koin penalti`);

  return parts.length ? parts.join(', ') : result.message;
}

export default function TasksTab() {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [rewardConfig, setRewardConfig] = useState<GamificationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityEnum>('medium');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<DifficultyEnum>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskSubGoalId, setNewTaskSubGoalId] = useState('none');
  const [newTaskIsPrivate, setNewTaskIsPrivate] = useState(false);
  const [newTaskIsDaily, setNewTaskIsDaily] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<PriorityEnum>('medium');
  const [editTaskDifficulty, setEditTaskDifficulty] = useState<DifficultyEnum>('medium');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskSubGoalId, setEditTaskSubGoalId] = useState('none');
  const [editTaskIsPrivate, setEditTaskIsPrivate] = useState(false);
  const [editTaskIsDaily, setEditTaskIsDaily] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyEnum>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<TaskVisibilityFilter>('all');
  const [scheduleFilter, setScheduleFilter] = useState<TaskScheduleFilter>('all');
  const [focusOnly, setFocusOnly] = useState(true);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverPriority, setDragOverPriority] = useState<PriorityEnum | null>(null);

  useEffect(() => {
    const requestedStatus = searchParams.get('status');
    if (requestedStatus === 'all' || requestedStatus === 'open' || requestedStatus === 'completed' || requestedStatus === 'locked') {
      setStatusFilter(requestedStatus);
    }
  }, [searchParams]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [taskData, goalData, configData] = await Promise.all([
        taskApi.getAll(),
        goalApi.getAll(),
        rewardsApi.getConfig(),
      ]);
      setTasks(taskData);
      setGoals(goalData);
      setRewardConfig(configData);
    } catch (error) {
      console.error(error);
      setTasks([]);
      setGoals([]);
      setRewardConfig(null);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data tugas dan target.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTasks();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTasks]);

  const subGoalOptions = useMemo(() => flattenSubGoals(goals), [goals]);
  const assignableSubGoalOptions = useMemo(
    () => subGoalOptions.filter((subGoal) => !subGoal.is_locked && !subGoal.is_completed),
    [subGoalOptions],
  );
  const activeGoal = useMemo(() => {
    return [...goals]
      .filter((goal) => !goal.is_completed)
      .sort((a, b) => {
        const aTime = new Date(a.target_date || a.created_at).getTime();
        const bTime = new Date(b.target_date || b.created_at).getTime();
        return aTime - bTime;
      })[0] ?? null;
  }, [goals]);
  const activeGoalSubGoalIds = useMemo(() => {
    if (!activeGoal) return new Set<string>();
    return new Set((activeGoal.sub_goals ?? []).map((subGoal) => subGoal.id));
  }, [activeGoal]);

  const getSubGoalLabel = useCallback((subGoalId: string | null) => {
    if (!subGoalId) return null;
    const subGoal = subGoalOptions.find((item) => item.id === subGoalId);
    return subGoal ? `${subGoal.title} (${subGoal.goal_title})` : 'Target turunan terkait';
  }, [subGoalOptions]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.is_completed).length,
    [tasks],
  );

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const normalizedSearch = taskSearch.trim().toLowerCase();
    const linkedLabel = getSubGoalLabel(task.sub_goal_id)?.toLowerCase() || '';
    const matchesSearch = !normalizedSearch
      || task.title.toLowerCase().includes(normalizedSearch)
      || linkedLabel.includes(normalizedSearch);
    const locked = isTaskLocked(task, goals);
    const matchesStatus =
      statusFilter === 'all'
      || (statusFilter === 'open' && !task.is_completed && !locked)
      || (statusFilter === 'completed' && task.is_completed)
      || (statusFilter === 'locked' && locked);
    const matchesDifficulty = difficultyFilter === 'all' || task.difficulty === difficultyFilter;
    const matchesVisibility = visibilityFilter === 'all'
      || (visibilityFilter === 'public' && !task.is_private)
      || (visibilityFilter === 'private' && task.is_private);
    const matchesSchedule = scheduleFilter === 'all'
      || (scheduleFilter === 'daily' && task.is_daily)
      || (scheduleFilter === 'one_time' && !task.is_daily);

    const matchesFocus = !focusOnly
      || !activeGoal
      || !task.sub_goal_id
      || activeGoalSubGoalIds.has(task.sub_goal_id);

    return matchesSearch && matchesStatus && matchesDifficulty && matchesVisibility && matchesSchedule && matchesFocus;
  }), [activeGoal, activeGoalSubGoalIds, difficultyFilter, focusOnly, getSubGoalLabel, goals, scheduleFilter, statusFilter, taskSearch, tasks, visibilityFilter]);

  const priorityGroups = useMemo(() => {
    const openTasks = filteredTasks.filter((task) => !task.is_completed && !isTaskLocked(task, goals));
    const completedOrLockedTasks = filteredTasks.filter((task) => task.is_completed || isTaskLocked(task, goals));

    return {
      high: openTasks.filter((task) => getTaskPriority(task) === 'high'),
      medium: openTasks.filter((task) => getTaskPriority(task) === 'medium'),
      low: openTasks.filter((task) => getTaskPriority(task) === 'low'),
      done: completedOrLockedTasks,
    };
  }, [filteredTasks, goals]);

  const resetCreateForm = () => {
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setNewTaskDifficulty('medium');
    setNewTaskDueDate('');
    setNewTaskSubGoalId('none');
    setNewTaskIsPrivate(false);
    setNewTaskIsDaily(false);
  };

  const createTask = async () => {
    if (isBlank(newTaskTitle)) {
      toast({ title: 'Judul tugas wajib diisi', variant: 'destructive' });
      return;
    }

    try {
      await taskApi.create({
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        difficulty: newTaskDifficulty,
        due_date: newTaskDueDate ? fromDateTimeLocal(newTaskDueDate) : null,
        sub_goal_id: newTaskSubGoalId === 'none' ? null : newTaskSubGoalId,
        is_private: newTaskIsPrivate,
        is_daily: newTaskIsDaily,
      });
      resetCreateForm();
      setDialogOpen(false);
      await loadTasks();
      toast({ title: 'Tugas berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat tugas'), variant: 'destructive' });
    }
  };

  const completeTask = async (task: Task) => {
    try {
      const result: CompletionRewardResponse = await taskApi.complete(task.id);
      await Promise.all([loadTasks(), refreshUser()]);
      toast({
        title: result.success ? 'Tugas selesai' : result.message,
        description: getCompletionRewardInfo(result),
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menyelesaikan tugas'), variant: 'destructive' });
    }
  };

  const openEditTask = (task: Task) => {
    if (task.is_completed || isTaskLocked(task, goals)) {
      toast({ title: 'Tugas sudah selesai atau terkunci.', variant: 'destructive' });
      return;
    }

    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskPriority(getTaskPriority(task));
    setEditTaskDifficulty(task.difficulty);
    setEditTaskDueDate(toDateTimeLocal(task.due_date));
    setEditTaskSubGoalId(task.sub_goal_id || 'none');
    setEditTaskIsPrivate(task.is_private);
    setEditTaskIsDaily(task.is_daily);
    setEditDialogOpen(true);
  };

  const updateTask = async () => {
    if (!editingTask) return;
    if (isBlank(editTaskTitle)) {
      toast({ title: 'Judul tugas wajib diisi', variant: 'destructive' });
      return;
    }

    try {
      await taskApi.update(editingTask.id, {
        title: editTaskTitle.trim(),
        priority: editTaskPriority,
        difficulty: editTaskDifficulty,
        due_date: editTaskDueDate ? fromDateTimeLocal(editTaskDueDate) : null,
        sub_goal_id: editTaskSubGoalId === 'none' ? null : editTaskSubGoalId,
        is_private: editTaskIsPrivate,
        is_daily: editTaskIsDaily,
      });
      setEditDialogOpen(false);
      setEditingTask(null);
      await loadTasks();
      toast({ title: 'Tugas berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui tugas'), variant: 'destructive' });
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await taskApi.delete(id);
      await loadTasks();
      toast({ title: 'Tugas berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus tugas'), variant: 'destructive' });
    }
  };

  const moveTaskToPriority = async (taskId: string, nextPriority: PriorityEnum) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.is_completed || isTaskLocked(task, goals) || getTaskPriority(task) === nextPriority) {
      setDraggingTaskId(null);
      setDragOverPriority(null);
      return;
    }

    setTasks((current) => current.map((item) => (
      item.id === taskId ? { ...item, priority: nextPriority } : item
    )));
    setDraggingTaskId(null);
    setDragOverPriority(null);

    try {
      await taskApi.update(task.id, { priority: nextPriority });
      toast({ title: `Prioritas dipindah ke ${getPriorityLabel(nextPriority).toLowerCase()}` });
    } catch (error) {
      await loadTasks();
      toast({ title: getApiErrorMessage(error, 'Gagal mengubah prioritas tugas'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState label="Memuat tugas..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Tugas belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadTasks()}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Card className="border-slate-200 bg-[#F8FAFC]">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Mode fokus</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {activeGoal ? activeGoal.title : 'Belum ada goal aktif'}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {activeGoal
                  ? 'Default-nya daftar task dipersempit ke goal aktif supaya kamu tidak lompat-lompat tujuan.'
                  : 'Buat goal dan target turunan agar task harian punya arah yang jelas.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2">
                <p className="text-xs text-slate-500">Task tampil</p>
                <p className="text-lg font-bold text-slate-800">{filteredTasks.length}</p>
              </div>
              <Button
                type="button"
                variant={focusOnly ? 'default' : 'outline'}
                onClick={() => setFocusOnly((current) => !current)}
                className={focusOnly ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white/70'}
              >
                <Target className="mr-2 h-4 w-4" />
                {focusOnly ? 'Fokus aktif' : 'Semua task'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Daftar Task</h3>
            <p className="text-sm text-slate-500">
              {completedCount}/{tasks.length} selesai
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-1" /> Tambah Tugas
              </Button>
            </DialogTrigger>
            <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
              <DialogHeader>
                <DialogTitle>Buat Tugas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Judul</Label>
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Judul tugas..."
                    className="bg-white/70 border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <Label>Goal / detail goal terkait</Label>
                  <Select value={newTaskSubGoalId} onValueChange={setNewTaskSubGoalId}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue placeholder="Tanpa goal / task umum" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="none">Tanpa goal / task umum</SelectItem>
                      {assignableSubGoalOptions.map((subGoal) => (
                        <SelectItem key={subGoal.id} value={subGoal.id}>
                          {subGoal.title} - {subGoal.goal_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">
                    Pilih detail goal jika task ini menunjang goal tertentu. Biarkan tanpa goal untuk task umum.
                  </p>
                </div>
                <div>
                  <Label>Prioritas</Label>
                  <Select value={newTaskPriority} onValueChange={(value: PriorityEnum) => setNewTaskPriority(value)}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kesulitan</Label>
                  <Select value={newTaskDifficulty} onValueChange={(value: DifficultyEnum) => setNewTaskDifficulty(value)}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="easy">Mudah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="hard">Sulit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <details className="quick-form-advanced">
                  <summary>Detail lanjutan</summary>
                  <div className="quick-form-advanced-content space-y-4">
                    <div>
                      <Label>Deadline (opsional)</Label>
                      <Input
                        type="datetime-local"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Reward: {getTaskRewardPreview(rewardConfig, newTaskDifficulty)}.
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Tugas harian</Label>
                        <p className="text-xs text-slate-500">Tandai jika tugas ini bagian dari rutinitas harian.</p>
                      </div>
                      <Switch checked={newTaskIsDaily} onCheckedChange={(checked) => setNewTaskIsDaily(Boolean(checked))} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Tugas privat</Label>
                        <p className="text-xs text-slate-500">Tugas privat tidak ditampilkan ke partner.</p>
                      </div>
                      <Switch checked={newTaskIsPrivate} onCheckedChange={(checked) => setNewTaskIsPrivate(Boolean(checked))} />
                    </div>
                  </div>
                </details>
                <Button onClick={createTask} className="w-full bg-blue-600 hover:bg-blue-700">
                  Buat Tugas
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
              <DialogHeader>
                <DialogTitle>Edit Tugas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Judul</Label>
                  <Input
                    value={editTaskTitle}
                    onChange={(e) => setEditTaskTitle(e.target.value)}
                    className="bg-white/70 border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <Label>Goal / detail goal terkait</Label>
                  <Select value={editTaskSubGoalId} onValueChange={setEditTaskSubGoalId}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="none">Tanpa goal / task umum</SelectItem>
                      {assignableSubGoalOptions.map((subGoal) => (
                        <SelectItem key={subGoal.id} value={subGoal.id}>
                          {subGoal.title} - {subGoal.goal_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioritas</Label>
                  <Select value={editTaskPriority} onValueChange={(value: PriorityEnum) => setEditTaskPriority(value)}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kesulitan</Label>
                  <Select value={editTaskDifficulty} onValueChange={(value: DifficultyEnum) => setEditTaskDifficulty(value)}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="easy">Mudah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="hard">Sulit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <details className="quick-form-advanced">
                  <summary>Detail lanjutan</summary>
                  <div className="quick-form-advanced-content space-y-4">
                    <div>
                      <Label>Deadline</Label>
                      <Input
                        type="datetime-local"
                        value={editTaskDueDate}
                        onChange={(e) => setEditTaskDueDate(e.target.value)}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Reward: {getTaskRewardPreview(rewardConfig, editTaskDifficulty)}.
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Tugas harian</Label>
                        <p className="text-xs text-slate-500">Tugas harian akan terbuka lagi otomatis saat hari berganti.</p>
                      </div>
                      <Switch checked={editTaskIsDaily} onCheckedChange={(checked) => setEditTaskIsDaily(Boolean(checked))} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Tugas privat</Label>
                        <p className="text-xs text-slate-500">Tugas privat tidak ditampilkan ke partner.</p>
                      </div>
                      <Switch checked={editTaskIsPrivate} onCheckedChange={(checked) => setEditTaskIsPrivate(Boolean(checked))} />
                    </div>
                  </div>
                </details>
                <Button onClick={updateTask} className="w-full bg-blue-600 hover:bg-blue-700">
                  Simpan Tugas
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_150px_150px_150px_150px]">
          <Input
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Cari tugas atau target turunan..."
          />
          <Select value={statusFilter} onValueChange={(value: TaskStatusFilter) => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="open">Belum selesai</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
              <SelectItem value="locked">Terkunci</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={(value: 'all' | DifficultyEnum) => setDifficultyFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kesulitan</SelectItem>
              <SelectItem value="easy">Mudah</SelectItem>
              <SelectItem value="medium">Sedang</SelectItem>
              <SelectItem value="hard">Sulit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={visibilityFilter} onValueChange={(value: TaskVisibilityFilter) => setVisibilityFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua visibilitas</SelectItem>
              <SelectItem value="public">Terlihat partner</SelectItem>
              <SelectItem value="private">Privat</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scheduleFilter} onValueChange={(value: TaskScheduleFilter) => setScheduleFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua jadwal</SelectItem>
              <SelectItem value="daily">Harian</SelectItem>
              <SelectItem value="one_time">Sekali saja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="task-board">
          {[
            { key: 'high' as const, title: 'Prioritas Tinggi', priority: 'high' as PriorityEnum, color: '#ef4444', items: priorityGroups.high },
            { key: 'medium' as const, title: 'Prioritas Sedang', priority: 'medium' as PriorityEnum, color: '#d28b0f', items: priorityGroups.medium },
            { key: 'low' as const, title: 'Prioritas Rendah', priority: 'low' as PriorityEnum, color: '#22ad73', items: priorityGroups.low },
          ].map((section) => (
            <section
              key={section.key}
              className={`task-priority-section ${dragOverPriority === section.priority ? 'is-drag-over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverPriority(section.priority);
              }}
              onDragLeave={() => setDragOverPriority(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingTaskId) void moveTaskToPriority(draggingTaskId, section.priority);
              }}
            >
              <div className="task-section-header">
                <h4 className="task-section-title">
                  <span className="task-section-dot" style={{ backgroundColor: section.color }} />
                  {section.title}
                </h4>
                <span className="task-section-count">{section.items.length}</span>
              </div>
              <div className="task-card-grid">
                {section.items.map((task) => {
                  const linkedSubGoalLabel = getSubGoalLabel(task.sub_goal_id);
                  return (
                    <article
                      id={dashboardTargetId(task.id)}
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggingTaskId(task.id);
                        event.dataTransfer.setData('text/plain', task.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDragOverPriority(null);
                      }}
                      className={`task-board-card ${draggingTaskId === task.id ? 'is-dragging' : ''} ${highlightClassName(task.id)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            onClick={() => confirm({
                              title: 'Selesaikan tugas?',
                              description: 'Tugas akan ditandai selesai. Aplikasi akan menghitung XP, koin, bonus tepat waktu, serta progres target terkait.',
                              confirmLabel: 'Selesaikan',
                              onConfirm: () => completeTask(task),
                            })}
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600"
                            aria-label={`Selesaikan ${task.title}`}
                          >
                            <Circle className="h-4 w-4" />
                          </button>
                          <div className="min-w-0">
                            <h4 className="task-board-title">{task.title}</h4>
                            <div className="task-board-meta">
                              <Badge variant="outline" className={`${compactBadgeClass} ${getDifficultyColor(task.difficulty)}`}>
                                {getDifficultyLabel(task.difficulty)}
                              </Badge>
                              {linkedSubGoalLabel && <span>{linkedSubGoalLabel}</span>}
                              {!linkedSubGoalLabel && <span>Task umum</span>}
                              {task.due_date && <span>Batas {new Date(task.due_date).toLocaleDateString('id-ID')}</span>}
                              {task.is_daily && <span>Harian</span>}
                              {task.is_private && <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" /> Privat</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditTask(task)}
                            className={compactIconButtonClass}
                            title="Edit tugas"
                          >
                            <Pencil className={compactIconClass} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirm({
                              title: 'Hapus tugas?',
                              description: 'Tugas ini akan dihapus dari daftar produktivitas.',
                              onConfirm: () => deleteTask(task.id),
                            })}
                            className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                            title="Hapus tugas"
                          >
                            <Trash2 className={compactIconClass} />
                          </Button>
                        </div>
                      </div>
                      <p className="task-board-reward">{getTaskRewardPreview(rewardConfig, task.difficulty)}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="task-priority-section">
            <div className="task-section-header">
              <h4 className="task-section-title">
                <span className="task-section-dot bg-slate-400" />
                Selesai / Terkunci
              </h4>
              <span className="task-section-count">{priorityGroups.done.length}</span>
            </div>
            <div className="task-card-grid">
              {priorityGroups.done.map((task) => {
                const locked = isTaskLocked(task, goals);
                const linkedSubGoalLabel = getSubGoalLabel(task.sub_goal_id);
                return (
                  <article key={task.id} id={dashboardTargetId(task.id)} className={`task-board-card opacity-70 ${highlightClassName(task.id)}`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                        {locked ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <h4 className="task-board-title line-through">{task.title}</h4>
                        <div className="task-board-meta">
                          <span>{locked ? 'Terkunci karena target selesai' : `+${task.xp_rewarded} XP, +${task.coin_rewarded} koin`}</span>
                          {linkedSubGoalLabel && <span>{linkedSubGoalLabel}</span>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {tasks.length === 0 && (
            <EmptyState
              icon={Zap}
              title="Belum ada tugas"
              description="Tambahkan tugas pertama untuk mulai bergerak. Tugas bisa berdiri sendiri atau dihubungkan ke target turunan."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
          {tasks.length > 0 && filteredTasks.length === 0 && (
            <EmptyState
              icon={Zap}
              title="Tugas tidak ditemukan"
              description="Coba ubah kata kunci, status, tingkat kesulitan, visibilitas, atau filter jadwal."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
