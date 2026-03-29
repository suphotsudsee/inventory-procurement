import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { authApi, AuthUser } from '../services/api';

interface LoginPageProps {
  onLogin: (token: string, user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authApi.login({ username, password });
      onLogin(response.data.token, response.data.user);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'ไม่สามารถเข้าสู่ระบบได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">Inventory Procurement</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-slate-500">ใช้บัญชีผู้ใช้ในระบบเพื่อเข้าใช้งานคลังยาและจัดซื้อ</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <Button type="submit" variant="primary" loading={loading} className="w-full">
            เข้าสู่ระบบ
          </Button>
        </form>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          ค่าเริ่มต้น: <span className="font-medium text-slate-700">admin / admin123</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
