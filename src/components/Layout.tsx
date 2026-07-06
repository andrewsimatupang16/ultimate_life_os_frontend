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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = user?.full_name?.trim() || t('Life OS');

  const closeMobileNav = () => setMobileNavOpen(false);

  const renderMenuItems = (onClick?: () => void) => (
    <nav className="space-y-1.5">
      {menu.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={({ isActive }) =>
              `app-nav-item group/nav flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                isActive ? 'app-nav-item-active' : 'app-nav-item-idle'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t(item.label)}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell min-h-screen text-slate-700 dark:text-slate-100">
      <header className="app-mobile-header fixed inset-x-3 top-3 z-[70] flex items-center justify-between rounded-3xl px-3 py-2 backdrop-blur-2xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="app-nav-primary-button flex h-10 w-10 items-center justify-center rounded-2xl transition hover:scale-[1.02] active:scale-95"
          aria-label={t('Buka navigasi')}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">{displayName}</p>
          <p className="text-[11px] font-medium text-slate-400">Life OS</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={theme === 'dark' ? t('Aktifkan mode terang') : t('Aktifkan mode gelap')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex h-10 min-w-10 items-center justify-center rounded-2xl px-2 text-xs font-extrabold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={language === 'id' ? 'Switch to English' : 'Ganti ke bahasa Indonesia'}
          >
            {language === 'id' ? 'EN' : 'ID'}
          </button>
        </div>
      </header>

      <aside className="app-desktop-sidebar group/sidebar fixed bottom-5 left-5 top-5 z-[60] hidden w-20 overflow-hidden rounded-[2rem] p-3 backdrop-blur-2xl transition-[width] duration-300 hover:w-72 lg:flex lg:flex-col">
        <div className="mb-5 flex h-12 items-center gap-3 rounded-2xl px-2">
          <div className="app-nav-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            <h1 className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{displayName}</h1>
            <p className="text-xs font-medium text-slate-400">Life OS</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-0.5">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `app-nav-item flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition ${
                    isActive ? 'app-nav-item-active' : 'app-nav-item-idle'
                  }`
                }
                title={t(item.label)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">{t(item.label)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-4 space-y-2">
          <div className="flex gap-2 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              aria-label={theme === 'dark' ? t('Aktifkan mode terang') : t('Aktifkan mode gelap')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? t('Terang') : t('Gelap')}
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex h-10 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xs font-extrabold text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              aria-label={language === 'id' ? 'Switch to English' : 'Ganti ke bahasa Indonesia'}
            >
              {language === 'id' ? 'EN' : 'ID'}
            </button>
          </div>
          <Button onClick={logout} variant="ghost" className="h-12 w-full justify-start rounded-2xl px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
            <LogOut className="mr-3 h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">{t('Keluar')}</span>
          </Button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label={t('Tutup navigasi')}
          className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-sm lg:hidden"
          onClick={closeMobileNav}
        />
      )}

      <aside
        className={`app-mobile-sidebar fixed bottom-3 left-3 top-3 z-[90] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col rounded-[2rem] p-4 backdrop-blur-2xl transition-transform duration-300 lg:hidden ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-slate-900 dark:text-white">{displayName}</p>
            <p className="text-xs font-medium text-slate-400">Navigasi</p>
          </div>
          <button
            type="button"
            onClick={closeMobileNav}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15 dark:hover:text-white"
            aria-label={t('Tutup navigasi')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{renderMenuItems(closeMobileNav)}</div>
        <Button onClick={logout} variant="ghost" className="mt-4 justify-start rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
          <LogOut className="mr-2 h-4 w-4" /> {t('Keluar')}
        </Button>
      </aside>

      <main className="app-main px-4 pb-6 pt-24 lg:pl-28 lg:pr-8 lg:pt-8 xl:pr-10">
        <Outlet />
      </main>
    </div>
  );
}
