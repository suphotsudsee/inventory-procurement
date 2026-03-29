import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProductCatalogManager } from '../components/stock';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { Select } from '../components/common/Select';
import { Loading } from '../components/common/Loading';
import { settingsApi, UserAccount } from '../services/api';

type SettingsTab = 'users' | 'catalog';

type UserFormState = {
  username: string;
  email: string;
  fullName: string;
  role: UserAccount['role'];
  active: boolean;
  password: string;
};

function buildUserFormState(user?: UserAccount): UserFormState {
  return {
    username: user?.username || '',
    email: user?.email || '',
    fullName: user?.fullName || '',
    role: user?.role || 'staff',
    active: user?.active ?? true,
    password: '',
  };
}

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<UserFormState>(buildUserFormState());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['settings-users'],
    queryFn: async () => {
      const response = await settingsApi.getUsers();
      return response.data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['settings-roles'],
    queryFn: async () => {
      const response = await settingsApi.getRoles();
      return response.data;
    },
  });

  const saveUserMutation = useMutation({
    mutationFn: async (payload: UserFormState) => {
      if (editingUser) {
        return settingsApi.updateUser(editingUser.id, {
          username: payload.username.trim(),
          email: payload.email.trim(),
          fullName: payload.fullName.trim(),
          role: payload.role,
          active: payload.active,
          password: payload.password.trim() || undefined,
        });
      }

      return settingsApi.createUser({
        username: payload.username.trim(),
        email: payload.email.trim(),
        fullName: payload.fullName.trim(),
        role: payload.role,
        active: payload.active,
        password: payload.password.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      setShowUserModal(false);
      setEditingUser(null);
      setFormState(buildUserFormState());
      setErrors({});
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
  });

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.role, label: role.role })),
    [roles]
  );

  const openCreateUser = () => {
    setEditingUser(null);
    setShowPassword(false);
    setFormState(buildUserFormState());
    setErrors({});
    setShowUserModal(true);
  };

  const openEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setShowPassword(false);
    setFormState(buildUserFormState(user));
    setErrors({});
    setShowUserModal(true);
  };

  const validateUserForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!formState.username.trim()) nextErrors.username = 'กรุณากรอก username';
    if (!formState.fullName.trim()) nextErrors.fullName = 'กรุณากรอกชื่อผู้ใช้';
    if (!editingUser && !formState.password.trim()) nextErrors.password = 'กรุณากรอกรหัสผ่าน';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateUserForm()) return;
    await saveUserMutation.mutateAsync(formState);
  };

  const handleDeactivateUser = async (user: UserAccount) => {
    if (!window.confirm(`ปิดใช้งานผู้ใช้ ${user.username} ?`)) {
      return;
    }
    await deleteUserMutation.mutateAsync(user.id);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">จัดการผู้ใช้แบบ RBAC และ master data รายการยา</p>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'users', label: 'จัดการผู้ใช้', icon: 'RBAC' },
              { id: 'catalog', label: 'จัดการรายการยา', icon: 'Drug' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">ผู้ใช้งานและสิทธิ์</h3>
              <p className="text-sm text-gray-500">กำหนด role ตาม RBAC: admin, manager, staff, viewer</p>
            </div>
            <Button variant="primary" onClick={openCreateUser}>
              เพิ่มผู้ใช้
            </Button>
          </div>

          {usersLoading ? (
            <Loading message="กำลังโหลดผู้ใช้..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ผู้ใช้</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Permissions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                        <div className="text-xs text-gray-500">{user.username}</div>
                        {user.email && <div className="text-xs text-gray-400">{user.email}</div>}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{user.role}</td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            user.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {user.active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div className="max-w-md whitespace-normal">
                          {user.permissions.join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openEditUser(user)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivateUser(user)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ปิดใช้งาน
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'catalog' && <ProductCatalogManager />}

      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSubmitUser}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Username"
              value={formState.username}
              onChange={(event) => setFormState((value) => ({ ...value, username: event.target.value }))}
              error={errors.username}
            />
            <Input
              label="Email"
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((value) => ({ ...value, email: event.target.value }))}
            />
          </div>

          <Input
            label="ชื่อผู้ใช้"
            value={formState.fullName}
            onChange={(event) => setFormState((value) => ({ ...value, fullName: event.target.value }))}
            error={errors.fullName}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Role"
              options={roleOptions}
              value={formState.role}
              onChange={(event) => setFormState((value) => ({ ...value, role: event.target.value as UserAccount['role'] }))}
            />
            <div className="w-full">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {editingUser ? 'รหัสผ่านใหม่ (ถ้าต้องการเปลี่ยน)' : 'รหัสผ่าน'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formState.password}
                  onChange={(event) => setFormState((value) => ({ ...value, password: event.target.value }))}
                  className={`block w-full rounded-md border px-3 py-2 pr-12 text-sm shadow-sm ${
                    errors.password
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formState.active}
              onChange={(event) => setFormState((value) => ({ ...value, active: event.target.checked }))}
            />
            เปิดใช้งานผู้ใช้
          </label>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            {roles.find((role) => role.role === formState.role)?.permissions.join(', ') || 'ไม่มี permissions'}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowUserModal(false)}>
              ยกเลิก
            </Button>
            <Button variant="primary" type="submit" loading={saveUserMutation.isPending}>
              {editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
