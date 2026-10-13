'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, LoadingSpinner, EmptyState } from '@repo/ui';
import { getSellerNotifications } from '../../lib/api';
import type { SellerNotificationDto } from '@repo/api-contracts';

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = useState<SellerNotificationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getSellerNotifications()
      .then((data) => {
        if (isMounted) {
          setNotifications(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
            Studio Notifications & Alerts
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Important notices regarding order fulfillment, stock alerts, and financial settlements.
          </p>
        </div>

        {notifications.some((n) => !n.isRead) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark All as Read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-28">
          <LoadingSpinner size="lg" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You are all caught up! No active studio alerts at this time."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`p-5 transition-all ${
                notif.isRead
                  ? 'bg-white border-stone-200'
                  : 'bg-amber-50/40 border-amber-300 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">
                    {notif.type === 'ORDER'
                      ? '🛒'
                      : notif.type === 'STOCK'
                        ? '📦'
                        : notif.type === 'PRODUCT'
                          ? '🏺'
                          : '📢'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-900">{notif.title}</h3>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-600" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-stone-600 mt-1">{notif.message}</p>
                    <span className="text-[11px] text-stone-400 mt-2 block">
                      {new Date(notif.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge
                    variant={
                      notif.type === 'STOCK'
                        ? 'warning'
                        : notif.type === 'ORDER'
                          ? 'default'
                          : 'default'
                    }
                    size="sm"
                  >
                    {notif.type}
                  </Badge>

                  {notif.actionUrl && (
                    <Link
                      href={notif.actionUrl}
                      className="text-xs font-semibold text-amber-800 hover:text-amber-900 hover:underline mt-1"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
