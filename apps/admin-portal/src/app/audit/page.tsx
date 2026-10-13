'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Card } from '@repo/ui';
import type { AdminAuditLogListItemDto, AdminAuditLogDetailDto } from '@repo/api-contracts';
import { getAdminAuditLogs, getAdminAuditLogDetail } from '../../lib/api';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AdminAuditLogListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [actorRoleFilter, setActorRoleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Inspector modal state
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<AdminAuditLogDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminAuditLogs({
        search: searchQuery.trim() || undefined,
        actorRole: actorRoleFilter === 'ALL' ? undefined : actorRoleFilter,
        action: actionFilter.trim() || undefined,
        resourceType: resourceTypeFilter.trim() || undefined,
        page,
        limit: 25,
      });
      setLogs(res.items);
      setTotalLogs(res.meta.total);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to query immutable audit log records');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, actorRoleFilter, actionFilter, resourceTypeFilter, page]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleInspect = async (id: string) => {
    setSelectedLogId(id);
    try {
      setDetailLoading(true);
      const data = await getAdminAuditLogDetail(id);
      setLogDetail(data);
    } catch {
      setLogDetail(null);
    } finally {
      setDetailLoading(false);
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
              Immutable Platform Audit Log
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Append-only compliance ledger recording every administrative mutation, verification
              decision, and operational event.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadAuditLogs()} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Log'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Audit Query Failure
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-stone-900 border-stone-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Search Keywords</label>
            <input
              type="text"
              placeholder="Action, resource, actor ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Actor Role</label>
            <select
              value={actorRoleFilter}
              onChange={(e) => {
                setActorRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="MARKETPLACE_MANAGER">MARKETPLACE_MANAGER</option>
              <option value="FINANCE_CONTROLLER">FINANCE_CONTROLLER</option>
              <option value="TRUST_SAFETY">TRUST_SAFETY</option>
              <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT</option>
              <option value="SELLER">SELLER</option>
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Action Type</label>
            <input
              type="text"
              placeholder="e.g. ORDER_PLACED, REVIEW_DECISION..."
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Resource Type</label>
            <input
              type="text"
              placeholder="e.g. CUSTOMER_ORDER, SELLER_PROFILE..."
              value={resourceTypeFilter}
              onChange={(e) => {
                setResourceTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="bg-stone-900 border-stone-800 overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Security & Operational Events ({totalLogs})
          </h2>
          <span className="text-xs text-stone-400">Page {page} &bull; Append-Only Register</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400 text-xs">
            Querying audit logs from PostgreSQL database...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-xs">
            No audit events match given filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Actor Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource Target</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-4">Origin IP</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-4 text-stone-400 whitespace-nowrap text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded bg-stone-800 text-[11px] font-semibold text-amber-300 border border-stone-700">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white font-sans">{log.action}</td>
                    <td className="py-3 px-4 text-stone-200">
                      <div>{log.resourceType}</div>
                      <div
                        className="text-[10px] text-stone-500 truncate max-w-[120px]"
                        title={log.resourceId ?? ''}
                      >
                        {log.resourceId ? `${log.resourceId.slice(0, 8)}...` : '-'}
                      </div>
                    </td>
                    <td
                      className="py-3 px-4 text-stone-400 text-[11px] truncate max-w-[100px]"
                      title={log.actorId ?? ''}
                    >
                      {log.actorId ? `${log.actorId.slice(0, 8)}...` : 'ANONYMOUS'}
                    </td>
                    <td className="py-3 px-4 text-stone-400 text-[11px]">{log.ipAddress || '-'}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <Button variant="secondary" size="sm" onClick={() => handleInspect(log.id)}>
                        Inspect &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Inspector Drawer */}
      {selectedLogId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
          <div className="w-full max-w-xl bg-stone-900 border-l border-stone-800 h-full p-6 overflow-y-auto space-y-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3 className="text-base font-bold">Immutable Audit Record Inspector</h3>
                <p className="text-xs text-stone-400 font-mono">ID: {selectedLogId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedLogId(null);
                  setLogDetail(null);
                }}
                className="text-stone-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                Loading immutable state telemetry...
              </div>
            ) : logDetail ? (
              <div className="space-y-4 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3 bg-stone-950 p-4 rounded-lg border border-stone-800 font-mono">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans">
                      Action
                    </span>
                    <span className="font-bold text-amber-400">{logDetail.action}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans">
                      Actor Role
                    </span>
                    <span className="font-semibold text-white">{logDetail.actorRole}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans">
                      Resource Type
                    </span>
                    <span className="text-stone-300">{logDetail.resourceType}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans">
                      Resource ID
                    </span>
                    <span className="text-stone-300 text-[11px] break-all">
                      {logDetail.resourceId || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans">
                      Actor ID
                    </span>
                    <span className="text-stone-300 text-[11px] break-all">
                      {logDetail.actorId || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-sans">
                      IP Address
                    </span>
                    <span className="text-stone-300">{logDetail.ipAddress || 'Not recorded'}</span>
                  </div>
                </div>

                {/* Metadata JSON */}
                <div>
                  <h4 className="text-xs uppercase font-semibold text-stone-400 tracking-wider mb-1">
                    Event Metadata Payload
                  </h4>
                  <pre className="p-3 bg-stone-950 rounded border border-stone-800 font-mono text-[11px] text-amber-300 overflow-x-auto max-h-40">
                    {JSON.stringify(logDetail.metadata ?? {}, null, 2)}
                  </pre>
                </div>

                {/* Before State */}
                {logDetail.beforeState && (
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-stone-400 tracking-wider mb-1">
                      Before Mutation State
                    </h4>
                    <pre className="p-3 bg-stone-950 rounded border border-stone-800 font-mono text-[11px] text-stone-300 overflow-x-auto max-h-40">
                      {JSON.stringify(logDetail.beforeState, null, 2)}
                    </pre>
                  </div>
                )}

                {/* After State */}
                {logDetail.afterState && (
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-stone-400 tracking-wider mb-1">
                      After Mutation State
                    </h4>
                    <pre className="p-3 bg-stone-950 rounded border border-stone-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-40">
                      {JSON.stringify(logDetail.afterState, null, 2)}
                    </pre>
                  </div>
                )}

                {logDetail.userAgent && (
                  <div className="pt-2 text-[10px] text-stone-500 font-mono">
                    User-Agent: {logDetail.userAgent}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-500">Failed to load audit record detail.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
