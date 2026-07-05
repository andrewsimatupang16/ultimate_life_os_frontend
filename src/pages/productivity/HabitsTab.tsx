import { useCallback, useEffect, useMemo, useState } from 'react';
import { habitApi } from '@/api/productivity';
import type { Habit, HabitLogResponse } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CheckCircle2, TrendingUp, TrendingDown, Zap, Pencil } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { isBlank } from '@/lib/form-validation';
import { compactCardClass, compactContentClass, compactGridClass, compactIconButtonClass, compactIconClass, compactTitleClass } from './productivity-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useAuth } from '@/context/useAuth';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';

const getLocalDateKey = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-CA');
};

const getTodayDateKey = () => new Date().toLocaleDateString('en-CA');

const isHabitLoggedToday = (habit: Habit) => {
  if (habit.logged_today) return true;
  return getLocalDateKey(habit.last_logged_at) === getTodayDateKey();
};

const getHabitLogMessage = (habit: Habit, result: HabitLogResponse) => {
  if (habit.habit_type === 'good') {
    return `${result.message} +${result.xp_earned} XP, +${result.coins_earned} koin.`;
  }

  if (result.penalty > 0) {
    return `${result.message} Penalti: -${result.penalty} koin.`;
  }

  return result.message;
};

const getBadHabitPenaltySummary = (habit: Habit) => {
  const previewPenalty = Number(habit.bad_habit_penalty_preview ?? 0);
  const basePenalty = Number(habit.bad_habit_base_penalty ?? 0);
  const multiplier = Number(habit.bad_habit_penalty_multiplier ?? 1);
  const threshold = Number(habit.bad_habit_penalty_threshold ?? 0);
  const windowDays = Number(habit.bad_habit_penalty_window_days ?? 0);
  const recentCount = Number(habit.bad_habit_recent_penalty_count ?? 0);

  if (previewPenalty <= 0 || threshold <= 0 || windowDays <= 0) {
    return 'Penalti akan dihitung otomatis saat dicatat.';
  }

  if (habit.bad_habit_penalty_multiplier_active) {
    return `Penalti berikutnya: -${previewPenalty} koin (${multiplier}x aktif; ${recentCount} pelanggaran dalam ${windowDays} hari terakhir).`;
  }

  return `Penalti berikutnya: -${previewPenalty} koin. Penalti dasar: -${basePenalty} koin. Pengali ${multiplier}x aktif mulai ${threshold} pelanggaran dalam ${windowDays} hari terakhir.`;
};

export default function HabitsTab() {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState<'good' | 'bad'>('good');
  const [newHabitReminderTime, setNewHabitReminderTime] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [editHabitType, setEditHabitType] = useState<'good' | 'bad'>('good');
  const [editHabitReminderTime, setEditHabitReminderTime] = useState('');
  const [habitSearch, setHabitSearch] = useState('');
  const [loggingHabitId, setLoggingHabitId] = useState<string | null>(null);

  const loadHabits = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await habitApi.getAll();
      setHabits(data);
    } catch (error) {
      console.error(error);
      setHabits([]);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data kebiasaan.'));
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadHabits();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadHabits]);

  const createHabit = async () => {
    if (isBlank(newHabitTitle)) {
      toast({ title: 'Judul kebiasaan wajib diisi', variant: 'destructive' });
      return;
    }
    try {
      await habitApi.create({
        title: newHabitTitle.trim(),
        habit_type: newHabitType,
        reminder_time: newHabitReminderTime || null,
      });
      setNewHabitTitle('');
      setNewHabitReminderTime('');
      setDialogOpen(false);
      await loadHabits();
      toast({ title: 'Kebiasaan berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat kebiasaan'), variant: 'destructive' });
    }
  };

  const openEditHabitDialog = (habit: Habit) => {
    setEditingHabit(habit);
    setEditHabitTitle(habit.title);
    setEditHabitType(habit.habit_type);
    setEditHabitReminderTime(habit.reminder_time ?? '');
    setEditDialogOpen(true);
  };

  const closeEditHabitDialog = () => {
    setEditDialogOpen(false);
    setEditingHabit(null);
    setEditHabitTitle('');
    setEditHabitType('good');
    setEditHabitReminderTime('');
  };

  const updateHabit = async () => {
    if (!editingHabit) return;

    if (isBlank(editHabitTitle)) {
      toast({ title: 'Judul kebiasaan wajib diisi', variant: 'destructive' });
      return;
    }

    try {
      await habitApi.update(editingHabit.id, {
        title: editHabitTitle.trim(),
        habit_type: editHabitType,
        reminder_time: editHabitReminderTime || null,
      });
      closeEditHabitDialog();
      await loadHabits();
      toast({ title: 'Kebiasaan berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui kebiasaan'), variant: 'destructive' });
    }
  };

  const logHabit = async (habit: Habit) => {
    if (isHabitLoggedToday(habit)) {
      toast({ title: 'Kebiasaan sudah dicatat hari ini.' });
      return;
    }

    if (loggingHabitId === habit.id) return;

    setLoggingHabitId(habit.id);
    try {
      const result: HabitLogResponse = await habitApi.log(habit.id);

      if (!result.success) {
        toast({ title: result.message || 'Kebiasaan sudah dicatat hari ini.', variant: 'destructive' });
        await loadHabits();
        return;
      }

      await Promise.all([loadHabits(), refreshUser()]);
      toast({ title: getHabitLogMessage(habit, result) });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal mencatat kebiasaan'), variant: 'destructive' });
    } finally {
      setLoggingHabitId(null);
    }
  };

  const deleteHabit = async (id: string) => {
    try {
      await habitApi.delete(id);
      await loadHabits();
      toast({ title: 'Kebiasaan berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus kebiasaan'), variant: 'destructive' });
    }
  };

  const filteredHabits = useMemo(() => {
    const keyword = habitSearch.trim().toLowerCase();
    if (!keyword) return habits;
    return habits.filter((habit) => habit.title.toLowerCase().includes(keyword));
  }, [habitSearch, habits]);

  const allGoodHabits = useMemo(() => habits.filter(h => h.habit_type === 'good'), [habits]);
  const allBadHabits = useMemo(() => habits.filter(h => h.habit_type === 'bad'), [habits]);
  const goodHabits = useMemo(() => filteredHabits.filter(h => h.habit_type === 'good'), [filteredHabits]);
  const badHabits = useMemo(() => filteredHabits.filter(h => h.habit_type === 'bad'), [filteredHabits]);

  if (loading) return <LoadingState label="Memuat kebiasaan..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Kebiasaan belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadHabits()}
      />
    );
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Daftar Kebiasaan</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Tambah Kebiasaan
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Buat Kebiasaan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Judul</Label>
                <Input
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  placeholder="Contoh: Olahraga, Tidak makan gula"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Jenis</Label>
                <Select value={newHabitType} onValueChange={(v: 'good' | 'bad') => setNewHabitType(v)}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    <SelectItem value="good">Kebiasaan baik (+XP, +koin, bonus streak)</SelectItem>
                    <SelectItem value="bad">Kebiasaan buruk (penalti saat dicatat)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content">
                  <Label>Jam pengingat (opsional)</Label>
                  <Input
                    type="time"
                    value={newHabitReminderTime}
                    onChange={(e) => setNewHabitReminderTime(e.target.value)}
                    className="bg-white/70 border-slate-200 text-slate-800"
                  />
                </div>
              </details>
              <Button onClick={createHabit} className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Kebiasaan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        value={habitSearch}
        onChange={(event) => setHabitSearch(event.target.value)}
        placeholder="Cari kebiasaan..."
      />

      {/* Good Habits */}
      <div>
        <h4 className="text-sm font-medium text-emerald-600 mb-2 flex items-center gap-1">
          <TrendingUp className="w-4 h-4" /> Kebiasaan Baik
        </h4>
        <div className={compactGridClass}>
          {goodHabits.map((habit) => {
            const loggedToday = isHabitLoggedToday(habit);
            const isLogging = loggingHabitId === habit.id;

            return (
            <Card id={dashboardTargetId(habit.id)} key={habit.id} className={`${compactCardClass} ${highlightClassName(habit.id)}`}>
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Button
                      size="sm"
                      onClick={() => void logHabit(habit)}
                      disabled={loggedToday || isLogging}
                      aria-label={loggedToday ? 'Kebiasaan sudah dicatat hari ini' : `Catat kebiasaan ${habit.title}`}
                      title={loggedToday ? 'Sudah dicatat hari ini' : 'Catat kebiasaan hari ini'}
                      className="app-list-icon bg-emerald-600 p-0 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                      <h4 className={`${compactTitleClass} text-slate-800`}>{habit.title}</h4>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-amber-400" /> Rangkaian: {habit.current_streak} hari
                        </span>
                        <span>Terbaik: {habit.best_streak}</span>
                        {habit.reminder_time && <span>Pengingat: {habit.reminder_time}</span>}
                        {loggedToday && <span className="font-medium text-emerald-600">Sudah dicatat hari ini</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditHabitDialog(habit)}
                      aria-label={`Edit kebiasaan ${habit.title}`}
                      className={`${compactIconButtonClass} text-slate-500 hover:text-blue-600`}
                    >
                      <Pencil className={compactIconClass} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm({
                        title: 'Hapus kebiasaan?',
                        description: 'Kebiasaan ini akan dihapus dari pelacakan harian.',
                        onConfirm: () => deleteHabit(habit.id),
                      })}
                      className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                    >
                      <Trash2 className={compactIconClass} />
                    </Button>
                  </div>
                </div>
                <div className="app-list-highlight bg-emerald-50 text-emerald-600">
                  Total: {habit.total_completions}x · Didapat: {habit.xp_rewarded} XP, {habit.coin_rewarded} koin
                </div>
              </CardContent>
            </Card>
            );
          })}
          {allGoodHabits.length === 0 && (
            <EmptyState
              icon={TrendingUp}
              title="Belum ada kebiasaan baik"
              description="Tambahkan kebiasaan baik yang ingin dibangun."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
          {allGoodHabits.length > 0 && goodHabits.length === 0 && (
            <EmptyState
              icon={TrendingUp}
              title="Kebiasaan baik tidak ditemukan"
              description="Coba ubah kata kunci pencarian."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
        </div>
      </div>

      {/* Bad Habits */}
      <div>
        <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
          <TrendingDown className="w-4 h-4" /> Kebiasaan Buruk
        </h4>
        <div className={compactGridClass}>
          {badHabits.map((habit) => {
            const loggedToday = isHabitLoggedToday(habit);
            const isLogging = loggingHabitId === habit.id;

            return (
            <Card id={dashboardTargetId(habit.id)} key={habit.id} className={`${compactCardClass} ${highlightClassName(habit.id)}`}>
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Button
                      size="sm"
                      onClick={() => void logHabit(habit)}
                      disabled={loggedToday || isLogging}
                      aria-label={loggedToday ? 'Kebiasaan sudah dicatat hari ini' : `Catat pelanggaran ${habit.title}`}
                      title={loggedToday ? 'Sudah dicatat hari ini' : 'Catat pelanggaran hari ini'}
                      variant="outline"
                      className="app-list-icon border-red-500 bg-red-50 p-0 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <TrendingDown className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                      <h4 className={`${compactTitleClass} text-slate-800`}>{habit.title}</h4>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-500">
                        <span>Dicatat: {habit.total_completions}x</span>
                        {habit.reminder_time && <span>Pengingat: {habit.reminder_time}</span>}
                        {loggedToday && <span className="font-medium text-red-600">Sudah dicatat hari ini</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditHabitDialog(habit)}
                      aria-label={`Edit kebiasaan ${habit.title}`}
                      className={`${compactIconButtonClass} text-slate-500 hover:text-blue-600`}
                    >
                      <Pencil className={compactIconClass} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm({
                        title: 'Hapus kebiasaan?',
                        description: 'Kebiasaan ini akan dihapus dari pelacakan harian.',
                        onConfirm: () => deleteHabit(habit.id),
                      })}
                      className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                    >
                      <Trash2 className={compactIconClass} />
                    </Button>
                  </div>
                </div>
                <div className="app-list-highlight bg-red-50 text-red-600">
                  {getBadHabitPenaltySummary(habit)}
                </div>
              </CardContent>
            </Card>
            );
          })}
          {allBadHabits.length === 0 && (
            <EmptyState
              icon={TrendingDown}
              title="Belum ada kebiasaan buruk"
              description="Tambahkan kebiasaan buruk yang ingin dikurangi."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
          {allBadHabits.length > 0 && badHabits.length === 0 && (
            <EmptyState
              icon={TrendingDown}
              title="Kebiasaan buruk tidak ditemukan"
              description="Coba ubah kata kunci pencarian."
              className="md:col-span-2 xl:col-span-3"
            />
          )}
        </div>
      </div>
    </div>

    <Dialog
      open={editDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeEditHabitDialog();
          return;
        }
        setEditDialogOpen(true);
      }}
    >
      <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
        <DialogHeader>
          <DialogTitle>Edit Kebiasaan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Judul</Label>
            <Input
              value={editHabitTitle}
              onChange={(e) => setEditHabitTitle(e.target.value)}
              placeholder="Contoh: Olahraga, Tidak makan gula"
              className="bg-white/70 border-slate-200 text-slate-800"
            />
          </div>
          <div>
            <Label>Jenis</Label>
            <Select value={editHabitType} onValueChange={(v: 'good' | 'bad') => setEditHabitType(v)}>
              <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/70 border-slate-200">
                <SelectItem value="good">Kebiasaan baik (+XP, +koin, bonus streak)</SelectItem>
                <SelectItem value="bad">Kebiasaan buruk (penalti saat dicatat)</SelectItem>
              </SelectContent>
            </Select>
            {editingHabit?.habit_type !== editHabitType && (
              <p className="mt-1 text-xs text-amber-600">
                Mengubah jenis kebiasaan tidak menghapus riwayat, tetapi hadiah atau penalti berikutnya akan mengikuti jenis baru.
              </p>
            )}
          </div>
          <details className="quick-form-advanced">
            <summary>Detail lanjutan</summary>
            <div className="quick-form-advanced-content">
              <Label>Jam pengingat (opsional)</Label>
              <Input
                type="time"
                value={editHabitReminderTime}
                onChange={(e) => setEditHabitReminderTime(e.target.value)}
                className="bg-white/70 border-slate-200 text-slate-800"
              />
            </div>
          </details>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={closeEditHabitDialog} className="flex-1">
              Batal
            </Button>
            <Button onClick={() => void updateHabit()} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {confirmDialog}
    </>
  );
}
