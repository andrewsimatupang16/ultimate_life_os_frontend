import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { budgetApi } from '@/api/finance';
import type { Budget, BudgetCreate, BudgetPeriodEnum } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SelectOrCustomInput from '@/components/SelectOrCustomInput';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, PiggyBank, Pencil } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { fromDateTimeLocal } from '@/lib/format';
import { isBlank, isInvalidDateRange, parseOptionalDateTimeLocal, parsePositiveNumber } from '@/lib/form-validation';
import { FINANCE_CATEGORIES, budgetPeriodLabel, budgetPeriods, compactCardClass, compactContentClass, compactGridClass, formatShortDate, getBudgetDailyLimit, toDateTimeLocal } from './finance-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';


type BudgetFormValues = {
  category: string;
  limitAmount: string;
  period: BudgetPeriodEnum;
  startDate: string;
  endDate: string;
};

type BudgetValidationResult =
  | { ok: true; payload: BudgetCreate }
  | { ok: false; message: string };

function buildBudgetPayload(values: BudgetFormValues): BudgetValidationResult {
  const category = values.category.trim();

  if (isBlank(category)) {
    return { ok: false, message: 'Kategori anggaran wajib dipilih.' };
  }

  const limit = parsePositiveNumber(values.limitAmount, 'Batas anggaran');
  if (!limit.ok) {
    return { ok: false, message: limit.message };
  }

  let startDateValue: string | null = null;
  let endDateValue: string | null = null;

  if (values.period === 'custom') {
    const startDate = parseOptionalDateTimeLocal(values.startDate, 'Tanggal mulai anggaran');
    if (!startDate.ok) {
      return { ok: false, message: startDate.message };
    }

    const endDate = parseOptionalDateTimeLocal(values.endDate, 'Tanggal akhir anggaran');
    if (!endDate.ok) {
      return { ok: false, message: endDate.message };
    }

    if (!startDate.value || !endDate.value) {
      return {
        ok: false,
        message: 'Anggaran khusus wajib memiliki tanggal mulai dan tanggal akhir.',
      };
    }

    if (isInvalidDateRange(startDate.value, endDate.value)) {
      return {
        ok: false,
        message: 'Tanggal akhir harus setelah tanggal mulai.',
      };
    }

    startDateValue = startDate.value;
    endDateValue = endDate.value;
  }

  return {
    ok: true,
    payload: {
      category,
      limit_amount: limit.value,
      period: values.period,
      start_date: startDateValue ? fromDateTimeLocal(startDateValue) : null,
      end_date: endDateValue ? fromDateTimeLocal(endDateValue) : null,
    },
  };
}

export default function BudgetsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [searchParams] = useSearchParams();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [newBudgetPeriod, setNewBudgetPeriod] = useState<BudgetPeriodEnum>('monthly');
  const [newBudgetStartDate, setNewBudgetStartDate] = useState('');
  const [newBudgetEndDate, setNewBudgetEndDate] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editBudgetCategory, setEditBudgetCategory] = useState('');
  const [editBudgetLimit, setEditBudgetLimit] = useState('');
  const [editBudgetPeriod, setEditBudgetPeriod] = useState<BudgetPeriodEnum>('monthly');
  const [editBudgetStartDate, setEditBudgetStartDate] = useState('');
  const [editBudgetEndDate, setEditBudgetEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | BudgetPeriodEnum>('all');

  useEffect(() => {
    const requestedCategory = searchParams.get('category');
    const requestedPeriod = searchParams.get('period');
    if (requestedCategory) setCategoryFilter(requestedCategory);
    if (requestedPeriod === 'daily' || requestedPeriod === 'weekly' || requestedPeriod === 'monthly' || requestedPeriod === 'custom') {
      setPeriodFilter(requestedPeriod);
    }
  }, [searchParams]);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await budgetApi.getAll();
      setBudgets(data);
    } catch (error) {
      console.error(error);
      setBudgets([]);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data anggaran.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBudgets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBudgets]);

  const createBudget = async () => {
    const result = buildBudgetPayload({
      category: newBudgetCategory,
      limitAmount: newBudgetLimit,
      period: newBudgetPeriod,
      startDate: newBudgetStartDate,
      endDate: newBudgetEndDate,
    });

    if (result.ok === false) {
      toast({ title: result.message, variant: 'destructive' });
      return;
    }

    try {
      await budgetApi.create(result.payload);
      setNewBudgetCategory('');
      setNewBudgetLimit('');
      setNewBudgetPeriod('monthly');
      setNewBudgetStartDate('');
      setNewBudgetEndDate('');
      setDialogOpen(false);
      loadBudgets();
      toast({ title: 'Anggaran berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat anggaran'), variant: 'destructive' });
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      await budgetApi.delete(id);
      loadBudgets();
      toast({ title: 'Anggaran berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus anggaran'), variant: 'destructive' });
    }
  };

  const openEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setEditBudgetCategory(budget.category);
    setEditBudgetLimit(String(budget.limit_amount));
    setEditBudgetPeriod(budget.period || 'monthly');
    setEditBudgetStartDate(toDateTimeLocal(budget.start_date));
    setEditBudgetEndDate(toDateTimeLocal(budget.end_date));
    setEditDialogOpen(true);
  };

  const updateBudget = async () => {
    if (!editingBudget) return;

    const result = buildBudgetPayload({
      category: editBudgetCategory,
      limitAmount: editBudgetLimit,
      period: editBudgetPeriod,
      startDate: editBudgetStartDate,
      endDate: editBudgetEndDate,
    });

    if (result.ok === false) {
      toast({ title: result.message, variant: 'destructive' });
      return;
    }

    try {
      await budgetApi.update(editingBudget.id, result.payload);
      setEditDialogOpen(false);
      setEditingBudget(null);
      loadBudgets();
      toast({ title: 'Anggaran berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui anggaran'), variant: 'destructive' });
    }
  };

  if (loading) return <LoadingState label="Memuat data..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Anggaran belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadBudgets()}
      />
    );
  }

  const availableCategories = Array.from(new Set([
    ...FINANCE_CATEGORIES,
    ...budgets.map((budget) => budget.category).filter(Boolean),
  ]));

  const filteredBudgets = budgets.filter((budget) => {
    const matchesCategory = categoryFilter === 'all' || budget.category === categoryFilter;
    const matchesPeriod = periodFilter === 'all' || budget.period === periodFilter;
    return matchesCategory && matchesPeriod;
  });

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Daftar Anggaran</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Tambah Anggaran
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Buat Anggaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kategori</Label>
                <SelectOrCustomInput
                  value={newBudgetCategory}
                  onValueChange={setNewBudgetCategory}
                  options={availableCategories}
                  placeholder="Pilih kategori"
                  customPlaceholder="Tulis kategori anggaran"
                  selectClassName="bg-white/70 border-slate-200 text-slate-800"
                  inputClassName="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Batas anggaran</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newBudgetLimit}
                  onChange={(e) => setNewBudgetLimit(e.target.value)}
                  placeholder="0"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Periode anggaran</Label>
                <Select value={newBudgetPeriod} onValueChange={(v: BudgetPeriodEnum) => setNewBudgetPeriod(v)}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {budgetPeriods.map((period) => (
                      <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <p className="text-xs leading-5 text-slate-500">
                    Harian, mingguan, dan bulanan otomatis mengikuti periode berjalan. Pilih khusus jika ingin menentukan tanggal mulai dan akhir sendiri.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Tanggal mulai</Label>
                      <Input
                        type="datetime-local"
                        value={newBudgetStartDate}
                        onChange={(e) => setNewBudgetStartDate(e.target.value)}
                        disabled={newBudgetPeriod !== 'custom'}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                    <div>
                      <Label>Tanggal akhir</Label>
                      <Input
                        type="datetime-local"
                        value={newBudgetEndDate}
                        onChange={(e) => setNewBudgetEndDate(e.target.value)}
                        disabled={newBudgetPeriod !== 'custom'}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </details>
              <Button onClick={createBudget} className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Anggaran
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Edit Anggaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kategori</Label>
                <SelectOrCustomInput
                  value={editBudgetCategory}
                  onValueChange={setEditBudgetCategory}
                  options={availableCategories}
                  placeholder="Pilih kategori"
                  customPlaceholder="Tulis kategori anggaran"
                  selectClassName="bg-white/70 border-slate-200 text-slate-800"
                  inputClassName="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Batas anggaran</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editBudgetLimit}
                  onChange={(e) => setEditBudgetLimit(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Periode anggaran</Label>
                <Select value={editBudgetPeriod} onValueChange={(v: BudgetPeriodEnum) => setEditBudgetPeriod(v)}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {budgetPeriods.map((period) => (
                      <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <p className="text-xs leading-5 text-slate-500">
                    Harian, mingguan, dan bulanan otomatis mengikuti periode berjalan. Gunakan khusus jika ingin menentukan tanggal mulai dan akhir sendiri.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Tanggal mulai</Label>
                      <Input
                        type="datetime-local"
                        value={editBudgetStartDate}
                        onChange={(e) => setEditBudgetStartDate(e.target.value)}
                        disabled={editBudgetPeriod !== 'custom'}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                    <div>
                      <Label>Tanggal akhir</Label>
                      <Input
                        type="datetime-local"
                        value={editBudgetEndDate}
                        onChange={(e) => setEditBudgetEndDate(e.target.value)}
                        disabled={editBudgetPeriod !== 'custom'}
                        className="bg-white/70 border-slate-200 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </details>
              <Button onClick={updateBudget} className="w-full bg-blue-600 hover:bg-blue-700">
                Simpan Anggaran
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={(value: 'all' | BudgetPeriodEnum) => setPeriodFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua periode</SelectItem>
            {budgetPeriods.map((period) => (
              <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={compactGridClass}>
        {filteredBudgets.map((budget) => {
          const percent = Math.min(100, (budget.current_spent / budget.limit_amount) * 100);
          const isOver = budget.current_spent > budget.limit_amount;
          const dailyLimit = getBudgetDailyLimit(budget);
          return (
            <Card id={dashboardTargetId(budget.id)} key={budget.id} className={`${compactCardClass} ${highlightClassName(budget.id)}`}>
              <CardContent className={compactContentClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`app-list-icon ${isOver ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      <PiggyBank className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-slate-800">{budget.category}</h4>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500">{budgetPeriodLabel(budget.period)}</span>
                        <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500">
                          {formatShortDate(budget.start_date)} - {formatShortDate(budget.end_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditBudget(budget)} className="h-9 w-9 p-0 shadow-sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm({
                        title: 'Hapus anggaran?',
                        description: 'Anggaran ini akan dihapus dari daftar perencanaan.',
                        onConfirm: () => deleteBudget(budget.id),
                      })}
                      className="h-9 w-9 p-0 text-red-600 shadow-sm hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-500">
                      Rp {budget.current_spent.toLocaleString()} / Rp {budget.limit_amount.toLocaleString()}
                    </span>
                    <span className={`font-semibold ${isOver ? 'text-red-600' : 'text-slate-600'}`}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={percent} className="h-1.5 bg-white/70" />
                  <div className={`app-list-highlight ${isOver ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    {isOver ? 'Melebihi anggaran' : `Batas harian: Rp ${dailyLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}/hari`}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {budgets.length === 0 && (
          <EmptyState
            icon={PiggyBank}
            title="Belum ada anggaran"
            description="Buat anggaran pertama untuk membantu membatasi pengeluaran."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
        {budgets.length > 0 && filteredBudgets.length === 0 && (
          <EmptyState
            icon={PiggyBank}
            title="Anggaran tidak ditemukan"
            description="Coba ubah kategori atau filter periode."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
      </div>
    </div>
    {confirmDialog}
    </>
  );
}
