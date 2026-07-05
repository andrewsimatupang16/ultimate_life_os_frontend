import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { walletApi, transactionApi, type TransactionFilters } from '@/api/finance';
import type { Wallet as WalletType, Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SelectOrCustomInput from '@/components/SelectOrCustomInput';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Plus, Trash2, Wallet, TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { fromDateTimeLocalOrUndefined } from '@/lib/format';
import { isBlank, parsePositiveNumber } from '@/lib/form-validation';
import { COLORS, FINANCE_CATEGORIES, compactCardClass, compactContentClass, toDateTimeLocal } from './finance-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';

export default function TransactionsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [searchParams] = useSearchParams();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTxWallet, setNewTxWallet] = useState('');
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('expense');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxCategory, setNewTxCategory] = useState('');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxDate, setNewTxDate] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxWallet, setEditTxWallet] = useState('');
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>('expense');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxCategory, setEditTxCategory] = useState('');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const hasWallets = wallets.length > 0;

  const currentDateTimeLocal = () => toDateTimeLocal(new Date().toISOString());

  const startOfDateFilter = (value: string) => value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
  const endOfDateFilter = (value: string) => value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
  const hasTransactionUrlFilters = ['type', 'category', 'date', 'month', 'search', 'wallet_id'].some((key) => searchParams.has(key));
  const toDateInputValue = (value: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
    return parsed.toLocaleDateString('en-CA');
  };

  const loadData = useCallback(async (filters?: TransactionFilters) => {
    setLoading(true);
    setLoadError('');
    try {
      const [txData, walletData] = await Promise.all([
        transactionApi.getAll(filters),
        walletApi.getAll(),
      ]);
      setTransactions(txData);
      setWallets(walletData);
    } catch (error) {
      console.error(error);
      setTransactions([]);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data transaksi dan dompet.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasTransactionUrlFilters) return undefined;

    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasTransactionUrlFilters, loadData]);

  const createTransaction = async () => {
    if (!hasWallets) {
      toast({
        title: 'Buat dompet terlebih dahulu',
        description: 'Transaksi hanya bisa dicatat setelah minimal satu dompet tersedia.',
        variant: 'destructive',
      });
      return;
    }
    if (!newTxWallet || !wallets.some((wallet) => wallet.id === newTxWallet)) {
      toast({ title: 'Pilih dompet yang valid terlebih dahulu', variant: 'destructive' });
      return;
    }
    if (isBlank(newTxCategory)) {
      toast({ title: 'Pilih kategori transaksi', variant: 'destructive' });
      return;
    }
    const amount = parsePositiveNumber(newTxAmount, 'Nominal transaksi');
    if (!amount.ok) {
      toast({ title: amount.message, variant: 'destructive' });
      return;
    }

    try {
      await transactionApi.create({
        wallet_id: newTxWallet,
        type: newTxType,
        amount: amount.value,
        category: newTxCategory,
        transaction_date: newTxDate ? fromDateTimeLocalOrUndefined(newTxDate) : undefined,
        description: newTxDesc,
      });
      setNewTxAmount('');
      setNewTxCategory('');
      setNewTxDesc('');
      setNewTxDate(currentDateTimeLocal());
      setDialogOpen(false);
      void loadData(buildTransactionFilters());
      toast({ title: 'Transaksi berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat transaksi'), variant: 'destructive' });
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await transactionApi.delete(id);
      void loadData(buildTransactionFilters());
      toast({ title: 'Transaksi berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus transaksi'), variant: 'destructive' });
    }
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTxWallet(tx.wallet_id);
    setEditTxType(tx.type);
    setEditTxAmount(String(tx.amount));
    setEditTxCategory(tx.category);
    setEditTxDesc(tx.description || '');
    setEditTxDate(toDateTimeLocal(tx.transaction_date));
    setEditDialogOpen(true);
  };

  const updateTransaction = async () => {
    if (!editingTx) return;
    if (!hasWallets) {
      toast({
        title: 'Dompet tidak tersedia',
        description: 'Transaksi tidak bisa diperbarui karena belum ada dompet aktif.',
        variant: 'destructive',
      });
      return;
    }
    if (!editTxWallet || !wallets.some((wallet) => wallet.id === editTxWallet)) {
      toast({ title: 'Pilih dompet yang valid terlebih dahulu', variant: 'destructive' });
      return;
    }
    if (isBlank(editTxCategory)) {
      toast({ title: 'Pilih kategori transaksi', variant: 'destructive' });
      return;
    }
    const amount = parsePositiveNumber(editTxAmount, 'Nominal transaksi');
    if (!amount.ok) {
      toast({ title: amount.message, variant: 'destructive' });
      return;
    }

    try {
      await transactionApi.update(editingTx.id, {
        wallet_id: editTxWallet,
        type: editTxType,
        amount: amount.value,
        category: editTxCategory,
        transaction_date: editTxDate ? fromDateTimeLocalOrUndefined(editTxDate) : undefined,
        description: editTxDesc,
      });
      setEditDialogOpen(false);
      setEditingTx(null);
      void loadData(buildTransactionFilters());
      toast({ title: 'Transaksi berhasil diperbarui' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui transaksi'), variant: 'destructive' });
    }
  };

  const availableCategories = useMemo(() => Array.from(new Set([
    ...FINANCE_CATEGORIES,
    ...transactions.map((tx) => tx.category).filter(Boolean),
  ])), [transactions]);

  const buildTransactionFilters = useCallback((): TransactionFilters => {
    const filters: TransactionFilters = {};
    const normalizedSearch = searchTerm.trim();

    if (startDateFilter) filters.start_date = startOfDateFilter(startDateFilter);
    if (endDateFilter) filters.end_date = endOfDateFilter(endDateFilter);
    if (categoryFilter !== 'all') filters.category = categoryFilter;
    if (typeFilter !== 'all') filters.tx_type = typeFilter;
    if (walletFilter !== 'all') filters.wallet_id = walletFilter;
    if (normalizedSearch) filters.search = normalizedSearch;

    return filters;
  }, [categoryFilter, endDateFilter, searchTerm, startDateFilter, typeFilter, walletFilter]);

  useEffect(() => {
    const requestedType = searchParams.get('type');
    const requestedCategory = searchParams.get('category');
    const requestedDate = searchParams.get('date');
    const requestedMonth = searchParams.get('month');
    const requestedSearch = searchParams.get('search');
    const requestedWalletId = searchParams.get('wallet_id');

    const nextType = requestedType === 'income' || requestedType === 'expense' ? requestedType : 'all';
    const nextCategory = requestedCategory || 'all';
    const nextSearch = requestedSearch || '';
    const nextWallet = requestedWalletId || 'all';
    let nextStartDate = '';
    let nextEndDate = '';

    if (requestedDate) {
      nextStartDate = toDateInputValue(requestedDate);
      nextEndDate = toDateInputValue(requestedDate);
    } else if (requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)) {
      nextStartDate = `${requestedMonth}-01`;
      const monthEnd = new Date(`${requestedMonth}-01T00:00:00`);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      nextEndDate = monthEnd.toLocaleDateString('en-CA');
    }

    if (!requestedType && !requestedCategory && !requestedDate && !requestedMonth && !requestedSearch && !requestedWalletId) return;

    setTypeFilter(nextType);
    setCategoryFilter(nextCategory);
    setSearchTerm(nextSearch);
    setWalletFilter(nextWallet);
    setStartDateFilter(nextStartDate);
    setEndDateFilter(nextEndDate);

    void loadData({
      ...(nextType !== 'all' ? { tx_type: nextType } : {}),
      ...(nextCategory !== 'all' ? { category: nextCategory } : {}),
      ...(nextSearch ? { search: nextSearch } : {}),
      ...(nextWallet !== 'all' ? { wallet_id: nextWallet } : {}),
      ...(nextStartDate ? { start_date: startOfDateFilter(nextStartDate) } : {}),
      ...(nextEndDate ? { end_date: endOfDateFilter(nextEndDate) } : {}),
    });
  }, [loadData, searchParams]);

  const applyFilters = () => {
    if (startDateFilter && endDateFilter && new Date(endDateFilter) < new Date(startDateFilter)) {
      toast({ title: 'Tanggal akhir tidak boleh sebelum tanggal mulai', variant: 'destructive' });
      return;
    }
    void loadData(buildTransactionFilters());
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setWalletFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    void loadData();
  };

  const filteredTransactions = transactions;

  const expenseByCategory = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(expenseByCategory).map(([category, total]) => ({
    name: category,
    value: total,
  }));

  const totalExpense = pieData.reduce((sum, item) => sum + item.value, 0);
  const topExpenseCategory = pieData.reduce(
    (max, item) => (item.value > (max?.value ?? 0) ? item : max),
    pieData[0],
  );
  const expenseChartInsight = topExpenseCategory && totalExpense > 0
    ? `${topExpenseCategory.name} menjadi pengeluaran terbesar sebesar Rp ${topExpenseCategory.value.toLocaleString()}, sekitar ${((topExpenseCategory.value / totalExpense) * 100).toFixed(1)}% dari total pengeluaran.`
    : 'Belum ada pengeluaran yang cukup untuk dianalisis.';
  let runningPercent = 0;
  const chartSegments = pieData.map((item, index) => {
    const start = runningPercent;
    const end = totalExpense > 0 ? runningPercent + (item.value / totalExpense) * 100 : runningPercent;
    runningPercent = end;

    return `${COLORS[index % COLORS.length]} ${start}% ${end}%`;
  });
  const chartGradient = chartSegments.length > 0
    ? `conic-gradient(${chartSegments.join(', ')})`
    : 'conic-gradient(#e2e8f0 0% 100%)';

  if (loading) return <LoadingState label="Memuat data..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Transaksi belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadData()}
      />
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Daftar Transaksi</h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (open && !hasWallets) {
            toast({
              title: 'Buat dompet terlebih dahulu',
              description: 'Transaksi tidak bisa dibuat sebelum ada dompet aktif.',
              variant: 'destructive',
            });
            setDialogOpen(false);
            return;
          }
          setDialogOpen(open);
          if (open) {
            if (!newTxDate) setNewTxDate(currentDateTimeLocal());
            if (!newTxWallet && wallets[0]) setNewTxWallet(wallets[0].id);
          }
        }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!hasWallets}
              title={!hasWallets ? 'Buat dompet terlebih dahulu sebelum mencatat transaksi' : undefined}
            >
              <Plus className="w-4 h-4 mr-1" /> Tambah Transaksi
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800 max-w-md">
            <DialogHeader>
              <DialogTitle>Transaksi Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Dompet</Label>
                <Select value={newTxWallet} onValueChange={setNewTxWallet}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue placeholder="Pilih dompet" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {wallets.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jenis transaksi</Label>
                <Select value={newTxType} onValueChange={(v: 'income' | 'expense') => setNewTxType(v)}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    <SelectItem value="income">Pemasukan</SelectItem>
                    <SelectItem value="expense">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nominal</Label>
                <Input
                  type="number"
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  placeholder="0"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <SelectOrCustomInput
                  value={newTxCategory}
                  onValueChange={setNewTxCategory}
                  options={availableCategories}
                  placeholder="Pilih kategori"
                  customPlaceholder="Tulis kategori transaksi"
                  selectClassName="bg-white/70 border-slate-200 text-slate-800"
                  inputClassName="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <div>
                    <Label>Catatan (opsional)</Label>
                    <Input
                      value={newTxDesc}
                      onChange={(e) => setNewTxDesc(e.target.value)}
                      placeholder="Catatan singkat..."
                      className="bg-white/70 border-slate-200 text-slate-800"
                    />
                  </div>
                  <div>
                    <Label>Tanggal transaksi</Label>
                    <Input
                      type="datetime-local"
                      value={newTxDate}
                      onChange={(e) => setNewTxDate(e.target.value)}
                      className="bg-white/70 border-slate-200 text-slate-800"
                    />
                  </div>
                </div>
              </details>
              <Button
                onClick={createTransaction}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!hasWallets}
              >
                Buat Transaksi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800 max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Transaksi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Dompet</Label>
                <Select value={editTxWallet} onValueChange={setEditTxWallet}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue placeholder="Pilih dompet" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    {wallets.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jenis transaksi</Label>
                <Select value={editTxType} onValueChange={(v: 'income' | 'expense') => setEditTxType(v)}>
                  <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/70 border-slate-200">
                    <SelectItem value="income">Pemasukan</SelectItem>
                    <SelectItem value="expense">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nominal</Label>
                <Input
                  type="number"
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <SelectOrCustomInput
                  value={editTxCategory}
                  onValueChange={setEditTxCategory}
                  options={availableCategories}
                  placeholder="Pilih kategori"
                  customPlaceholder="Tulis kategori transaksi"
                  selectClassName="bg-white/70 border-slate-200 text-slate-800"
                  inputClassName="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content space-y-4">
                  <div>
                    <Label>Tanggal transaksi</Label>
                    <Input
                      type="datetime-local"
                      value={editTxDate}
                      onChange={(e) => setEditTxDate(e.target.value)}
                      className="bg-white/70 border-slate-200 text-slate-800"
                    />
                  </div>
                  <div>
                    <Label>Catatan</Label>
                    <Input
                      value={editTxDesc}
                      onChange={(e) => setEditTxDesc(e.target.value)}
                      className="bg-white/70 border-slate-200 text-slate-800"
                    />
                  </div>
                </div>
              </details>
              <Button
                onClick={updateTransaction}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!hasWallets}
              >
                Simpan Transaksi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!hasWallets && (
        <Card className="border-amber-200 bg-amber-50/80 text-amber-900 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Buat dompet terlebih dahulu sebelum mencatat transaksi.</p>
              <p className="text-xs leading-relaxed text-amber-800">
                Setiap transaksi harus terhubung ke dompet agar saldo dan riwayat keuangan tetap konsisten.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(220px,1fr)_150px_180px_180px_150px_150px_auto]">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyFilters();
          }}
          placeholder="Cari kategori atau deskripsi..."
        />
        <Select value={typeFilter} onValueChange={(value: 'all' | 'income' | 'expense') => setTypeFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tipe</SelectItem>
            <SelectItem value="income">Pemasukan</SelectItem>
            <SelectItem value="expense">Pengeluaran</SelectItem>
          </SelectContent>
        </Select>
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
        <Select value={walletFilter} onValueChange={setWalletFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua dompet</SelectItem>
            {wallets.map((wallet) => (
              <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} aria-label="Tanggal mulai transaksi" />
        <Input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} aria-label="Tanggal akhir transaksi" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={applyFilters}>Terapkan</Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
        {/* Transaction List */}
        <div className="finance-transaction-grid max-h-[560px] overflow-y-auto pr-2 pb-2">
          {filteredTransactions.map((tx) => (
            <Card id={dashboardTargetId(tx.id)} key={tx.id} className={`${compactCardClass} ${highlightClassName(tx.id)} finance-transaction-card h-auto self-start`}>
              <CardContent className={`${compactContentClass} finance-transaction-card-content`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {tx.type === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{tx.category}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(tx.transaction_date).toLocaleDateString('id-ID')}
                      </p>
                      {tx.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{tx.description}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditTransaction(tx)} className="h-9 w-9 p-0 shadow-sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm({
                        title: 'Hapus transaksi?',
                        description: 'Saldo dompet akan disesuaikan kembali dan anggaran terkait akan dihitung ulang. Transaksi pembayaran tagihan yang sudah dibayar harus dibatalkan dari menu Tagihan.',
                        onConfirm: () => deleteTransaction(tx.id),
                      })}
                      className="h-9 w-9 p-0 text-red-600 shadow-sm hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className={`finance-transaction-amount rounded-2xl text-sm font-bold ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '-'} Rp {tx.amount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
          {transactions.length === 0 && (
            <EmptyState
              icon={Wallet}
              title="Belum ada transaksi"
              description="Tambahkan pemasukan atau pengeluaran pertama."
              className="md:col-span-2 2xl:col-span-3"
            />
          )}
          {transactions.length > 0 && filteredTransactions.length === 0 && (
            <EmptyState
              icon={Wallet}
              title="Transaksi tidak ditemukan"
              description="Coba ubah kata kunci, tipe, atau kategori filter."
              className="md:col-span-2 2xl:col-span-3"
            />
          )}
        </div>

        {/* Expense by Category Chart */}
        <Card className="finance-chart-card self-start border-slate-200 bg-[#F8FAFC]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800">Pengeluaran per Kategori</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs leading-5 text-blue-800">
              <span className="font-semibold">Insight: </span>{expenseChartInsight}
            </div>
            {pieData.length > 0 ? (
              <div className="flex justify-center py-2">
                <div className="finance-donut" style={{ background: chartGradient }}>
                  <div className="finance-donut-hole">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</span>
                    <strong className="mt-1 text-sm text-slate-800">Rp {totalExpense.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-slate-500">Belum ada data pengeluaran</p>
            )}
            <div className="space-y-2">
              {pieData.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm transition hover:bg-white/70"
                  title={`${item.name}: Rp ${item.value.toLocaleString()} (${totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0.0'}% dari total pengeluaran)`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <div className="min-w-0">
                      <span className="block truncate text-slate-600">{item.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0.0'}% dari total pengeluaran
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-slate-500">
                    Rp {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    {confirmDialog}
    </>
  );
}
