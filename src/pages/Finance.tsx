import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WalletsTab from './finance/WalletsTab';
import TransactionsTab from './finance/TransactionsTab';
import BudgetsTab from './finance/BudgetsTab';
import BillsTab from './finance/BillsTab';

export default function Finance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const validTabs = ['wallets', 'transactions', 'budgets', 'bills'];
  const [activeTab, setActiveTab] = useState(validTabs.includes(requestedTab || '') ? requestedTab || 'wallets' : 'wallets');

  useEffect(() => {
    if (requestedTab && validTabs.includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', value);
    nextParams.delete('highlight');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="page-shell">
      <div className="page-hero">
        <p className="page-hero-eyebrow">Keuangan</p>
        <h1 className="page-hero-title">Kelola dompet, transaksi, dan anggaran</h1>
        <p className="page-hero-copy">Pantau arus kas, anggaran, dan tagihan dari satu tempat.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="border border-slate-200 bg-[#F8FAFC]/85">
          <TabsTrigger value="wallets" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Dompet</TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Transaksi</TabsTrigger>
          <TabsTrigger value="budgets" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Anggaran</TabsTrigger>
          <TabsTrigger value="bills" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Tagihan</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets"><WalletsTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="budgets"><BudgetsTab /></TabsContent>
        <TabsContent value="bills"><BillsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
