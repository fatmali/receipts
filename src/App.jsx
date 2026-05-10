import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { initNotifications } from './lib/notifications';
import SetupScreen from './auth/SetupScreen';
import LockScreen from './auth/LockScreen';
import BottomTabBar from './components/BottomTabBar';
import OfflineBanner from './components/OfflineBanner';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import OverviewTab from './components/overview/OverviewTab';
import BudgetTab from './components/categories/BudgetTab';
import TransactionsTab from './components/transactions/TransactionsTab';
import CoachTab from './components/coach/CoachTab';
import SettingsScreen from './components/settings/SettingsScreen';

function MainApp() {
  useEffect(() => {
    initNotifications();
    const onVisible = () => {
      if (document.visibilityState === 'visible') initNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <div className="min-h-screen pb-20">
      <OfflineBanner />
      <InstallPrompt />
      <UpdatePrompt />
      <Routes>
        <Route path="/overview" element={<OverviewTab />} />
        <Route path="/categories" element={<BudgetTab />} />
        <Route path="/transactions" element={<TransactionsTab />} />
        <Route path="/coach" element={<CoachTab />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
      <BottomTabBar />
    </div>
  );
}

function AppGate() {
  const { isSetup, isUnlocked } = useAuth();

  if (!isSetup) return <SetupScreen />;
  if (!isUnlocked) return <LockScreen />;
  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
