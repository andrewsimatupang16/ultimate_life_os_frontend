import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GoalsTab from './productivity/GoalsTab';
import SubGoalsTab from './productivity/SubGoalsTab';
import TasksTab from './productivity/TasksTab';
import HabitsTab from './productivity/HabitsTab';
import RewardsTab from './productivity/RewardsTab';

export default function Productivity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const validTabs = ['goals', 'subgoals', 'tasks', 'habits', 'rewards'];
  const [activeTab, setActiveTab] = useState(validTabs.includes(requestedTab || '') ? requestedTab || 'goals' : 'goals');

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
        <p className="page-hero-eyebrow">Produktivitas</p>
        <h1 className="page-hero-title">Goal utama dulu, task harian mengikuti</h1>
        <p className="page-hero-copy">Catat semua goal, fokuskan satu yang aktif, lalu hubungkan tugas dan habit agar progres harian tetap searah.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="border border-slate-200 bg-[#F8FAFC]/85">
          <TabsTrigger value="goals" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Goal Stack</TabsTrigger>
          <TabsTrigger value="subgoals" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Detail Goal</TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Task Hari Ini</TabsTrigger>
          <TabsTrigger value="habits" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Habit</TabsTrigger>
          <TabsTrigger value="rewards" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Reward</TabsTrigger>
        </TabsList>

        <TabsContent value="goals"><GoalsTab /></TabsContent>
        <TabsContent value="subgoals"><SubGoalsTab /></TabsContent>
        <TabsContent value="tasks"><TasksTab /></TabsContent>
        <TabsContent value="habits"><HabitsTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
