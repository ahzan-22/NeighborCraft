'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  createReview,
  getUserOrders,
  updateOrderStatusFull,
  type Order,
} from '../../../lib/api';
import { getSessionUser, type SessionUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

const neoCard = 'border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]';
const neoCardSm = 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const neoBtn =
  'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black uppercase';
const neoInput =
  'border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-[#FFE600]/30 placeholder:text-black/40 font-bold';

const STATUS_META: Record<string, { label: string; warna: string; step: number }> = {
  PENDING: { label: 'Menunggu Konfirmasi', warna: 'bg-[#FFE600]', step: 1 },
  CONFIRMED: { label: 'Diterima Penyedia', warna: 'bg-[#00E676]', step: 2 },
  IN_PROGRESS: { label: 'Sedang Dikerjakan', warna: 'bg-[#0052FF] text-white', step: 3 },
  COMPLETED: { label: 'Selesai', warna: 'bg-black text-white', step: 4 },
  CANCELLED: { label: 'Dibatalkan', warna: 'bg-[#FF007A] text-white', step: 0 },
};

const STEPS = ['Pesanan Dibuat', 'Diterima', 'Dikerjakan', 'Selesai'];

function hasReview(order: Order): boolean {
  return Boolean(order.review);
}

export default function MyOrdersPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'success' | 'error'>('success');
  const [reviewing, setReviewing] = useState<Order | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

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

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      setOrders(await getUserOrders(user.id));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat pesanan', 'error');
    }
  }, [user]);

  useEffect(() => {
    if (!checked || !user) return;
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [checked, user, loadOrders]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => void loadOrders(), 30000);
    return () => window.clearInterval(timer);
  }, [user, loadOrders]);

  const openReview = (order: Order) => {
    setReviewing(order);
    setRating(0);
    setComment('');
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing || !user) return;
    if (rating < 1 || rating > 5) {
      showToast('Pilih rating bintang 1-5', 'error');
      return;
    }
    setSavingReview(true);
    try {
      await createReview({
        rating,
        comment: comment.trim() === '' ? undefined : comment,
        serviceId: reviewing.serviceId,
        userId: user.id,
        orderId: reviewing.id,
      });
      setReviewing(null);
      await loadOrders();
      showToast('Ulasan terkirim, terima kasih!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim ulasan', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  const cancelOrder = async (order: Order) => {
    const reason = window.prompt('Alasan pembatalan pesanan:');
    if (reason === null) return;
    if (reason.trim() === '') {
      showToast('Alasan pembatalan wajib diisi', 'error');
      return;
    }
    setBusyOrderId(order.id);
    try {
      await updateOrderStatusFull(order.id, 'CANCELLED', reason);
      await loadOrders();
      showToast('Pesanan dibatalkan');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal membatalkan pesanan', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <p className={`${neoCardSm} bg-[#FFE600] px-6 py-4 font-black uppercase text-sm`}>
          Memuat Pesanan Saya...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className={`bg-white p-8 max-w-md text-center ${neoCard}`}>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-black uppercase">Masuk Dulu</h1>
          <p className="mt-2 text-sm font-bold opacity-70">
            Halaman pesanan hanya untuk pengguna yang sudah masuk.
          </p>
          <Link href="/" className={`${neoBtn} mt-4 inline-block bg-black text-[#FFE600] px-6 py-3 text-xs`}>
            ← Masuk / Daftar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <main className="mx-auto max-w-4xl px-4 pb-16">
        <h1 className="pt-4 text-2xl font-black uppercase">
          📦 Pesanan <span className="bg-[#FFE600] px-1">Saya</span>
        </h1>

        {toast && (
          <p className={`${neoCardSm} mt-4 ${toastKind === 'error' ? 'bg-[#FF007A] text-white' : 'bg-[#00E676]'} px-4 py-2 text-xs font-black uppercase`}>
            {toast}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void loadOrders()} className={`${neoBtn} px-3 py-2 text-xs bg-[#0052FF] text-white`}>
            ↻ Muat Ulang
          </button>
          <p className="text-[11px] font-black uppercase opacity-60 self-center">
            Progres diperbarui otomatis tiap 30 detik
          </p>
        </div>

        {orders.length === 0 && (
          <p className={`mt-6 bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>
            Belum ada pesanan. <Link href="/services" className="underline">Cari jasa</Link> sekarang.
          </p>
        )}

        <section className="mt-6 space-y-4">
          {orders.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, warna: 'bg-white', step: 0 };
            const reviewed = hasReview(o);
            return (
              <div key={o.id} className={`bg-white p-4 ${neoCardSm}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black uppercase text-sm">
                    {o.service?.name ?? 'Jasa'} — {o.service?.skill ?? o.serviceId}
                  </p>
                  <span className={`text-[11px] font-black uppercase px-2 py-1 border-2 border-black ${meta.warna}`}>
                    {meta.label}
                  </span>
                </div>

                {o.status !== 'CANCELLED' && (
                  <div className="mt-3 grid grid-cols-4 gap-1">
                    {STEPS.map((label, idx) => {
                      const done = meta.step >= idx + 1;
                      return (
                        <div key={label} className={`text-center px-1 py-2 border-2 border-black ${done ? 'bg-[#00E676]' : 'bg-white opacity-50'}`}>
                          <p className="text-[10px] font-black uppercase leading-tight">{label}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 grid sm:grid-cols-2 gap-1 text-xs font-bold opacity-80">
                  <p>🏠 Alamat: {o.deliveryAddress || '—'}</p>
                  <p>📞 {o.customerPhone || '—'}</p>
                  {o.notes && <p className="sm:col-span-2">📝 Catatan: {o.notes}</p>}
                  {o.cancelReason && <p className="sm:col-span-2">❌ Alasan batal: {o.cancelReason}</p>}
                  {o.completedAt && <p className="sm:col-span-2">✅ Selesai: {new Date(o.completedAt).toLocaleString('id-ID')}</p>}
                  <p className="sm:col-span-2">📅 Dibuat: {new Date(o.createdAt).toLocaleString('id-ID')}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(o.status === 'PENDING' || o.status === 'CONFIRMED') && (
                    <button
                      disabled={busyOrderId === o.id}
                      onClick={() => cancelOrder(o)}
                      className={`${neoBtn} bg-[#FF007A] text-white px-3 py-2 text-xs disabled:opacity-50`}
                    >
                      Batalkan Pesanan ✕
                    </button>
                  )}
                  {o.status === 'COMPLETED' && !reviewed && (
                    <button onClick={() => openReview(o)} className={`${neoBtn} bg-[#FFE600] text-black px-3 py-2 text-xs`}>
                      ⭐ Beri Ulasan & Bintang
                    </button>
                  )}
                  {o.status === 'COMPLETED' && reviewed && (
                    <span className="text-[11px] font-black uppercase opacity-60 self-center">✓ Ulasan sudah dikirim</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReviewing(null)}>
          <div className={`w-full max-w-md bg-[#FAF8F5] p-6 ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black uppercase">Beri Ulasan & Bintang</h3>
              <button onClick={() => setReviewing(null)} className={`${neoBtn} bg-[#FF007A] text-white px-2 py-1 text-xs`}>
                ✕
              </button>
            </div>
            <form onSubmit={submitReview} className="space-y-3">
              <p className="text-xs font-black uppercase">Jasa: {reviewing.service?.name ?? reviewing.serviceId}</p>
              <div>
                <p className="text-xs font-black uppercase">Rating</p>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} bintang`}
                      className={`text-3xl ${n <= rating ? 'grayscale-0' : 'grayscale'}`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <p className="text-xs font-black opacity-60">{rating > 0 ? `${rating}/5` : 'Belum dipilih'}</p>
              </div>
              <div>
                <label className="text-xs font-black uppercase">Ulasan (opsional)</label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                  placeholder="Bagaimana pengalaman Anda dengan jasa ini?"
                />
              </div>
              <button type="submit" disabled={savingReview} className={`${neoBtn} w-full py-3 text-sm bg-[#FFE600] text-black disabled:opacity-50`}>
                {savingReview ? 'Mengirim...' : 'Kirim Ulasan →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
