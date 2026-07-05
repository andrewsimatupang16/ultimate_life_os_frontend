import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

type LoadingStateProps = {
  label?: string;
};

export default function LoadingState({ label = 'Memuat data...' }: LoadingStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-none">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span>{t(label)}</span>
      </div>
    </div>
  );
}
