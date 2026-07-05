import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Loader2, Coins, ShieldCheck, Target } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    setIsLoading(true);

    try {
      await register(email.trim().toLowerCase(), password, fullName.trim() || undefined);
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registrasi gagal. Silakan coba lagi.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-grid lg:grid-cols-[1fr_440px]">
        <section className="auth-side-panel hidden lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Life OS</p>
              <h1 className="text-2xl font-bold text-slate-800">Mulai bangun sistem hidup yang tercatat</h1>
            </div>
          </div>
          <div className="mt-10 grid gap-4">
            {[
              { icon: Target, title: 'Target dan tugas', text: 'Buat target besar lalu pecah menjadi aksi yang bisa diselesaikan.' },
              { icon: Coins, title: 'Koin dan XP', text: 'Dapatkan hadiah dari tingkat kesulitan, kebiasaan, dan target yang selesai.' },
              { icon: ShieldCheck, title: 'Data terstruktur', text: 'Waktu, keuangan, dan produktivitas dicatat dengan alur yang konsisten.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="modern-panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="w-full">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <Sparkles className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-800">Life OS</h1>
          </div>

          <Card className="border-slate-200 bg-[#F8FAFC]/90">
          <CardHeader>
            <CardTitle className="text-slate-800">Daftar Akun</CardTitle>
            <CardDescription className="text-slate-500">
              Buat akun Life OS baru
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-600">Nama lengkap</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Nama Anda"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-600">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-600">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-600">Konfirmasi password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="******"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="placeholder:text-slate-400"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Daftar
              </Button>
              <p className="text-sm text-slate-500">
                Sudah punya akun?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:underline">
                    Masuk
                </Link>
              </p>
            </CardFooter>
          </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
