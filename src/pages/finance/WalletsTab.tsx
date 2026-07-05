import { useCallback, useEffect, useState } from 'react';
import { walletApi, transactionApi } from '@/api/finance';
import type { FinanceSummary, Wallet as WalletType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { isBlank, parseNonNegativeNumber } from '@/lib/form-validation';
import { compactCardClass, compactContentClass, compactGridClass, walletIcons, walletTypeLabel } from './finance-utils';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { dashboardTargetId, useDashboardTargetHighlight } from '@/hooks/use-dashboard-target-highlight';

const WALLET_ADJUSTMENT_LABEL = 'Penyesuaian Saldo';
const DEFAULT_FINANCE_SUMMARY: FinanceSummary = {
  total_income: 0,
  total_expense: 0,
  net: 0,
  total_balance: 0,
  total_wallets: 0,
  by_category: [],
};

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString()}`;
}

export default function WalletsTab() {
  const { toast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { highlightClassName } = useDashboardTargetHighlight();
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>(DEFAULT_FINANCE_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletType | null>(null);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<'cash' | 'bank' | 'ewallet'>('cash');
  const [newWalletBalance, setNewWalletBalance] = useState(0);
  const [editWalletName, setEditWalletName] = useState('');
  const [editWalletType, setEditWalletType] = useState<'cash' | 'bank' | 'ewallet'>('cash');
  const [editWalletBalance, setEditWalletBalance] = useState(0);
  const [walletSearch, setWalletSearch] = useState('');
  const [walletTypeFilter, setWalletTypeFilter] = useState<'all' | 'cash' | 'bank' | 'ewallet'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [walletsData, summaryData] = await Promise.all([
        walletApi.getAll(),
        transactionApi.getSummary(),
      ]);
      setWallets(walletsData);
      setSummary(summaryData);
    } catch (error) {
      console.error(error);
      setWallets([]);
      setSummary(DEFAULT_FINANCE_SUMMARY);
      setLoadError(getApiErrorMessage(error, 'Gagal memuat data dompet dan ringkasan transaksi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const createWallet = async () => {
    if (isBlank(newWalletName)) {
      toast({ title: 'Nama dompet wajib diisi', variant: 'destructive' });
      return;
    }
    const balance = parseNonNegativeNumber(newWalletBalance, 'Saldo awal');
    if (!balance.ok) {
      toast({ title: balance.message, variant: 'destructive' });
      return;
    }
    try {
      await walletApi.create({ name: newWalletName, wallet_type: newWalletType, balance: balance.value });
      setNewWalletName('');
      setNewWalletBalance(0);
      setDialogOpen(false);
      loadData();
      toast({ title: 'Dompet berhasil dibuat' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal membuat dompet'), variant: 'destructive' });
    }
  };

  const deleteWallet = async (id: string) => {
    try {
      await walletApi.delete(id);
      loadData();
      toast({ title: 'Dompet berhasil dihapus' });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal menghapus dompet'), variant: 'destructive' });
    }
  };

  const openEditWallet = (wallet: WalletType) => {
    setEditingWallet(wallet);
    setEditWalletName(wallet.name);
    setEditWalletType(wallet.wallet_type);
    setEditWalletBalance(wallet.balance);
    setEditDialogOpen(true);
  };

  const submitWalletUpdate = async (balanceValue: number) => {
    if (!editingWallet) return;

    try {
      await walletApi.update(editingWallet.id, {
        name: editWalletName,
        wallet_type: editWalletType,
        balance: balanceValue,
      });
      setEditDialogOpen(false);
      setEditingWallet(null);
      void loadData();
      toast({
        title: 'Dompet berhasil diperbarui',
        description: balanceValue !== editingWallet.balance
          ? `Saldo disesuaikan melalui transaksi kategori ${WALLET_ADJUSTMENT_LABEL}.`
          : undefined,
      });
    } catch (error) {
      toast({ title: getApiErrorMessage(error, 'Gagal memperbarui dompet'), variant: 'destructive' });
    }
  };

  const updateWallet = () => {
    if (!editingWallet) return;
    if (isBlank(editWalletName)) {
      toast({ title: 'Nama dompet wajib diisi', variant: 'destructive' });
      return;
    }
    const balance = parseNonNegativeNumber(editWalletBalance, 'Saldo');
    if (!balance.ok) {
      toast({ title: balance.message, variant: 'destructive' });
      return;
    }

    const balanceDelta = balance.value - editingWallet.balance;
    if (balanceDelta !== 0) {
      const direction = balanceDelta > 0 ? 'pemasukan' : 'pengeluaran';
      confirm({
        title: 'Sesuaikan saldo dompet?',
        description: [
          `Saldo ${editingWallet.name} akan berubah dari ${formatRupiah(editingWallet.balance)} menjadi ${formatRupiah(balance.value)}.`,
          `Sistem akan mencatat ${direction} sebesar ${formatRupiah(Math.abs(balanceDelta))} sebagai ${WALLET_ADJUSTMENT_LABEL} agar riwayat saldo tetap jelas.`,
        ].join(' '),
        confirmLabel: 'Simpan penyesuaian',
        onConfirm: () => submitWalletUpdate(balance.value),
      });
      return;
    }

    void submitWalletUpdate(balance.value);
  };

  if (loading) return <LoadingState label="Memuat data..." />;
  if (loadError) {
    return (
      <ErrorState
        title="Dompet belum bisa dimuat"
        description={loadError}
        onRetry={() => void loadData()}
      />
    );
  }

  const totalBalance = summary.total_balance;
  const filteredWallets = wallets.filter((wallet) => {
    const matchesSearch = wallet.name.toLowerCase().includes(walletSearch.trim().toLowerCase());
    const matchesType = walletTypeFilter === 'all' || wallet.wallet_type === walletTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <>
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="modern-grid">
        <Card className="border-slate-200 bg-[#F8FAFC]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total pemasukan</p>
                <p className="text-base font-semibold text-emerald-600">
                  Rp {summary.total_income.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-[#F8FAFC]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total pengeluaran</p>
                <p className="text-base font-semibold text-red-600">
                  Rp {summary.total_expense.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-[#F8FAFC]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                <Wallet className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total saldo</p>
                <p className="text-base font-semibold text-blue-600">
                  Rp {totalBalance.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">
                  {summary.total_wallets.toLocaleString()} dompet aktif
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daftar dompet */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Daftar Dompet</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Tambah Dompet
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Buat Dompet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nama</Label>
                <Input
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="Contoh: Dompet Utama"
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Saldo awal</Label>
                <Input
                  type="number"
                  value={newWalletBalance}
                  onChange={(e) => setNewWalletBalance(Number(e.target.value))}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content">
                  <Label>Jenis</Label>
                  <Select value={newWalletType} onValueChange={(v: 'cash' | 'bank' | 'ewallet') => setNewWalletType(v)}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="cash">Tunai</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="ewallet">Dompet Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </details>
              <Button onClick={createWallet} className="w-full bg-blue-600 hover:bg-blue-700">
                Buat Dompet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="border-slate-200 bg-[#F8FAFC] text-slate-800">
            <DialogHeader>
              <DialogTitle>Edit Dompet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nama</Label>
                <Input
                  value={editWalletName}
                  onChange={(e) => setEditWalletName(e.target.value)}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
              </div>
              <div>
                <Label>Saldo</Label>
                <Input
                  type="number"
                  value={editWalletBalance}
                  onChange={(e) => setEditWalletBalance(Number(e.target.value))}
                  className="bg-white/70 border-slate-200 text-slate-800"
                />
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Jika saldo diubah, sistem akan membuat catatan penyesuaian otomatis.
                  Ini menjaga histori saldo tetap dapat ditelusuri.
                </p>
              </div>
              <details className="quick-form-advanced">
                <summary>Detail lanjutan</summary>
                <div className="quick-form-advanced-content">
                  <Label>Jenis</Label>
                  <Select value={editWalletType} onValueChange={(v: 'cash' | 'bank' | 'ewallet') => setEditWalletType(v)}>
                    <SelectTrigger className="bg-white/70 border-slate-200 text-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/70 border-slate-200">
                      <SelectItem value="cash">Tunai</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="ewallet">Dompet Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </details>
              <Button onClick={updateWallet} className="w-full bg-blue-600 hover:bg-blue-700">
                Simpan Dompet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
        <Input
          value={walletSearch}
          onChange={(event) => setWalletSearch(event.target.value)}
          placeholder="Cari nama dompet..."
        />
        <Select value={walletTypeFilter} onValueChange={(value: 'all' | 'cash' | 'bank' | 'ewallet') => setWalletTypeFilter(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tipe</SelectItem>
            <SelectItem value="cash">Tunai</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="ewallet">Dompet Digital</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={compactGridClass}>
        {filteredWallets.map((wallet) => (
          <Card id={dashboardTargetId(wallet.id)} key={wallet.id} className={`${compactCardClass} ${highlightClassName(wallet.id)}`}>
            <CardContent className={compactContentClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="app-list-icon bg-blue-50 text-blue-600">
                    {walletIcons[wallet.wallet_type] || <Wallet className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-slate-800">{wallet.name}</h4>
                    <Badge variant="outline" className="mt-1 h-6 px-2 text-[11px] capitalize text-slate-500 border-slate-200">
                      {walletTypeLabel(wallet.wallet_type)}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditWallet(wallet)} className="h-9 w-9 p-0 shadow-sm">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => confirm({
                      title: 'Hapus dompet?',
                      description: 'Dompet dan transaksi aktif di dalamnya akan dihapus. Jika dompet masih terhubung ke tagihan yang sudah dibayar, batalkan status pembayaran tagihan tersebut terlebih dahulu.',
                      onConfirm: () => deleteWallet(wallet.id),
                    })}
                    className="h-9 w-9 p-0 text-red-600 shadow-sm hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="app-list-highlight bg-blue-50 text-blue-600">
                Rp {wallet.balance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
        {wallets.length === 0 && (
          <EmptyState
            icon={Wallet}
            title="Belum ada dompet"
            description="Tambahkan dompet pertama untuk mulai mencatat saldo dan transaksi."
            className="md:col-span-2 lg:col-span-3"
          />
        )}
        {wallets.length > 0 && filteredWallets.length === 0 && (
          <EmptyState
            icon={Wallet}
            title="Dompet tidak ditemukan"
            description="Coba ubah kata kunci atau filter jenis dompet."
            className="md:col-span-2 lg:col-span-3"
          />
        )}
      </div>
    </div>
    {confirmDialog}
    </>
  );
}
