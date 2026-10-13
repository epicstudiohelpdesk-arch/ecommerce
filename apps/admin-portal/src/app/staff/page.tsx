'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { AdminStaffUserDto } from '@repo/api-contracts';
import type { AdminStaffQuery, CreateStaffUserInput } from '@repo/validation';
import { getAdminStaff, createAdminStaff, updateAdminStaffStatus } from '../../lib/api';

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<AdminStaffUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createRole, setCreateRole] = useState<CreateStaffUserInput['role']>('CUSTOMER_SUPPORT');
  const [creating, setCreating] = useState(false);

  // Status toggle modal state
  const [selectedStaffUser, setSelectedStaffUser] = useState<AdminStaffUserDto | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminStaff({
        search: searchQuery.trim() || undefined,
        role: roleFilter === 'ALL' ? undefined : (roleFilter as AdminStaffQuery['role']),
        status: statusFilter === 'ALL' ? undefined : (statusFilter as AdminStaffQuery['status']),
      });
      setStaffList(res.items);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load platform staff accounts');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword || !createFirstName || !createLastName) {
      alert('All fields are required to provision an operational staff account.');
      return;
    }

    try {
      setCreating(true);
      setFeedbackMessage(null);
      await createAdminStaff({
        email: createEmail.trim(),
        password: createPassword,
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        role: createRole,
      });

      setFeedbackMessage(`Staff account created for "${createEmail}" with role ${createRole}.`);
      setShowCreateModal(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateFirstName('');
      setCreateLastName('');
      await loadStaff();
    } catch (err: unknown) {
      alert(`Staff provisioning failed: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE') => {
    if (!selectedStaffUser) return;
    if (newStatus !== 'ACTIVE' && (!statusReason || statusReason.length < 5)) {
      alert(
        'A detailed reason note of at least 5 characters is required when altering staff account status.',
      );
      return;
    }

    try {
      setUpdatingStatus(true);
      setFeedbackMessage(null);
      await updateAdminStaffStatus(selectedStaffUser.id, {
        status: newStatus === 'INACTIVE' ? 'DEACTIVATED' : newStatus,
        reason: statusReason || 'Operational staff administrative review',
      });

      setFeedbackMessage(`Status for "${selectedStaffUser.email}" updated to ${newStatus}.`);
      setSelectedStaffUser(null);
      setStatusReason('');
      await loadStaff();
    } catch (err: unknown) {
      alert(`Status update failed: ${(err as Error).message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getRoleBadge = (roles: string[]) => {
    const role = roles[0] || 'CUSTOMER_SUPPORT';
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge variant="destructive">{role}</Badge>;
      case 'MARKETPLACE_MANAGER':
        return <Badge variant="warning">{role}</Badge>;
      case 'FINANCE_CONTROLLER':
        return <Badge variant="success">{role}</Badge>;
      case 'TRUST_SAFETY':
        return <Badge variant="destructive">{role}</Badge>;
      case 'CUSTOMER_SUPPORT':
        return <Badge variant="info">{role}</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">ACTIVE</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">SUSPENDED</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-xs font-semibold text-amber-500 hover:text-amber-400 mb-2 inline-block"
        >
          &larr; Back to Platform Overview
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Staff Accounts & Privilege Separation
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Internal agency operational accounts, RBAC permission roles, MFA enforcement, and
              account suspension controls.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            + Provision Staff User
          </Button>
        </div>
      </div>

      {feedbackMessage && (
        <Card className="bg-emerald-950/40 border-emerald-800 text-emerald-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>✓</span> Action Recorded
          </div>
          <p className="text-sm mt-1">{feedbackMessage}</p>
        </Card>
      )}

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Query Failure
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-stone-900 border-stone-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Search Staff</label>
            <input
              type="text"
              placeholder="Name or email address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Staff Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Operational Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="MARKETPLACE_MANAGER">MARKETPLACE_MANAGER</option>
              <option value="FINANCE_CONTROLLER">FINANCE_CONTROLLER</option>
              <option value="TRUST_SAFETY">TRUST_SAFETY</option>
              <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT</option>
              <option value="READ_ONLY_ANALYST">READ_ONLY_ANALYST</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Account Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Staff Table */}
      <Card className="bg-stone-900 border-stone-800 overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Privileged Platform Staff Directory ({staffList.length})
          </h2>
          <span className="text-xs text-stone-400">
            Strict SuperAdmin privilege separation enforced
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400 text-xs">
            Querying platform staff directory...
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-xs">
            No staff accounts match filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role Privileges</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">MFA Guard</th>
                  <th className="py-3 px-4">Provisioned Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {staffList.map((user) => (
                  <tr key={user.id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans font-semibold text-white">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="py-3 px-4 text-amber-400">{user.email}</td>
                    <td className="py-3 px-4 font-sans">{getRoleBadge(user.roles)}</td>
                    <td className="py-3 px-4 font-sans">{getStatusBadge(user.status)}</td>
                    <td className="py-3 px-4 font-sans">
                      {user.mfaEnabled ? (
                        <span className="text-emerald-400 font-semibold text-[11px]">
                          ✓ Enforced
                        </span>
                      ) : (
                        <span className="text-stone-500 text-[11px]">Pending Setup</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-400 text-[11px]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedStaffUser(user);
                          setStatusReason('');
                        }}
                      >
                        Modify Status
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Provision Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-base">Provision New Operational Staff User</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-400 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={createFirstName}
                    onChange={(e) => setCreateFirstName(e.target.value)}
                    className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={createLastName}
                    onChange={(e) => setCreateLastName(e.target.value)}
                    className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Operational Email</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="staff.name@marketplace.internal"
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Min 8 characters, letters & symbols"
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Assigned Operational Role</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as CreateStaffUserInput['role'])}
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="CUSTOMER_SUPPORT">
                    CUSTOMER_SUPPORT (Orders, customer issues)
                  </option>
                  <option value="TRUST_SAFETY">
                    TRUST_SAFETY (KYC review, listing moderation)
                  </option>
                  <option value="FINANCE_CONTROLLER">
                    FINANCE_CONTROLLER (Financial ledger, reconciliation)
                  </option>
                  <option value="MARKETPLACE_MANAGER">
                    MARKETPLACE_MANAGER (General operations, shipments)
                  </option>
                  <option value="READ_ONLY_ANALYST">READ_ONLY_ANALYST (Audit logs, metrics)</option>
                  <option value="SUPER_ADMIN">
                    SUPER_ADMIN (Full unrestricted system control)
                  </option>
                </select>
              </div>

              <div className="pt-4 border-t border-stone-800 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={creating}>
                  {creating ? 'Provisioning...' : 'Confirm Provisioning'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Modification Modal */}
      {selectedStaffUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-base">Modify Status for {selectedStaffUser.email}</h3>
              <button
                onClick={() => setSelectedStaffUser(null)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-stone-300">
                Current Status: <strong>{selectedStaffUser.status}</strong> &bull; Role:{' '}
                <strong>{selectedStaffUser.roles[0]}</strong>
              </p>

              <div>
                <label className="block text-stone-400 mb-1">
                  Reason for status modification (Required for audit compliance):
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Enter detailed audit rationale for this change..."
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-stone-800 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedStaffUser(null)}>
                  Cancel
                </Button>
                {selectedStaffUser.status !== 'ACTIVE' && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus('ACTIVE')}
                  >
                    Activate Account
                  </Button>
                )}
                {selectedStaffUser.status !== 'SUSPENDED' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus('SUSPENDED')}
                  >
                    Suspend Account
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
