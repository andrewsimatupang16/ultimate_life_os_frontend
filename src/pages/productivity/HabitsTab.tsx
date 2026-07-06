import { useCallback, useEffect, useMemo, useState } from 'react';
import { habitApi } from '@/api/productivity';
import type { Habit, HabitHistoryItem, HabitLogResponse } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, TrendingUp, TrendingDown, Zap, Pencil, CalendarDays } from 'lucide-react';
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

const getMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const parseMonthKey = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return { year, monthIndex };
};

const getDateKeyFromParts = (year: number, monthIndex: number, day: number) => {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey: string) => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return new Date(year, monthIndex, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const getCalendarDays = (monthKey: string) => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    return {
      day,
      dateKey: getDateKeyFromParts(year, monthIndex, day),
    };
  });
};

const shiftMonthKey = (monthKey: string, monthOffset: number) => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return getMonthKey(new Date(year, monthIndex + monthOffset, 1));
};

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

  if (previewPenalty > 0) {
    return `Penalti berikutnya: -${previewPenalty} koin`;
  }

  return 'Penalti otomatis';
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
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [newHabitType, setNewHabitType] = useState<'good' | 'bad'>('good');
  const [newHabitReminderTime, setNewHabitReminderTime] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editHabitTitle, setEditHabitTitle] = useState('');
  const [editHabitDescription, setEditHabitDescription] = useState('');
  const [editHabitType, setEditHabitType] = useState<'good' | 'bad'>('good');
  const [editHabitReminderTime, setEditHabitReminderTime] = useState('');
  const [habitSearch, setHabitSearch] = useState('');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [habitCalendarOpen, setHabitCalendarOpen] = useState(false);
  const [habitHistoryById, setHabitHistoryById] = useState<Record<string, HabitHistoryItem[]>>({});
  const [historyLoadingHabitId, setHistoryLoadingHabitId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthKey(new Date()));
  const [loggingHabitDateKey, setLoggingHabitDateKey] = useState<string | null>(null);

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

  const loadHabitHistory = useCallback(async (habitId: string) => {
    setHistoryLoadingHabitId(habitId);
    try {
      const history = await habitApi.history(habitId);
      setHabitHistoryById((current) => ({ ...current, [habitId]: history }));
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memuat riwayat kebiasaan'), variant: 'destructive' });
    } finally {
      setHistoryLoadingHabitId(null);
    }
  }, [toast]);


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
        description: newHabitDescription.trim() || null,
        habit_type: newHabitType,
        reminder_time: newHabitReminderTime || null,
      });
      setNewHabitTitle('');
      setNewHabitDescription('');
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
    setEditHabitDescription(habit.description ?? '');
    setEditHabitType(habit.habit_type);
    setEditHabitReminderTime(habit.reminder_time ?? '');
    setEditDialogOpen(true);
  };

  const closeEditHabitDialog = () => {
    setEditDialogOpen(false);
    setEditingHabit(null);
    setEditHabitTitle('');
    setEditHabitDescription('');
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
        description: editHabitDescription.trim() || null,
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


  const openHabitCalendar = async (habit: Habit) => {
    setSelectedHabit(habit);
    setCalendarMonth(getMonthKey(new Date()));
    setHabitCalendarOpen(true);
    await loadHabitHistory(habit.id);
  };

  const closeHabitCalendar = () => {
    setHabitCalendarOpen(false);
    setSelectedHabit(null);
    setLoggingHabitDateKey(null);
  };

  const toggleHabitDate = async (dateKey: string) => {
    if (!selectedHabit) return;

    if (dateKey > getTodayDateKey()) {
      toast({ title: 'Tanggal masa depan belum bisa dicatat.', variant: 'destructive' });
      return;
    }

    if (loggingHabitDateKey) return;

    const history = habitHistoryById[selectedHabit.id] ?? [];
    const alreadyFilled = history.some((item) => item.local_date === dateKey);

    setLoggingHabitDateKey(dateKey);
    try {
      const result = alreadyFilled
        ? await habitApi.unlogDate(selectedHabit.id, dateKey)
        : await habitApi.logDate(selectedHabit.id, dateKey);

      if (!result.success) {
        toast({
          title: result.message || (alreadyFilled ? 'Gagal menghapus isian habit.' : 'Kebiasaan sudah dicatat pada tanggal ini.'),
          variant: 'destructive',
        });
        await loadHabitHistory(selectedHabit.id);
        return;
      }

      await Promise.all([loadHabits(), refreshUser(), loadHabitHistory(selectedHabit.id)]);
      toast({ title: alreadyFilled ? 'Isian habit dihapus.' : getHabitLogMessage(selectedHabit, result) });
    } catch (error) {
      toast({
        title: getApiErrorMessage(error, alreadyFilled ? 'Gagal menghapus isian habit' : 'Gagal mencatat kebiasaan'),
        variant: 'destructive',
      });
    } finally {
      setLoggingHabitDateKey(null);
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
    return habits.filter((habit) => {
      const description = habit.description?.toLowerCase() ?? '';
      return habit.title.toLowerCase().includes(keyword) || description.includes(keyword);
    });
  }, [habitSearch, habits]);

  const allGoodHabits = useMemo(() => habits.filter(h => h.habit_type === 'good'), [habits]);
  const allBadHabits = useMemo(() => habits.filter(h => h.habit_type === 'bad'), [habits]);
  const goodHabits = useMemo(() => filteredHabits.filter(h => h.habit_type === 'good'), [filteredHabits]);
  const badHabits = useMemo(() => filteredHabits.filter(h => h.habit_type === 'bad'), [filteredHabits]);
  const selectedHabitHistory = useMemo(() => {
    if (!selectedHabit) return [];
    return habitHistoryById[selectedHabit.id] ?? [];
  }, [habitHistoryById, selectedHabit]);
  const selectedHabitLoggedDates = useMemo(() => {
    return new Set(selectedHabitHistory.map((item) => item.local_date));
  }, [selectedHabitHistory]);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

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
                <Label>Deskripsi (opsional)</Label>
                <Textarea
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                  placeholder="Contoh: 15 menit jalan kaki sebelum kerja"
                  rows={3}
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

            return (
            <Card
              id={dashboardTargetId(habit.id)}
              key={habit.id}
              role="button"
              tabIndex={0}
              onClick={() => void openHabitCalendar(habit)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void openHabitCalendar(habit);
                }
              }}
              className={`${compactCardClass} ${highlightClassName(habit.id)} cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg`}
            >
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <h4 className={`${compactTitleClass} line-clamp-1 text-slate-800`}>{habit.title}</h4>
                      {habit.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{habit.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-amber-400" /> {habit.current_streak} hari
                        </span>
                        <span>Terbaik {habit.best_streak}</span>
                        {habit.reminder_time && <span>{habit.reminder_time}</span>}
                        {loggedToday && <span className="font-medium text-emerald-600">Hari ini terisi</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditHabitDialog(habit);
                      }}
                      aria-label={`Edit kebiasaan ${habit.title}`}
                      className={`${compactIconButtonClass} text-slate-500 hover:text-blue-600`}
                    >
                      <Pencil className={compactIconClass} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        confirm({
                          title: 'Hapus kebiasaan?',
                          description: 'Kebiasaan ini akan dihapus dari pelacakan harian.',
                          onConfirm: () => deleteHabit(habit.id),
                        });
                      }}
                      className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                    >
                      <Trash2 className={compactIconClass} />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{habit.total_completions}x</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">+{habit.xp_rewarded} XP</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">+{habit.coin_rewarded} koin</span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
                  <CalendarDays className="h-3 w-3" /> Klik kartu untuk buka kalender
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

            return (
            <Card
              id={dashboardTargetId(habit.id)}
              key={habit.id}
              role="button"
              tabIndex={0}
              onClick={() => void openHabitCalendar(habit)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void openHabitCalendar(habit);
                }
              }}
              className={`${compactCardClass} ${highlightClassName(habit.id)} cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg`}
            >
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <h4 className={`${compactTitleClass} line-clamp-1 text-slate-800`}>{habit.title}</h4>
                      {habit.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{habit.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{habit.total_completions}x dicatat</span>
                        {habit.reminder_time && <span>{habit.reminder_time}</span>}
                        {loggedToday && <span className="font-medium text-red-600">Hari ini terisi</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditHabitDialog(habit);
                      }}
                      aria-label={`Edit kebiasaan ${habit.title}`}
                      className={`${compactIconButtonClass} text-slate-500 hover:text-blue-600`}
                    >
                      <Pencil className={compactIconClass} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        confirm({
                          title: 'Hapus kebiasaan?',
                          description: 'Kebiasaan ini akan dihapus dari pelacakan harian.',
                          onConfirm: () => deleteHabit(habit.id),
                        });
                      }}
                      className={`${compactIconButtonClass} text-red-600 hover:text-red-700`}
                    >
                      <Trash2 className={compactIconClass} />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{habit.total_completions}x dicatat</span>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">{getBadHabitPenaltySummary(habit)}</span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
                  <CalendarDays className="h-3 w-3" /> Klik kartu untuk buka kalender
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
      open={habitCalendarOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeHabitCalendar();
          return;
        }
        setHabitCalendarOpen(true);
      }}
    >
      <DialogContent className="max-w-2xl border-slate-200 bg-[#F8FAFC] text-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Kalender Habit
          </DialogTitle>
        </DialogHeader>

        {selectedHabit && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Habit dipilih</p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-800">{selectedHabit.title}</h4>
                  {selectedHabit.description && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{selectedHabit.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Klik tanggal untuk isi. Klik lagi untuk hapus.
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedHabit.habit_type === 'good' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {selectedHabit.habit_type === 'good' ? 'Kebiasaan baik' : 'Kebiasaan buruk'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth((current) => shiftMonthKey(current, -1))}
              >
                Bulan sebelumnya
              </Button>
              <div className="text-center">
                <p className="text-sm font-semibold capitalize text-slate-800">{getMonthLabel(calendarMonth)}</p>
                <p className="text-xs text-slate-500">
                  {selectedHabitHistory.filter((item) => item.local_date.startsWith(calendarMonth)).length} dari {calendarDays.length} hari terisi
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCalendarMonth((current) => shiftMonthKey(current, 1))}
                disabled={calendarMonth >= getMonthKey(new Date())}
              >
                Bulan berikutnya
              </Button>
            </div>

            {historyLoadingHabitId === selectedHabit.id ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
                Memuat riwayat habit...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const filled = selectedHabitLoggedDates.has(day.dateKey);
                  const futureDate = day.dateKey > getTodayDateKey();
                  const isLoggingDate = loggingHabitDateKey === day.dateKey;
                  const filledClass = selectedHabit.habit_type === 'good'
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                    : 'border-red-500 bg-red-500 text-white shadow-sm';

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => void toggleHabitDate(day.dateKey)}
                      disabled={futureDate || Boolean(loggingHabitDateKey)}
                      title={
                        filled
                          ? 'Klik untuk hapus isian'
                          : futureDate
                            ? 'Tanggal masa depan belum bisa diisi'
                            : `Isi tanggal ${day.day}`
                      }
                      className={`h-10 rounded-xl border text-sm font-semibold transition ${
                        filled
                          ? filledClass
                          : futureDate
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
                      } ${isLoggingDate ? 'animate-pulse' : ''}`}
                    >
                      {day.day}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" /> Belum diisi</span>
              <span className="inline-flex items-center gap-1"><span className={`h-3 w-3 rounded ${selectedHabit.habit_type === 'good' ? 'bg-emerald-500' : 'bg-red-500'}`} /> Sudah diisi, klik lagi untuk hapus</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-200" /> Masa depan dikunci</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

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
            <Label>Deskripsi (opsional)</Label>
            <Textarea
              value={editHabitDescription}
              onChange={(e) => setEditHabitDescription(e.target.value)}
              placeholder="Catatan singkat tentang habit ini"
              rows={3}
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
