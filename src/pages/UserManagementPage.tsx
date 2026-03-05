import { useState, useEffect, useMemo } from 'react';
import { Search, Lock } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime } from '../lib/format';
import { trackEvent } from '../lib/analytics';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Badge from '../components/shared/Badge';
import type { User, UserRole } from '../lib/types';

const ROLES: UserRole[] = ['viewer', 'editor', 'admin'];

const ROLE_LABELS: Record<UserRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin: 'Admin',
};

function UserAvatar({ user }: { user: User }) {
  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  if (user.photoUrl) {
    return (
      <img
        src={user.photoUrl}
        alt={user.displayName}
        className="h-9 w-9 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
      {initials}
    </div>
  );
}

function RoleSelector({
  user,
  currentUserId,
  isLastAdmin,
  onRoleChange,
}: {
  user: User;
  currentUserId: string;
  isLastAdmin: boolean;
  onRoleChange: (userId: string, newRole: UserRole, oldRole: UserRole) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const isSelf = user.id === currentUserId;
  const isOnlyAdmin = isLastAdmin && user.role === 'admin';
  const disabled = isSelf || isOnlyAdmin;

  const handleClick = async (role: UserRole) => {
    if (disabled || role === user.role || loading) return;
    setLoading(true);
    try {
      await onRoleChange(user.id, role, user.role);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-white">
      {ROLES.map((role) => {
        const isActive = user.role === role;
        const isLockedAdmin = isOnlyAdmin && role === 'admin';

        let title: string | undefined;
        if (isSelf) title = 'You cannot change your own role.';
        else if (isLockedAdmin) title = 'At least one admin must remain.';

        return (
          <button
            key={role}
            onClick={() => handleClick(role)}
            disabled={disabled || loading}
            title={title}
            className={`relative flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
              isActive
                ? 'bg-indigo-600 text-white'
                : disabled
                  ? 'cursor-not-allowed bg-white text-gray-400 opacity-50'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {loading && !isActive ? (
              <LoadingSpinner inline className="h-3.5 w-3.5" />
            ) : (
              <>
                {isLockedAdmin && <Lock className="h-3 w-3" />}
                {ROLE_LABELS[role]}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    trackEvent('user_management_viewed');
  }, []);

  useEffect(() => {
    api.users
      .list()
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);
  const isLastAdmin = adminCount <= 1;

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleRoleChange = async (userId: string, newRole: UserRole, oldRole: UserRole) => {
    try {
      const res = await api.users.updateRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? res.user : u)),
      );
      trackEvent('user_role_changed', {
        target_user_id: userId,
        old_role: oldRole,
        new_role: newRole,
      });
      setToast({ message: `Role updated to ${ROLE_LABELS[newRole]}`, type: 'success' });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setToast({ message: 'You cannot change your own role.', type: 'error' });
        } else if (err.status === 409) {
          setToast({
            message: 'At least one admin must remain. Assign another admin first.',
            type: 'error',
          });
        } else {
          setToast({ message: 'Failed to update role. Please try again.', type: 'error' });
        }
      } else {
        setToast({ message: 'Failed to update role. Please try again.', type: 'error' });
      }
      throw err;
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage access roles for all DST users. Role changes take effect on the user's next page
          load.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role Last Changed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr
                  key={u.id}
                  className={isSelf ? 'bg-indigo-50/40' : undefined}
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={u} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {u.displayName}
                          </span>
                          {isSelf && (
                            <Badge variant="info">You</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <RoleSelector
                      user={u}
                      currentUserId={currentUser?.id ?? ''}
                      isLastAdmin={isLastAdmin}
                      onRoleChange={handleRoleChange}
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDateTime(u.lastLogin)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {u.updatedAt ? (
                      <div>
                        <span>{formatDateTime(u.updatedAt)}</span>
                        {u.updatedBy && (
                          <p className="text-xs text-gray-400">by {u.updatedBy}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
