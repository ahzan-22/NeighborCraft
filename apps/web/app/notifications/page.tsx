'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getNotifications,
  markNotificationRead,
  type NotificationItem,
} from '../../lib/api';
import { getSessionUser, type SessionUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

const neoCard = 'border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]';
const neoCardSm = 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const neoBtn =
  'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black uppercase';

const TYPE_META: Record<string, { label: string; warna: string }> = {
  ORDER_CREATED: { label: 'Pesanan Baru', warna: 'bg-[#FFE600]' },
  ORDER_STATUS: { label: 'Status Pesanan', warna: 'bg-[#0052FF] text-white' },
  REVIEW: { label: 'Ulasan Baru', warna: 'bg-[#00E676]' },
  ORDER: { label: 'Pesanan', warna: 'bg-[#FFE600]' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    setToastKind(kind);
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      const session = getSessionUser();
      await Promise.resolve();
      if (!alive) return;
      setUser(session);
      setChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      setItems(await getNotifications());
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat notifikasi', 'error');
    }
  }, []);

  useEffect(() => {
    if (!checked || !user) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [checked, user, load]);

  const open = async (n: NotificationItem) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Gagal menandai notifikasi', 'error');
      }
    }
    await load();
    // ORDER_CREATED adalah sisi penyedia → buka daftar pesanan masuknya.
    router.push(n.type === 'ORDER_CREATED' ? '/dashboard/provider' : '/dashboard/orders');
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <p className={`${neoCardSm} bg-[#FFE600] px-6 py-4 font-black uppercase text-sm`}>Memuat Notifikasi...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className={`bg-white p-8 max-w-md text-center ${neoCard}`}>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-black uppercase">Masuk Dulu</h1>
          <Link href="/" className={`${neoBtn} mt-4 inline-block bg-black text-[#FFE600] px-6 py-3 text-xs`}>
            ← Masuk / Daftar
          </Link>
        </div>
      </div>
    );
  }

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <main className="mx-auto max-w-4xl px-4 pb-16">
        <h1 className="pt-4 text-2xl font-black uppercase">
          🔔 <span className="bg-[#FFE600] px-1">Notifikasi</span>
        </h1>

        {toast && (
          <p className={`${neoCardSm} mt-4 ${toastKind === 'error' ? 'bg-[#FF007A] text-white' : 'bg-[#00E676]'} px-4 py-2 text-xs font-black uppercase`}>
            {toast}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase opacity-70">
            Total: {items.length} • Belum dibaca: {unread}
          </p>
          <button onClick={() => void load()} className={`${neoBtn} px-3 py-2 text-xs bg-[#0052FF] text-white`}>
            ↻ Muat Ulang
          </button>
        </div>

        {items.length === 0 && (
          <p className={`mt-6 bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>
            Belum ada notifikasi
          </p>
        )}

        <section className="mt-6 space-y-2">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? { label: n.type, warna: 'bg-white' };
            return (
              <button
                key={n.id}
                onClick={() => void open(n)}
                className={`w-full text-left bg-white p-3 flex flex-wrap items-center justify-between gap-2 ${neoCardSm} ${n.isRead ? 'opacity-60' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black ${meta.warna}`}>
                      {meta.label}
                    </span>
                    <p className="font-black uppercase text-sm">{n.title}</p>
                    {!n.isRead && <span className="text-[10px] font-black uppercase bg-[#FF007A] text-white px-1.5 py-0.5 border-2 border-black">Baru</span>}
                  </div>
                  <p className="text-xs font-bold opacity-70 mt-1">{n.message}</p>
                  <p className="text-[10px] font-black uppercase opacity-50 mt-1">{new Date(n.createdAt).toLocaleString('id-ID')}</p>
                </div>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
