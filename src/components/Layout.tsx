import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { useThemeMode } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { BarChart3, LayoutDashboard, LogOut, Menu, Moon, Sun, Target, Users, Wallet, X } from 'lucide-react';

const menu = [
  { to: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/productivity', label: 'Produktivitas', icon: Target },
  { to: '/finance', label: 'Keuangan', icon: Wallet },
  { to: '/partner', label: 'Partner', icon: Users },
  { to: '/profile', label: 'Profil', icon: BarChart3 },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeMode();
  const { language, toggleLanguage, t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const displayName = user?.full_name?.trim() || t('Pengguna');

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell min-h-screen text-slate-700">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        onMouseEnter={() => setSidebarOpen(true)}
        className={`app-menu-button fixed left-5 top-5 z-[80] flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 text-slate-700 transition hover:border-blue-200 hover:text-blue-600 lg:left-6 lg:top-6 ${
          sidebarOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-label={t('Buka navigasi')}
      >
        <Menu className="h-5 w-5" />
        <span className="hidden text-sm font-semibold sm:inline">{t('Menu')}</span>
      </button>

      <div className="app-top-actions fixed right-4 top-4 z-[70] flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          aria-label={theme === 'dark' ? t('Aktifkan mode terang') : t('Aktifkan mode gelap')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{theme === 'dark' ? t('Terang') : t('Gelap')}</span>
        </button>
        <button
          type="button"
          onClick={toggleLanguage}
          className="theme-toggle flex h-10 items-center rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          aria-label={language === 'id' ? 'Switch to English' : 'Ganti ke bahasa Indonesia'}
        >
          {language === 'id' ? 'EN' : 'ID'}
        </button>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label={t('Tutup navigasi')}
          className="fixed inset-0 z-[85] bg-slate-950/20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={closeSidebar}
        className={`app-sidebar fixed bottom-5 left-5 top-5 z-[90] flex w-[min(17rem,calc(100vw-3rem))] flex-col p-4 transition-all duration-300 lg:bottom-6 lg:left-6 lg:top-6 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="mb-8 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">Life OS</h1>
            <p className="truncate text-sm text-slate-500">{displayName}</p>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
            aria-label={t('Tutup navigasi')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {t(item.label)}
              </NavLink>
            );
          })}
        </nav>
        <Button onClick={logout} variant="ghost" className="mt-4 justify-start text-slate-500 hover:text-blue-600">
          <LogOut className="mr-2 h-4 w-4" /> {t('Keluar')}
        </Button>
      </aside>

      <main className="app-main px-4 pb-4 pt-20 lg:px-6 lg:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
