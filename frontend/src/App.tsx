import { useEffect, useMemo, useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { StockManagementPage } from './pages/StockManagementPage';
import { ProcurementPage } from './pages/ProcurementPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { authApi, AuthUser } from './services/api';
import { Button } from './components/common/Button';

type AppTab = 'login' | 'dashboard' | 'stock' | 'procurement' | 'reports' | 'settings';

const tabs: Array<{ id: Exclude<AppTab, 'login'>; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ภาพรวม' },
  { id: 'stock', label: 'สต็อก', icon: 'คลัง' },
  { id: 'procurement', label: 'จัดซื้อ', icon: 'PO' },
  { id: 'reports', label: 'รายงาน', icon: 'BI' },
  { id: 'settings', label: 'Settings', icon: 'Admin' },
];

function getTabFromHash(isAuthenticated: boolean): AppTab {
  const hash = window.location.hash.replace(/^#/, '');
  if (!isAuthenticated || hash.startsWith('login')) return 'login';
  if (hash.startsWith('stock')) return 'stock';
  if (hash.startsWith('procurement')) return 'procurement';
  if (hash.startsWith('reports')) return 'reports';
  if (hash.startsWith('settings')) return 'settings';
  return 'dashboard';
}

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('login');

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setCurrentUser(null);
        setActiveTab('login');
        window.location.hash = '#login';
        setAuthLoading(false);
        return;
      }

      try {
        const response = await authApi.me();
        setCurrentUser(response.data);
        setActiveTab(getTabFromHash(true));
      } catch {
        localStorage.removeItem('token');
        setCurrentUser(null);
        setActiveTab('login');
        window.location.hash = '#login';
      } finally {
        setAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash(Boolean(currentUser)));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentUser]);

  const handleLogin = (token: string, user: AuthUser) => {
    localStorage.setItem('token', token);
    setCurrentUser(user);
    setActiveTab('dashboard');
    window.location.hash = '#dashboard';
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors; client token is authoritative for current session
    } finally {
      localStorage.removeItem('token');
      setCurrentUser(null);
      setActiveTab('login');
      window.location.hash = '#login';
    }
  };

  const page = useMemo(() => {
    if (!currentUser) {
      return <LoginPage onLogin={handleLogin} />;
    }

    switch (activeTab) {
      case 'stock':
        return <StockManagementPage />;
      case 'procurement':
        return <ProcurementPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  }, [activeTab, currentUser]);

  const handleSelectTab = (tab: Exclude<AppTab, 'login'>) => {
    window.location.hash = tab === 'dashboard' ? '#dashboard' : `#${tab}`;
    setActiveTab(tab);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl bg-white px-6 py-4 text-sm text-slate-600 shadow">กำลังตรวจสอบสิทธิ์ผู้ใช้...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">Inventory Procurement</div>
              <h1 className="text-2xl font-bold">ระบบคลังยาและจัดซื้อ</h1>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-slate-500 lg:items-end">
              <div>
                {new Date().toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
              <div className="text-slate-600">
                {currentUser.fullName} ({currentUser.role})
              </div>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="mr-2 text-xs uppercase tracking-[0.2em]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{page}</main>
    </div>
  );
}

export default App;
