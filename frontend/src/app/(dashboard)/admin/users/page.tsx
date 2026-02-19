'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ROLES = ['ADMIN', 'ORGANIZER', 'TEAM_MANAGER'];

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<UsersResponse | User[]>(`/users?page=${page}&limit=${limit}`);
      if (Array.isArray(res)) {
        setUsers(res);
        setTotal(res.length);
        setTotalPages(1);
      } else {
        setUsers(res.data ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      await apiPatch(`/users/${userId}`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success('Role updated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      toast.error(message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    setUpdatingUserId(userId);
    try {
      await apiPatch(`/users/${userId}`, { isActive: !currentActive });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isActive: !currentActive } : u
        )
      );
      toast.success(`User ${!currentActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update user status';
      toast.error(message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
        <Card className="p-6">
          <p className="text-red-600">Error: {error}</p>
          <Button className="mt-4" onClick={fetchUsers}>Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
        <p className="text-sm text-slate-400">{total} total users</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/60 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-slate-100">{user.firstName} {user.lastName}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-300">{user.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={updatingUserId === user.id}
                      className="w-40"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button
                      variant={user.isActive ? 'destructive' : 'default'}
                      size="sm"
                      disabled={updatingUserId === user.id}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                    >
                      {updatingUserId === user.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : user.isActive ? (
                        'Deactivate'
                      ) : (
                        'Activate'
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="p-8 text-center text-slate-500">No users found.</div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
