import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Pencil, PlusCircle, RefreshCw, Save, Sparkles, TimerReset, Trash2, XCircle, Zap } from 'lucide-react';
import {
  microBreakApi,
  type MicroBreakDurationKey,
  type MicroBreakRewardInfo,
  type MicroBreakTask,
} from '@/api/microBreak';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error';

type MicroBreakOption = {
  key: MicroBreakDurationKey;
  label: string;
  subtitle: string;
  example: string;
};

const fallbackRewards: Record<MicroBreakDurationKey, MicroBreakRewardInfo> = {
  '5-10': { xp: 8, coins: 4 },
  '15-30': { xp: 15, coins: 8 },
  '30-60': { xp: 25, coins: 12 },
  relaxed: { xp: 12, coins: 6 },
};

const microBreakOptions: MicroBreakOption[] = [
  { key: '5-10', label: '5-10 menit', subtitle: 'Reset cepat', example: 'Minum air dan tarik napas 10 kali' },
  { key: '15-30', label: '15-30 menit', subtitle: 'Jeda produktif', example: 'Rapikan meja kerja' },
  { key: '30-60', label: '30-60 menit', subtitle: 'Recharge serius', example: 'Jalan kaki ringan' },
  { key: 'relaxed', label: 'Santai', subtitle: 'Tanpa tekanan', example: 'Tulis jurnal singkat' },
];

const emptyEditState = { title: '', hint: '' };

export default function MicroTasksTab() {
  const [selectedKey, setSelectedKey] = useState<MicroBreakDurationKey>('5-10');
  const [tasks, setTasks] = useState<MicroBreakTask[]>([]);
  const [rewards, setRewards] = useState<Record<MicroBreakDurationKey, MicroBreakRewardInfo>>(fallbackRewards);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskHint, setNewTaskHint] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editState, setEditState] = useState(emptyEditState);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('Tambahkan micro task sesuai durasi. Dashboard akan mengambil salah satu secara acak.');

  const selectedOption = useMemo(
    () => microBreakOptions.find((option) => option.key === selectedKey) ?? microBreakOptions[0],
    [selectedKey],
  );
  const selectedReward = rewards[selectedKey] ?? fallbackRewards[selectedKey];

  const loadSummary = useCallback(async () => {
    try {
      const summary = await microBreakApi.getSummary();
      setRewards({ ...fallbackRewards, ...summary.rewards });
    } catch {
      setRewards(fallbackRewards);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const taskList = await microBreakApi.getTasks(selectedKey);
      setTasks(taskList);
      setMessage(taskList.length > 0 ? `${taskList.length} micro task tersedia untuk durasi ${selectedOption.label}.` : `Belum ada micro task untuk durasi ${selectedOption.label}.`);
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, 'Micro task belum bisa dimuat.');
      setTasks([]);
      setLoadError(errorMessage);
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedKey, selectedOption.label]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setEditingTaskId(null);
    setEditState(emptyEditState);
    void loadTasks();
  }, [loadTasks]);

  const createTask = async () => {
    const title = newTaskTitle.trim();
    const hint = newTaskHint.trim();
    if (!title) {
      setMessage('Judul micro task wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const createdTask = await microBreakApi.createTask({
        title,
        hint: hint || null,
        duration_key: selectedKey,
      });
      setTasks((previous) => [createdTask, ...previous]);
      setLoadError(null);
      setNewTaskTitle('');
      setNewTaskHint('');
      setMessage('Micro task berhasil ditambahkan. Tugas ini akan muncul acak di dashboard.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Micro task belum bisa ditambahkan.'));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (task: MicroBreakTask) => {
    setEditingTaskId(task.id);
    setEditState({ title: task.title, hint: task.hint ?? '' });
    setMessage('Edit micro task, lalu simpan perubahan.');
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditState(emptyEditState);
    setMessage('Perubahan dibatalkan.');
  };

  const saveEdit = async (task: MicroBreakTask) => {
    const title = editState.title.trim();
    const hint = editState.hint.trim();
    if (!title) {
      setMessage('Judul micro task wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedTask = await microBreakApi.updateTask(task.id, {
        title,
        hint: hint || null,
        duration_key: task.duration_key,
      });
      setTasks((previous) => previous.map((item) => (item.id === task.id ? updatedTask : item)));
      setEditingTaskId(null);
      setEditState(emptyEditState);
      setMessage('Micro task berhasil diperbarui.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Micro task belum bisa diperbarui.'));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTask = async (task: MicroBreakTask) => {
    setIsSaving(true);
    try {
      await microBreakApi.deleteTask(task.id);
      setTasks((previous) => previous.filter((item) => item.id !== task.id));
      if (editingTaskId === task.id) {
        setEditingTaskId(null);
        setEditState(emptyEditState);
      }
      setMessage('Micro task dihapus dari daftar. Riwayat reward yang sudah terjadi tetap aman.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Micro task belum bisa dihapus.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="micro-break-card" aria-label="Kelola micro task">
      <div className="micro-break-glow" />
      <div className="relative grid gap-4 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
        <div className="micro-break-panel">
          <p className="micro-break-eyebrow">
            <TimerReset className="h-3.5 w-3.5" />
            Kelola Micro Task
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900 dark:text-slate-50">Input tugas kecil untuk jeda produktif</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
            Daftar yang dibuat di sini akan dipakai oleh widget Micro Break di dashboard. Saat user menekan Selesai, XP dan koin tetap masuk ke sistem gamification utama.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {microBreakOptions.map((option) => {
              const optionReward = rewards[option.key] ?? fallbackRewards[option.key];
              const active = option.key === selectedKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedKey(option.key)}
                  className={`micro-break-duration ${active ? 'micro-break-duration-active' : ''}`}
                >
                  <span className="block text-sm font-extrabold">{option.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] font-semibold opacity-75">{option.subtitle}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-black">
                    <Zap className="h-3 w-3" /> +{optionReward.xp} XP
                    <Coins className="ml-1 h-3 w-3" /> +{optionReward.coins}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/45 p-3 dark:bg-slate-950/20">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Tambah untuk {selectedOption.label}</p>
            <div className="mt-3 grid gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder={`Contoh: ${selectedOption.example}`}
                className="micro-break-input"
                maxLength={180}
              />
              <input
                type="text"
                value={newTaskHint}
                onChange={(event) => setNewTaskHint(event.target.value)}
                placeholder="Catatan kecil opsional"
                className="micro-break-input"
                maxLength={240}
              />
              <Button type="button" onClick={createTask} disabled={isSaving} className="micro-break-button-primary">
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSaving ? 'Menyimpan...' : 'Tambah micro task'}
              </Button>
            </div>
          </div>
        </div>

        <div className="micro-break-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="micro-break-chip">
                <Sparkles className="h-3.5 w-3.5" />
                {selectedOption.label} - {selectedOption.subtitle}
              </p>
              <h3 className="mt-3 text-xl font-black text-slate-900 dark:text-slate-50">Daftar micro task</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Dashboard akan memilih satu tugas secara acak dari daftar ini.</p>
            </div>
            <div className="micro-break-reward-box">
              <span>Total</span>
              <strong>{tasks.length} tugas</strong>
              <small>aktif</small>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="micro-task-row text-sm font-semibold text-slate-500 dark:text-slate-300">Memuat micro task...</div>
            ) : loadError ? (
              <div className="micro-task-row text-sm font-semibold text-slate-500 dark:text-slate-300">
                <p>{loadError}</p>
                <Button type="button" variant="outline" onClick={() => void loadTasks()} className="micro-break-button-secondary mt-3">
                  <RefreshCw className="mr-2 h-4 w-4" /> Coba muat ulang
                </Button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="micro-task-row text-sm font-semibold text-slate-500 dark:text-slate-300">
                Belum ada micro task untuk durasi ini. Tambahkan satu tugas kecil dari form di samping.
              </div>
            ) : (
              tasks.map((task) => {
                const isEditing = editingTaskId === task.id;
                return (
                  <div key={task.id} className="micro-task-row">
                    {isEditing ? (
                      <div className="grid gap-2">
                        <input
                          type="text"
                          value={editState.title}
                          onChange={(event) => setEditState((previous) => ({ ...previous, title: event.target.value }))}
                          className="micro-break-input"
                          maxLength={180}
                        />
                        <input
                          type="text"
                          value={editState.hint}
                          onChange={(event) => setEditState((previous) => ({ ...previous, hint: event.target.value }))}
                          placeholder="Catatan kecil opsional"
                          className="micro-break-input"
                          maxLength={240}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button type="button" onClick={() => saveEdit(task)} disabled={isSaving} className="micro-break-button-primary">
                            <Save className="mr-2 h-4 w-4" /> Simpan
                          </Button>
                          <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSaving} className="micro-break-button-secondary">
                            <XCircle className="mr-2 h-4 w-4" /> Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <h4 className="text-base font-black text-slate-900 dark:text-slate-50">{task.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">
                            {task.hint || 'Tidak ada catatan tambahan.'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                          <Button type="button" variant="outline" onClick={() => startEdit(task)} disabled={isSaving} className="micro-break-button-secondary">
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </Button>
                          <Button type="button" variant="outline" onClick={() => deleteTask(task)} disabled={isSaving} className="micro-break-button-secondary">
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/45 px-4 py-3 text-sm font-semibold text-slate-600 dark:bg-slate-950/20 dark:text-slate-300">
            {message}
          </div>
        </div>
      </div>
    </section>
  );
}
