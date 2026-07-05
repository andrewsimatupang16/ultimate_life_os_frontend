import { useCallback, useEffect, useMemo, useState } from 'react';
import { goalApi, subGoalApi } from '@/api/productivity';
import type { Goal } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CheckCircle2, Circle, Target, GitBranch, Pencil, Lock } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { isBlank, parseNonNegativeNumber, parsePositiveNumber } from '@/lib/form-validation';
import type { SubGoalWithGoal } from './productivity-utils';
import { compactBadgeClass, compactCardClass, compactContentClass, compactGridClass, compactIconButtonClass, compactIconClass, compactTitleClass, flattenSubGoals } from './productivity-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

const SUB_GOAL_WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

function clampSubGoalProgress(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

function parseSubGoalWeight(value: string, label = 'Bobot') {
  const weight = Number(value);
  if (!Number.isInteger(weight) || weight < 1 || weight > 5) {
    return {
      ok: false as const,
      message: `${label} harus berupa angka bulat 1 sampai 5.`,
    };
  }

  return {
    ok: true as const,
    value: weight,
  };
}

function parseSubGoalMeasurement(targetValue: string, currentValue: string) {
  if (targetValue) {
    const target = parsePositiveNumber(targetValue, 'Target angka');
    if (!target.ok) return { ok: false as const, message: target.message };
  }

  if (currentValue) {
    const current = parseNonNegativeNumber(currentValue, 'Angka sekarang');
    if (!current.ok) return { ok: false as const, message: current.message };
  }

  if (targetValue && currentValue && Number(currentValue) > Number(targetValue)) {
    return {
      ok: false as const,
      message: 'Angka sekarang tidak boleh lebih besar dari target angka.',
    };
  }

  return {
    ok: true as const,
    targetValue: targetValue ? Number(targetValue) : undefined,
    currentValue: currentValue ? Number(currentValue) : 0,
    usesManualTarget: Boolean(targetValue),
  };
}

function formatSubGoalNumber(value: number) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value);
}

function buildGoalWeightTotals(goals: Goal[]) {
  return new Map(
    goals.map((goal) => {
      const totalWeight = (goal.sub_goals || [])
        .filter((subGoal) => !subGoal.deleted_at)
        .reduce((sum, subGoal) => sum + Math.min(5, Math.max(1, subGoal.weight || 1)), 0);

      return [goal.id, totalWeight] as const;
    })
  );
}

function getWeightedContribution(subGoal: SubGoalWithGoal, totalWeight: number) {
  const weight = Math.min(5, Math.max(1, subGoal.weight || 1));
  if (totalWeight <= 0) return 0;

  return (clampSubGoalProgress(subGoal.progress_rate) * weight) / totalWeight;
}

function getProgressPreview(targetValue: string, currentValue: string) {
  const target = Number(targetValue || 0);
  const current = Number(currentValue || 0);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(current) || current < 0) return null;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function getWeightContributionPreview(progress: number | null, weightValue: string, totalWeight: number) {
  const weight = Number(weightValue || 1);
  if (progress === null || !Number.isFinite(weight) || weight < 1 || totalWeight <= 0) return null;
  return (progress * weight) / totalWeight;
}

export default function SubGoalsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSubGoalTitle, setNewSubGoalTitle] = useState('');
  const [newSubGoalGoalId, setNewSubGoalGoalId] = useState('');
  const [newSubGoalWeight, setNewSubGoalWeight] = useState('1');
  const [newSubGoalTarget, setNewSubGoalTarget] = useState('');
  const [newSubGoalCurrent, setNewSubGoalCurrent] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubGoal, setEditingSubGoal] = useState<SubGoalWithGoal | null>(null);
  const [editSubGoalTitle, setEditSubGoalTitle] = useState('');
  const [editSubGoalWeight, setEditSubGoalWeight] = useState('1');
  const [editSubGoalTarget, setEditSubGoalTarget] = useState('');
  const [editSubGoalCurrent, setEditSubGoalCurrent] = useState('');
  const [subGoalSearch, setSubGoalSearch] = useState('');

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await goalApi.getAll();
      setGoals(data);
      const firstOpenGoal = data.find((goal) => !goal.is_completed);
      setNewSubGoalGoalId((currentGoalId) => {
        if (currentGoalId && data.some((goal) => goal.id === currentGoalId && !goal.is_completed)) {
          return currentGoalId;
        }
        return firstOpenGoal?.id || '';
      });
    } catch (error) {
      console.error(error);
      setGoals([]);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data target dan target turunan.'));
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

  const subGoals = useMemo(() => flattenSubGoals(goals), [goals]);
  const openGoals = useMemo(() => goals.filter((goal) => !goal.is_completed), [goals]);
  const goalWeightTotals = useMemo(() => buildGoalWeightTotals(goals), [goals]);
  const filteredSubGoals = useMemo(() => {
    const normalizedSearch = subGoalSearch.trim().toLowerCase();
    return subGoals.filter((subGoal) => !normalizedSearch
      || subGoal.title.toLowerCase().includes(normalizedSearch)
      || subGoal.goal_title.toLowerCase().includes(normalizedSearch));
  }, [subGoalSearch, subGoals]);
  const selectedParent = goals.find((goal) => goal.id === newSubGoalGoalId);
  const selectedParentCurrentWeight = goalWeightTotals.get(newSubGoalGoalId) || 0;
  const newWeightNumber = Math.min(5, Math.max(1, Number(newSubGoalWeight || 1) || 1));
  const newTotalWeightPreview = selectedParentCurrentWeight + newWeightNumber;
  const newProgressPreview = getProgressPreview(newSubGoalTarget, newSubGoalCurrent);
  const newContributionPreview = getWeightContributionPreview(newProgressPreview, newSubGoalWeight, newTotalWeightPreview);
  const editingParentTotalWeight = editingSubGoal ? goalWeightTotals.get(editingSubGoal.goal_id) || 0 : 0;
  const editWeightNumber = Math.min(5, Math.max(1, Number(editSubGoalWeight || 1) || 1));
  const editTotalWeightPreview = editingSubGoal
    ? Math.max(1, editingParentTotalWeight - Math.min(5, Math.max(1, editingSubGoal.weight || 1)) + editWeightNumber)
    : editWeightNumber;
  const editProgressPreview = getProgressPreview(editSubGoalTarget, editSubGoalCurrent);
  const editContributionPreview = getWeightContributionPreview(editProgressPreview, editSubGoalWeight, editTotalWeightPreview);

  const createSubGoal = async () => {
    if (isBlank(newSubGoalTitle)) {
      toast({ title: 'Judul target turunan wajib diisi', variant: 'destructive' });
      return;
    }
    if (!newSubGoalGoalId) {
      toast({ title: 'Target induk wajib dipilih', variant: 'destructive' });
      return;
    }
    const parsedWeight = parseSubGoalWeight(newSubGoalWeight);
    if (!parsedWeight.ok) {
      toast({ title: parsedWeight.message, variant: 'destructive' });
      return;
    }
    const parsedMeasurement = parseSubGoalMeasurement(newSubGoalTarget, newSubGoalCurrent);
    if (!parsedMeasurement.ok) {
      toast({ title: parsedMeasurement.message, variant: 'destructive' });
      return;
    }
    try {
      await subGoalApi.create({
        goal_id: newSubGoalGoalId,
        title: newSubGoalTitle,
        weight: parsedWeight.value,
        target_value: parsedMeasurement.targetValue,
        current_value: parsedMeasurement.currentValue,
        progress_mode: parsedMeasurement.usesManualTarget ? 'manual' : 'task_completion',
      });
      setNewSubGoalTitle('');
      setNewSubGoalWeight('1');
      setNewSubGoalTarget('');
      setNewSubGoalCurrent('');
      setDialogOpen(false);
      loadGoals();
      toast({ title: 'Target turunan berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat target turunan'), variant: 'destructive' });
    }
  };

  const completeSubGoal = async (id: string) => {
    try {
      const result = await subGoalApi.complete(id);
      toast({ title: result.message });
      loadGoals();
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menyelesaikan target turunan'), variant: 'destructive' });
    }
  };

  const deleteSubGoal = async (id: string) => {
    try {
      await subGoalApi.delete(id);
      loadGoals();
      toast({ title: 'Target turunan berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus target turunan'), variant: 'destructive' });
    }
  };

  const openEditSubGoal = (subGoal: SubGoalWithGoal) => {
    setEditingSubGoal(subGoal);
    setEditSubGoalTitle(subGoal.title);
    setEditSubGoalWeight(String(subGoal.weight || 1));
    setEditSubGoalTarget(subGoal.target_value ? String(subGoal.target_value) : '');
    setEditSubGoalCurrent(String(subGoal.current_value || 0));
    setEditDialogOpen(true);
  };

  const updateSubGoal = async () => {
    if (!editingSubGoal) return;
    if (isBlank(editSubGoalTitle)) {
      toast({ title: 'Judul target turunan wajib diisi', variant: 'destructive' });
      return;
    }
    const parsedWeight = parseSubGoalWeight(editSubGoalWeight);
    if (!parsedWeight.ok) {
      toast({ title: parsedWeight.message, variant: 'destructive' });
      return;
    }
    const parsedMeasurement = parseSubGoalMeasurement(editSubGoalTarget, editSubGoalCurrent);
    if (!parsedMeasurement.ok) {
      toast({ title: parsedMeasurement.message, variant: 'destructive' });
      return;
    }
    try {
      await subGoalApi.update(editingSubGoal.id, {
        title: editSubGoalTitle,
        weight: parsedWeight.value,
        target_value: parsedMeasurement.targetValue ?? null,
        current_value: parsedMeasurement.currentValue,
        progress_mode: parsedMeasurement.usesManualTarget ? 'manual' : 'task_completion',
      });
      setEditDialogOpen(false);
      setEditingSubGoal(null);
      loadGoals();
      toast({ title: 'Target turunan berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui target turunan'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState label="Memuat target turunan..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Target turunan belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadGoals()}
      />
    );
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Target Turunan</h3>
          <p className="text-sm text-slate-500">Hubungkan target kecil ke target utama.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={openGoals.length === 0}>
              <Plus className="w-4 h-4 mr-1" /> Tambah Target Turunan
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Buat Target Turunan</DialogTitle>
            </DialogHeader>
            <form onSubmit={(event) => { event.preventDefault(); void createSubGoal(); }} className="space-y-4">
              <div>
                <Label>Target induk</Label>
                <Select value={newSubGoalGoalId} onValueChange={setNewSubGoalGoalId}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue placeholder="Pilih target" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {openGoals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Target turunan akan menyumbang progres ke target induk yang dipilih.
                </p>
              </div>
              <div>
                <Label>Judul</Label>
                <Input
                  value={newSubGoalTitle}
                  onChange={(e) => setNewSubGoalTitle(e.target.value)}
                  placeholder="e.g., Selesaikan modul dasar"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Bobot (1-5)</Label>
                <Select value={newSubGoalWeight} onValueChange={setNewSubGoalWeight}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {SUB_GOAL_WEIGHT_OPTIONS.map((weight) => (
                      <SelectItem key={weight} value={String(weight)}>{weight}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  Bobot menentukan pengaruh ke target induk. Bobot 5 berarti 5x lebih berpengaruh daripada bobot 1.
                </p>
                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-800">
                  Contoh: jika total bobot target induk 10 dan target turunan ini berbobot 3, maka target turunan ini memegang 30% pengaruh terhadap progres target induk.
                </div>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Target jumlah</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={newSubGoalTarget}
                        onChange={(e) => setNewSubGoalTarget(e.target.value)}
                        placeholder="100"
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                    <div>
                      <Label>Progres saat ini</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={newSubGoalCurrent}
                        onChange={(e) => setNewSubGoalCurrent(e.target.value)}
                        placeholder="0"
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-xs leading-5 text-slate-600">
                    <p className="font-semibold text-slate-800">Preview perhitungan</p>
                    {newProgressPreview !== null ? (
                      <p className="mt-1">
                        Progres target turunan: {newSubGoalCurrent || 0} / {newSubGoalTarget} = <span className="font-semibold text-blue-600">{newProgressPreview.toFixed(0)}%</span>.
                        {selectedParent && newContributionPreview !== null && (
                          <> Kontribusi ke "{selectedParent.title}": {newProgressPreview.toFixed(0)}% × bobot {newSubGoalWeight} / total bobot {newTotalWeightPreview} = <span className="font-semibold text-blue-600">{newContributionPreview.toFixed(1)} poin</span>.</>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1">
                        Jika target jumlah kosong, progres bisa mengikuti tugas yang terhubung ke target turunan ini.
                      </p>
                    )}
                  </div>
                </div>
              </details>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Target Turunan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Edit Target Turunan</DialogTitle>
            </DialogHeader>
            <form onSubmit={(event) => { event.preventDefault(); void updateSubGoal(); }} className="space-y-4">
              <div>
                <Label>Judul</Label>
                <Input
                  value={editSubGoalTitle}
                  onChange={(e) => setEditSubGoalTitle(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Bobot (1-5)</Label>
                <Select value={editSubGoalWeight} onValueChange={setEditSubGoalWeight}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {SUB_GOAL_WEIGHT_OPTIONS.map((weight) => (
                      <SelectItem key={weight} value={String(weight)}>{weight}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  Bobot menentukan pengaruh ke target induk. Bobot 5 berarti 5x lebih berpengaruh daripada bobot 1.
                </p>
                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-800">
                  Ubah bobot jika target turunan ini lebih penting atau kurang penting dibanding target turunan lain di target induk yang sama.
                </div>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Target jumlah</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={editSubGoalTarget}
                        onChange={(e) => setEditSubGoalTarget(e.target.value)}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                    <div>
                      <Label>Progres saat ini</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={editSubGoalCurrent}
                        onChange={(e) => setEditSubGoalCurrent(e.target.value)}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-xs leading-5 text-slate-600">
                    <p className="font-semibold text-slate-800">Preview perhitungan</p>
                    {editProgressPreview !== null ? (
                      <p className="mt-1">
                        Progres target turunan: {editSubGoalCurrent || 0} / {editSubGoalTarget} = <span className="font-semibold text-blue-600">{editProgressPreview.toFixed(0)}%</span>.
                        {editingSubGoal && editContributionPreview !== null && (
                          <> Kontribusi ke "{editingSubGoal.goal_title}": {editProgressPreview.toFixed(0)}% × bobot {editSubGoalWeight} / total bobot {editTotalWeightPreview} = <span className="font-semibold text-blue-600">{editContributionPreview.toFixed(1)} poin</span>.</>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1">Jika target jumlah kosong, progres mengikuti jumlah tugas yang selesai.</p>
                    )}
                  </div>
                </div>
              </details>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Simpan Target Turunan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        value={subGoalSearch}
        onChange={(event) => setSubGoalSearch(event.target.value)}
        placeholder="Cari target turunan atau target induk..."
      />

      <div className={compactGridClass}>
        {filteredSubGoals.map((subGoal) => {
          const parentTotalWeight = goalWeightTotals.get(subGoal.goal_id) || 0;
          const weightedContribution = getWeightedContribution(subGoal, parentTotalWeight);
          return (
          <Card key={subGoal.id} className={compactCardClass}>
            <CardContent className={compactContentClass}>
              <div className="flex h-full min-w-0 flex-col gap-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <button className="mt-0.5 shrink-0" onClick={() => completeSubGoal(subGoal.id)} disabled={subGoal.is_completed || subGoal.is_locked}>
                      {subGoal.is_locked ? (
                        <Lock className={compactIconClass + " text-slate-500"} />
                      ) : subGoal.is_completed ? (
                        <CheckCircle2 className={compactIconClass + " text-emerald-600"} />
                      ) : (
                        <Circle className={compactIconClass + " text-slate-500 hover:text-blue-600"} />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`${compactTitleClass} ${subGoal.is_completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {subGoal.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <Badge variant="outline" className={`${compactBadgeClass} max-w-full border-blue-200 text-blue-600`}>
                          <GitBranch className="w-3 h-3 mr-1 shrink-0" /> <span className="truncate">{subGoal.goal_title}</span>
                        </Badge>
                        <Badge variant="outline" className={compactBadgeClass}>Bobot {subGoal.weight || 1}</Badge>
                        <span>{subGoal.tasks?.length || 0} tugas terkait</span>
                        {parentTotalWeight > 0 && (
                          <span>
                            kontribusi {formatSubGoalNumber(weightedContribution)} poin ke progres target
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditSubGoal(subGoal)}
                      disabled={subGoal.is_locked || subGoal.is_completed}
                      className={compactIconButtonClass}
                      title={subGoal.is_completed ? 'Target turunan selesai terkunci' : subGoal.is_locked ? 'Target turunan terkunci karena target induk selesai' : 'Edit target turunan'}
                    >
                      <Pencil className={compactIconClass} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm({
                        title: 'Hapus target turunan?',
                        description: 'Tugas yang terhubung dengan target turunan ini juga akan ikut terhapus. Target turunan yang sudah selesai akan terkunci dan tidak bisa dihapus.',
                        onConfirm: () => deleteSubGoal(subGoal.id),
                      })}
                      disabled={subGoal.is_locked || subGoal.is_completed}
                      className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                      title={subGoal.is_completed ? 'Target turunan selesai terkunci' : subGoal.is_locked ? 'Target turunan terkunci karena target induk selesai' : 'Hapus target turunan'}
                    >
                      <Trash2 className={compactIconClass} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    {subGoal.target_value ? (
                      <span>
                        {formatSubGoalNumber(subGoal.current_value || 0)} / {formatSubGoalNumber(subGoal.target_value)}
                      </span>
                    ) : (
                      <span>Progres dari tugas: {formatSubGoalNumber(clampSubGoalProgress(subGoal.progress_rate))}%</span>
                    )}
                    {subGoal.is_completed && (
                      <span className="text-emerald-600">
                        +{subGoal.xp_rewarded} XP, +{subGoal.coin_rewarded} koin
                      </span>
                    )}
                  </div>
                  <Progress value={clampSubGoalProgress(subGoal.progress_rate)} className="h-1.5 bg-white/70" />
                  {parentTotalWeight > 0 && (
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Formula kontribusi: {formatSubGoalNumber(clampSubGoalProgress(subGoal.progress_rate))}% × {subGoal.weight || 1} / {parentTotalWeight} = {formatSubGoalNumber(weightedContribution)} poin.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
        {goals.length === 0 && (
          <EmptyState
            icon={Target}
            title="Belum ada target induk"
            description="Buat target terlebih dahulu, lalu tambahkan target turunan di bawahnya."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
        {goals.length > 0 && subGoals.length === 0 && (
          <EmptyState
            icon={GitBranch}
            title="Belum ada target turunan"
            description="Tambahkan target turunan dan hubungkan ke target utama."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
        {subGoals.length > 0 && filteredSubGoals.length === 0 && (
          <EmptyState
            icon={GitBranch}
            title="Target turunan tidak ditemukan"
            description="Coba ubah kata kunci pencarian."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
      </div>
    </div>
    {confirmDialog}
    </>
  );
}
