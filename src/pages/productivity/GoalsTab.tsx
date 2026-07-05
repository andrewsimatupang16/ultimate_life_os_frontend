import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { goalApi } from '@/api/productivity';
import type { Goal, GoalCreate, GoalProgressMode, GoalUpdate, CompletionRewardResponse } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Plus, Trash2, CheckCircle2, Circle, Target, Star, Pencil, Lock } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { fromDateTimeLocalOrUndefined } from '@/lib/format';
import { compactBadgeClass, compactCardClass, compactContentClass, compactGridClass, compactIconButtonClass, compactIconClass, compactMetaClass, compactTitleClass, getGoalTargetInfo, toDateTimeLocal } from './productivity-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';

const GOAL_PROGRESS_MODES: { value: GoalProgressMode; label: string; helper: string }[] = [
  {
    value: 'manual',
    label: 'Input angka manual',
    helper: 'Progres dihitung dari angka saat ini dibanding target angka.',
  },
  {
    value: 'weighted_subgoals',
    label: 'Target turunan berbobot',
    helper: 'Progres mengikuti target turunan yang punya bobot berbeda.',
  },
];

type GoalFormInput = {
  title: string;
  description: string;
  targetDate: string;
  targetValue: string;
  currentValue: string;
  targetUnit: string;
  progressMode: GoalProgressMode;
};

type ParsedGoalForm = {
  payload: GoalCreate | GoalUpdate;
  currentValue?: number;
  targetValue?: number;
};

function parseOptionalNumber(value: string, fieldLabel: string, minimum: number, requiredGreaterThanMinimum = false) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return { value: undefined };

  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue)) {
    return { error: `${fieldLabel} harus berupa angka valid.` };
  }

  const isInvalid = requiredGreaterThanMinimum ? parsedValue <= minimum : parsedValue < minimum;
  if (isInvalid) {
    const comparator = requiredGreaterThanMinimum ? `lebih besar dari ${minimum}` : `minimal ${minimum}`;
    return { error: `${fieldLabel} harus ${comparator}.` };
  }

  return { value: parsedValue };
}

function buildGoalPayload(form: GoalFormInput, mode: 'create' | 'update'): ParsedGoalForm | { error: string } {
  const title = form.title.trim();
  if (!title) return { error: 'Judul target wajib diisi.' };

  const isManualProgress = form.progressMode === 'manual';
  const parsedTarget = isManualProgress
    ? parseOptionalNumber(form.targetValue, 'Target angka', 0, true)
    : { value: undefined };
  if ('error' in parsedTarget && parsedTarget.error) return { error: parsedTarget.error };

  const parsedCurrent = isManualProgress
    ? parseOptionalNumber(form.currentValue, 'Angka saat ini', 0)
    : { value: undefined };
  if ('error' in parsedCurrent && parsedCurrent.error) return { error: parsedCurrent.error };

  const payload: GoalCreate | GoalUpdate = {
    title,
    description: form.description.trim() || (mode === 'update' ? null : undefined),
    target_date: form.targetDate ? fromDateTimeLocalOrUndefined(form.targetDate) : mode === 'update' ? null : undefined,
    target_value: isManualProgress ? parsedTarget.value : mode === 'update' ? null : undefined,
    current_value: isManualProgress
      ? mode === 'create' ? parsedCurrent.value ?? 0 : parsedCurrent.value
      : mode === 'update' ? 0 : undefined,
    target_unit: isManualProgress ? form.targetUnit.trim() || (mode === 'update' ? null : undefined) : mode === 'update' ? null : undefined,
    progress_mode: form.progressMode,
  };

  return {
    payload,
    currentValue: parsedCurrent.value,
    targetValue: parsedTarget.value,
  };
}

function getGoalProgressModeLabel(progressMode: string) {
  return GOAL_PROGRESS_MODES.find((mode) => mode.value === progressMode)?.label ?? progressMode;
}

function formatGoalNumber(value: number) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value);
}

function getGoalMeasuredProgress(goal: Goal) {
  if (goal.progress_mode !== 'manual') return null;
  if (!goal.target_value || goal.target_value <= 0) return null;

  return Math.min(100, Math.max(0, ((goal.current_value || 0) / goal.target_value) * 100));
}

function getGoalDisplayProgress(goal: Goal) {
  const manualProgress = getGoalMeasuredProgress(goal);
  if (manualProgress !== null) return manualProgress;

  return Math.min(100, Math.max(0, goal.progress_rate || 0));
}

function getGoalMeasurementText(goal: Goal) {
  const unit = goal.target_unit ? ` ${goal.target_unit}` : '';
  if (goal.target_value && goal.target_value > 0) {
    return `${formatGoalNumber(goal.current_value || 0)} / ${formatGoalNumber(goal.target_value)}${unit}`;
  }

  if ((goal.current_value || 0) > 0) {
    return `${formatGoalNumber(goal.current_value)}${unit}`;
  }

  return null;
}

function getGoalSortTime(goal: Goal) {
  if (goal.target_date) return new Date(goal.target_date).getTime();
  return new Date(goal.created_at).getTime();
}

function makeInitialGoalForm(): GoalFormInput {
  return {
    title: '',
    description: '',
    targetDate: '',
    targetValue: '',
    currentValue: '',
    targetUnit: '',
    progressMode: 'manual',
  };
}

function makeGoalFormFromGoal(goal: Goal): GoalFormInput {
  return {
    title: goal.title,
    description: goal.description || '',
    targetDate: toDateTimeLocal(goal.target_date),
    targetValue: goal.target_value != null ? String(goal.target_value) : '',
    currentValue: goal.current_value != null ? String(goal.current_value) : '',
    targetUnit: goal.target_unit || '',
    progressMode: GOAL_PROGRESS_MODES.some((mode) => mode.value === goal.progress_mode)
      ? goal.progress_mode as GoalProgressMode
      : 'manual',
  };
}

function GoalFormFields({
  form,
  setForm,
}: {
  form: GoalFormInput;
  setForm: Dispatch<SetStateAction<GoalFormInput>>;
}) {
  const selectedMode = GOAL_PROGRESS_MODES.find((mode) => mode.value === form.progressMode);
  const currentNumber = Number(form.currentValue || 0);
  const targetNumber = Number(form.targetValue || 0);
  const hasValidTarget = Number.isFinite(targetNumber) && targetNumber > 0;
  const hasValidCurrent = Number.isFinite(currentNumber) && currentNumber >= 0;
  const previewProgress = hasValidTarget && hasValidCurrent
    ? Math.min(100, Math.max(0, (currentNumber / targetNumber) * 100))
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <Label>Judul</Label>
        <Input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Contoh: Belajar Python"
          className="bg-white/70 border-slate-200 text-slate-800"
        />
      </div>

      <div>
        <Label>Cara menghitung progres</Label>
        <Select
          value={form.progressMode}
          onValueChange={(value) => setForm((current) => ({
            ...current,
            progressMode: value as GoalProgressMode,
            targetValue: value === 'manual' ? current.targetValue : '',
            currentValue: value === 'manual' ? current.currentValue : '',
            targetUnit: value === 'manual' ? current.targetUnit : '',
          }))}
        >
          <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GOAL_PROGRESS_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedMode && <p className="mt-1 text-xs text-slate-500">{selectedMode.helper}</p>}
      </div>

      {form.progressMode === 'manual' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Target jumlah</Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={form.targetValue}
              onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))}
              placeholder="10"
              className="bg-white/70 border-slate-200 text-slate-800"
            />
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Isi angka tujuan akhir. Contoh: target membaca 10 buku.
            </p>
          </div>
          <div>
            <Label>Satuan target</Label>
            <Input
              value={form.targetUnit}
              onChange={(event) => setForm((current) => ({ ...current, targetUnit: event.target.value }))}
              placeholder="task, kg, modul"
              className="bg-white/70 border-slate-200 text-slate-800"
            />
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Opsional, agar angka lebih jelas: buku, kg, modul, sesi.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-900">
          <p className="font-semibold text-blue-950">Target jumlah tidak diperlukan</p>
          <p className="mt-1">
            Untuk mode berbobot, progres target utama dihitung dari target turunan di tab Detail Goal.
            Buat beberapa detail goal lalu beri bobot sesuai prioritasnya.
          </p>
        </div>
      )}

      <details className="quick-form-advanced">
        <summary>Detail lanjutan</summary>
        <div className="quick-form-advanced-content space-y-4">
          <div>
            <Label>Deskripsi (opsional)</Label>
            <Input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Deskripsi singkat..."
              className="bg-white/70 border-slate-200 text-slate-800"
            />
          </div>

          <div className={`grid grid-cols-1 gap-3 ${form.progressMode === 'manual' ? 'md:grid-cols-2' : ''}`}>
            {form.progressMode === 'manual' && (
              <div>
                <Label>Progres saat ini</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.currentValue}
                  onChange={(event) => setForm((current) => ({ ...current, currentValue: event.target.value }))}
                  placeholder="0"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
            )}
            <div>
              <Label>Tanggal target</Label>
              <Input
                type="datetime-local"
                value={form.targetDate}
                onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
                className="bg-white/70 border-slate-200 text-slate-800"
              />
            </div>
          </div>

          {form.progressMode === 'manual' && (
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-800">Preview progres</p>
              {hasValidTarget ? (
                <p className="mt-1">
                  {hasValidCurrent ? currentNumber : 0} / {targetNumber} = <span className="font-semibold text-blue-600">{previewProgress.toFixed(0)}%</span>.
                </p>
              ) : (
                <p className="mt-1">Isi target jumlah jika ingin progres dihitung dari angka.</p>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

export default function GoalsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newGoalForm, setNewGoalForm] = useState<GoalFormInput>(() => makeInitialGoalForm());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalForm, setEditGoalForm] = useState<GoalFormInput>(() => makeInitialGoalForm());
  const [goalSearch, setGoalSearch] = useState('');
  const [goalStatusFilter, setGoalStatusFilter] = useState<'all' | 'open' | 'completed'>('all');

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await goalApi.getAll();
      setGoals(data);
    } catch (error) {
      console.error(error);
      setGoals([]);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data target.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadGoals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadGoals]);

  const createGoal = async () => {
    const result = buildGoalPayload(newGoalForm, 'create');
    if ('error' in result) {
      toast({ title: result.error, variant: 'destructive' });
      return;
    }

    try {
      const createdGoal = await goalApi.create(result.payload as GoalCreate);
      if (newGoalForm.progressMode === 'manual' && (result.currentValue ?? 0) > 0 && result.targetValue === undefined) {
        await goalApi.updateProgress(createdGoal.id, result.currentValue ?? 0);
      }

      setNewGoalForm(makeInitialGoalForm());
      setDialogOpen(false);
      void loadGoals();
      toast({ title: 'Target berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat target'), variant: 'destructive' });
    }
  };

  const completeGoal = async (id: string) => {
    try {
      const result: CompletionRewardResponse = await goalApi.complete(id);
      toast({ title: result.message });
      void loadGoals();
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menyelesaikan target'), variant: 'destructive' });
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await goalApi.delete(id);
      void loadGoals();
      toast({ title: 'Target berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus target'), variant: 'destructive' });
    }
  };

  const openEditGoal = (goal: Goal) => {
    if (goal.is_completed) {
      toast({ title: 'Target sudah selesai dan terkunci.', variant: 'destructive' });
      return;
    }

    setEditingGoal(goal);
    setEditGoalForm(makeGoalFormFromGoal(goal));
    setEditDialogOpen(true);
  };

  const updateGoal = async () => {
    if (!editingGoal) return;
    if (editingGoal.is_completed) {
      toast({ title: 'Target sudah selesai dan tidak dapat diedit.', variant: 'destructive' });
      return;
    }

    const result = buildGoalPayload(editGoalForm, 'update');
    if ('error' in result) {
      toast({ title: result.error, variant: 'destructive' });
      return;
    }

    try {
      await goalApi.update(editingGoal.id, result.payload as GoalUpdate);
      if (editGoalForm.progressMode === 'manual' && result.currentValue !== undefined && result.targetValue === undefined) {
        const currentValue = result.currentValue ?? editingGoal.current_value ?? 0;
        await goalApi.updateProgress(editingGoal.id, currentValue);
      }

      setEditDialogOpen(false);
      setEditingGoal(null);
      setEditGoalForm(makeInitialGoalForm());
      void loadGoals();
      toast({ title: 'Target berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui target'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState label="Memuat target..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Target belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadGoals()}
      />
    );
  }

  const filteredGoals = goals.filter((goal) => {
    const normalizedSearch = goalSearch.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || goal.title.toLowerCase().includes(normalizedSearch)
      || (goal.description || '').toLowerCase().includes(normalizedSearch);
    const matchesStatus =
      goalStatusFilter === 'all'
      || (goalStatusFilter === 'open' && !goal.is_completed)
      || (goalStatusFilter === 'completed' && goal.is_completed);

    return matchesSearch && matchesStatus;
  });
  const openGoals = goals
    .filter((goal) => !goal.is_completed)
    .sort((a, b) => getGoalSortTime(a) - getGoalSortTime(b));
  const activeGoal = openGoals[0] ?? null;
  const queuedGoals = openGoals.slice(1);
  const completedGoalCount = goals.filter((goal) => goal.is_completed).length;
  const orderedFilteredGoals = [...filteredGoals].sort((a, b) => {
    if (a.id === activeGoal?.id) return -1;
    if (b.id === activeGoal?.id) return 1;
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return getGoalSortTime(a) - getGoalSortTime(b);
  });

  return (
    <>
      <div className="space-y-4">
        <Card className="border-slate-200 bg-[#F8FAFC]">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Fokus sekarang</p>
              {activeGoal ? (
                <div className="mt-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-slate-900">{activeGoal.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {activeGoal.description || 'Goal ini sedang menjadi arah utama task dan habit kamu.'}
                      </p>
                    </div>
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                      {getGoalDisplayProgress(activeGoal).toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress value={getGoalDisplayProgress(activeGoal)} className="mt-4 h-2 bg-white/80" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => completeGoal(activeGoal.id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Tandai selesai
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditGoal(activeGoal)} className="bg-white/70">
                      <Pencil className="mr-1 h-4 w-4" />
                      Update progres
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <h3 className="text-xl font-bold text-slate-900">Belum ada goal aktif</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Buat goal pertama agar aplikasi bisa membantu menjaga arah kerja harian.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <p className="text-xs text-slate-500">Antrian goal</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{queuedGoals.length}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Akan naik setelah goal aktif selesai.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <p className="text-xs text-slate-500">Selesai</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{completedGoalCount}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Masuk arsip, tidak hilang.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                <p className="text-xs text-slate-500">Total goal</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">{goals.length}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Semua tujuan yang sudah dicatat.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {queuedGoals.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white/55 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Urutan goal berikutnya</p>
              <span className="text-xs text-slate-500">otomatis mengikuti deadline terdekat</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {queuedGoals.slice(0, 5).map((goal, index) => (
                <div key={goal.id} className="min-w-[220px] shrink-0 rounded-xl border border-slate-200 bg-white/75 p-3">
                  <p className="text-xs font-semibold text-blue-600">#{index + 2}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">{goal.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={getGoalDisplayProgress(goal)} className="h-1.5 bg-slate-200" />
                    <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">{getGoalDisplayProgress(goal).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Goal Stack</h3>
            <p className="text-sm text-slate-500">Satu goal aktif, sisanya antrian. Task harian sebaiknya mengikuti goal aktif.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-1" /> Tambah Target
              </Button>
            </DialogTrigger>
            <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
              <DialogHeader>
                <DialogTitle>Buat Target</DialogTitle>
              </DialogHeader>
              <GoalFormFields form={newGoalForm} setForm={setNewGoalForm} />
              <Button onClick={createGoal} className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Target
              </Button>
            </DialogContent>
          </Dialog>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
              <DialogHeader>
                <DialogTitle>Edit Target</DialogTitle>
              </DialogHeader>
              <GoalFormFields form={editGoalForm} setForm={setEditGoalForm} />
              <Button onClick={updateGoal} className="w-full bg-blue-600 hover:bg-blue-700">
                Simpan Target
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
          <Input
            value={goalSearch}
            onChange={(event) => setGoalSearch(event.target.value)}
            placeholder="Cari target atau deskripsi..."
          />
          <Select value={goalStatusFilter} onValueChange={(value: 'all' | 'open' | 'completed') => setGoalStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="open">Belum selesai</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={compactGridClass}>
          {orderedFilteredGoals.map((goal) => {
            const targetInfo = getGoalTargetInfo(goal.target_date);
            const progressValue = getGoalDisplayProgress(goal);
            const measurementText = getGoalMeasurementText(goal);
            const isActiveGoal = goal.id === activeGoal?.id;

            return (
              <Card id={dashboardTargetId(goal.id)} key={goal.id} className={`${compactCardClass} ${highlightClassName(goal.id)}`}>
                <CardContent className={compactContentClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        onClick={() => completeGoal(goal.id)}
                        disabled={goal.is_completed}
                        className={`app-list-icon ${goal.is_completed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:text-blue-600'}`}
                      >
                        {goal.is_completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0">
                        <h4 className={`${compactTitleClass} ${goal.is_completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {goal.title}
                        </h4>
                        {goal.description && <p className={compactMetaClass}>{goal.description}</p>}
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={`${compactBadgeClass} border-slate-200 text-slate-600`}>
                            {getGoalProgressModeLabel(goal.progress_mode)}
                          </Badge>
                          {isActiveGoal && (
                            <Badge className={`${compactBadgeClass} bg-blue-600 text-white hover:bg-blue-600`}>
                              Fokus aktif <ArrowRight className="ml-1 h-3 w-3" />
                            </Badge>
                          )}
                          {measurementText && (
                            <Badge variant="outline" className={`${compactBadgeClass} border-blue-200 text-blue-600`}>
                              {measurementText}
                            </Badge>
                          )}
                        </div>
                        {targetInfo && (
                          <p className={`mt-0.5 truncate text-xs ${targetInfo.isPast ? 'text-red-600' : 'text-blue-600'}`}>
                            Target {targetInfo.date} - {targetInfo.isPast ? 'Lewat ' : 'Sisa '}{targetInfo.range}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditGoal(goal)}
                        disabled={goal.is_completed}
                        className={compactIconButtonClass}
                        title={goal.is_completed ? 'Target selesai tidak dapat diedit' : 'Edit target'}
                      >
                        <Pencil className={compactIconClass} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirm({
                          title: 'Hapus target?',
                          description: 'Target ini akan dihapus beserta data terkaitnya.',
                          onConfirm: () => deleteGoal(goal.id),
                        })}
                        disabled={goal.is_completed}
                        className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                        title={goal.is_completed ? 'Target selesai terkunci dan tidak dapat dihapus' : 'Hapus target'}
                      >
                        <Trash2 className={compactIconClass} />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{goal.sub_goals?.length || 0} target turunan</span>
                      <span>{progressValue.toFixed(0)}%</span>
                    </div>
                    <Progress value={progressValue} className="h-1.5 bg-white/70" />
                  </div>
                  {goal.is_completed && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={`${compactBadgeClass} text-emerald-600 border-emerald-200`}>
                        <Lock className="mr-1 h-3 w-3" /> Selesai dan Terkunci
                      </Badge>
                      <Badge variant="outline" className={`${compactBadgeClass} text-emerald-600 border-emerald-200`}>
                        <Star className="mr-1 h-3 w-3" /> +{goal.xp_rewarded} XP, +{goal.coin_rewarded} koin
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {goals.length === 0 && (
            <EmptyState
              icon={Target}
              title="Belum ada target"
              description="Buat target pertama untuk mulai menyusun rencana. Target bisa dihitung manual atau dari target turunan."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
          {goals.length > 0 && filteredGoals.length === 0 && (
            <EmptyState
              icon={Target}
              title="Target tidak ditemukan"
              description="Coba ubah kata kunci atau filter status."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
