import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import AppTextTranslator from '@/components/AppTextTranslator';
import { Toaster } from '@/components/ui/sonner';

import LoadingState from '@/components/LoadingState';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Finance = lazy(() => import('@/pages/Finance'));
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));
const Partner = lazy(() => import('@/pages/Partner'));
const Productivity = lazy(() => import('@/pages/Productivity'));
const Profile = lazy(() => import('@/pages/Profile'));
const Register = lazy(() => import('@/pages/Register'));

function PageFallback() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <LoadingState label="Memuat halaman..." />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppTextTranslator />
          <Suspense fallback={<PageFallback />}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/home" element={<Home />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/productivity" element={<Productivity />} />
              <Route path="/partner" element={<Partner />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
