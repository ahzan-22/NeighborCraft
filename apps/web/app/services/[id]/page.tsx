'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiFetch,
  createOrder,
  getServiceReviews,
  type Review,
  type Service,
} from '../../../lib/api';
import { getSessionUser, type SessionUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

const neoCard = 'border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]';
const neoCardSm = 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const neoBtn =
  'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black uppercase';
const neoInput =
  'border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-[#FFE600]/30 placeholder:text-black/40 font-bold';

const PRICE_TYPE_LABEL: Record<string, string> = {
  FIXED: 'Harga Tetap',
  HOURLY: 'Per Jam',
  ESTIMATE: 'Estimasi',
};

function formatPrice(price?: number | null) {
  if (price === undefined || price === null) return 'Harga hubungi penyedia';
  return `Rp${Number(price).toLocaleString('id-ID')}`;
}

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} dari 5 bintang`}>{'⭐'.repeat(Math.max(0, Math.min(5, Math.round(value))))}</span>;
}

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
      const res = await apiFetch(`/services/${id}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Gagal memuat detail jasa');
      setService((await res.json()) as Service);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat detail jasa', 'error');
    }
    try {
      setReviews(await getServiceReviews(id));
    } catch {
      setReviews([]);
    }
  }, [id]);

  useEffect(() => {
    if (!checked) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [checked, load]);

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Masuk terlebih dahulu untuk memesan jasa', 'error');
      return;
    }
    if (!service) return;
    if (deliveryAddress.trim() === '' || customerPhone.trim() === '') {
      showToast('Alamat dan nomor telepon wajib diisi', 'error');
      return;
    }
    setSubmitting(true);
    const payload: {
      serviceId: string;
      userId: string;
      deliveryAddress: string;
      customerPhone: string;
      notes?: string;
      latitude?: number | null;
      longitude?: number | null;
    } = {
      serviceId: service.id,
      userId: user.id,
      deliveryAddress: deliveryAddress.trim(),
      customerPhone: customerPhone.trim(),
      notes: notes.trim() === '' ? undefined : notes,
      latitude: latitude.trim() === '' ? null : Number(latitude),
      longitude: longitude.trim() === '' ? null : Number(longitude),
    };
    try {
      await createOrder(payload);
      router.push('/dashboard/orders');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat pesanan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <p className={`${neoCardSm} bg-[#FFE600] px-6 py-4 font-black uppercase text-sm`}>Memuat...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className={`bg-white p-8 max-w-md text-center ${neoCard}`}>
          <p className="text-4xl">🤷</p>
          <h1 className="mt-2 text-xl font-black uppercase">Jasa Tidak Ditemukan</h1>
          <Link href="/services" className={`${neoBtn} mt-4 inline-block bg-black text-[#FFE600] px-6 py-3 text-xs`}>
            ← Kembali ke Daftar Jasa
          </Link>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <p className={`${neoCardSm} bg-[#FF007A] text-white px-6 py-4 font-black uppercase text-sm`}>Gagal memuat jasa</p>
      </div>
    );
  }

  const open = service.isAvailable && !service.isDeleted;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
          <h1 className="text-2xl font-black uppercase">🛠️ Detail Jasa</h1>
          <Link href="/services" className={`${neoBtn} bg-[#FFE600] text-black px-3 py-1.5 text-xs`}>
            ← Semua Jasa
          </Link>
        </div>
        {toast && (
          <p className={`${neoCardSm} mt-4 ${toastKind === 'error' ? 'bg-[#FF007A] text-white' : 'bg-[#00E676]'} px-4 py-2 text-xs font-black uppercase`}>
            {toast}
          </p>
        )}

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className={`bg-white p-4 ${neoCard}`}>
              {service.portfolioUrl && (
                <img src={service.portfolioUrl} alt={service.name} className="mb-3 w-full max-h-72 object-cover border-2 border-black" />
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black ${open ? 'bg-[#00E676]' : 'bg-[#FF007A] text-white'}`}>
                  {open ? '● Buka' : '○ Tutup Sementara'}
                </span>
                {service.isVerified && <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black bg-[#FFE600]">Terverifikasi</span>}
                {service.category && <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black bg-white">{service.category}</span>}
              </div>
              <h1 className="text-2xl font-black uppercase">{service.name}</h1>
              <p className="text-sm font-bold opacity-70">{service.skill}</p>
              <p className="mt-2 text-2xl font-black">
                {formatPrice(service.price)}{' '}
                <span className="text-xs opacity-60">{PRICE_TYPE_LABEL[service.priceType] ?? service.priceType}</span>
              </p>
              <p className="text-xs font-bold opacity-70 mt-1">
                ⭐ {service.avgRating ?? 0} dari 5 ({service.reviewCount ?? 0} ulasan)
              </p>
              <p className="mt-3 text-sm font-bold bg-[#FAF8F5] border-2 border-black p-3 whitespace-pre-line">{service.description}</p>
            </div>

            <div className={`bg-white p-4 ${neoCardSm}`}>
              <h2 className="text-lg font-black uppercase">⭐ Ulasan Warga Sekitar ({reviews.length})</h2>
              {reviews.length === 0 && <p className="mt-2 text-sm font-bold opacity-60">Belum ada ulasan untuk jasa ini.</p>}
              <div className="mt-3 space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="border-2 border-black p-2 bg-[#FAF8F5]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black uppercase">{r.user?.name ?? 'Warga'}</p>
                      <Stars value={r.rating} />
                    </div>
                    {r.comment && <p className="text-sm font-bold mt-1">{r.comment}</p>}
                    <p className="text-[10px] font-black uppercase opacity-50 mt-1">{new Date(r.createdAt).toLocaleDateString('id-ID')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`bg-white p-4 ${neoCardSm}`}>
              <h2 className="text-lg font-black uppercase">Penyedia</h2>
              <p className="text-sm font-black">{service.user?.name ?? '—'}</p>
              {service.user?.email && <p className="text-xs font-bold opacity-70">{service.user.email}</p>}
              <p className="text-xs font-bold opacity-70">📍 {service.location}</p>
              {service.address && <p className="text-xs font-bold opacity-70">🏠 {service.address}</p>}
              <a href={`https://wa.me/${service.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className={`${neoBtn} mt-3 inline-block bg-[#00E676] text-black px-3 py-2 text-xs`}>
                💬 Hubungi Penyedia
              </a>
            </div>

            <form onSubmit={submitOrder} className={`bg-white p-4 ${neoCardSm}`}>
              <h2 className="text-lg font-black uppercase">📝 Pesan Jasa</h2>
              {!user && (
                <p className="mt-2 text-xs font-black uppercase bg-[#FFE600] border-2 border-black p-2">
                  <Link href="/" className="underline">Masuk dulu</Link> untuk memesan
                </p>
              )}
              {open ? (
                <>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs font-black uppercase">Alamat Lengkap</label>
                      <textarea required rows={2} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                    </div>
                    <div>
                      <label className="text-xs font-black uppercase">No. WhatsApp</label>
                      <input required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                    </div>
                    <div>
                      <label className="text-xs font-black uppercase">Catatan (opsional)</label>
                      <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-black uppercase">Latitude</label>
                        <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="-6.2" />
                      </div>
                      <div>
                        <label className="text-xs font-black uppercase">Longitude</label>
                        <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="106.8" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={submitting} className={`${neoBtn} mt-3 w-full py-3 text-sm bg-[#FFE600] disabled:opacity-50`}>
                    {submitting ? 'Mengirim...' : 'Kirim Pesanan →'}
                  </button>
                </>
              ) : (
                <p className="mt-2 text-xs font-black uppercase bg-[#FF007A] text-white border-2 border-black p-2">
                  Jasa ini sedang tutup sementara. Silakan kembali lagi nanti.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
