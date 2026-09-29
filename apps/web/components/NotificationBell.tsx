'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getNotifications, type NotificationItem } from '../lib/api';
import { getSessionUser } from '../lib/auth';

const POLL_MS = 45000;

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const list: NotificationItem[] = await getNotifications();
      setUnread(list.filter((n) => !n.isRead).length);
    } catch {
      /* abaikan error polling */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!getSessionUser()) return;
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <Link
      href="/notifications"
      aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ''}`}
      className="relative inline-flex items-center border-[3px] border-white bg-white/10 px-2.5 py-1.5 text-sm font-black text-white"
    >
      <span aria-hidden>🔔</span>
      {unread > 0 && (
        <span className="absolute -top-2 -right-2 min-w-5 border-2 border-black bg-[#FF007A] px-1 text-center text-[10px] font-black text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}
