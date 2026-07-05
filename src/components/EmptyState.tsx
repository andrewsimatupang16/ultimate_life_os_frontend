import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export default function EmptyState({ icon: Icon, title, description, className = '' }: EmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC]/70 px-6 py-10 text-center text-slate-500 ${className}`}>
      <Icon className="mx-auto mb-3 h-10 w-10 text-slate-400" />
      <p className="font-medium text-slate-700">{t(title)}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{t(description)}</p>}
    </div>
  );
}
