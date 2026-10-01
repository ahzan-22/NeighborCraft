'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  apiFetch,
  createService,
  deleteService,
  getProviderOrders,
  updateOrderStatusFull,
  updateServiceAdmin,
  type Order,
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

type Tab = 'katalog' | 'pesanan';
type FilterStatus = 'SEMUA' | 'MENUNGGU' | 'DIPROSES' | 'SELESAI' | 'DIBATALKAN';

const EMPTY_FORM = {
  name: '',
  skill: '',
  category: '',
  priceType: 'FIXED',
  price: '',
  location: '',
  address: '',
  phone: '',
  description: '',
  portfolioUrl: '',
  latitude: '',
  longitude: '',
  isAvailable: true,
};

type ServiceForm = typeof EMPTY_FORM;

const STATUS_META: Record<string, { label: string; warna: string }> = {
  PENDING: { label: 'Menunggu', warna: 'bg-[#FFE600]' },
  CONFIRMED: { label: 'Diterima', warna: 'bg-[#00E676]' },
  IN_PROGRESS: { label: 'Dikerjakan', warna: 'bg-[#0052FF] text-white' },
  COMPLETED: { label: 'Selesai', warna: 'bg-black text-white' },
  CANCELLED: { label: 'Dibatalkan', warna: 'bg-[#FF007A] text-white' },
};

function matchesFilter(status: string, filter: FilterStatus): boolean {
  switch (filter) {
    case 'SEMUA':
      return true;
    case 'MENUNGGU':
      return status === 'PENDING' || status === 'CONFIRMED';
    case 'DIPROSES':
      return status === 'IN_PROGRESS';
    case 'SELESAI':
      return status === 'COMPLETED';
    case 'DIBATALKAN':
      return status === 'CANCELLED';
    default:
      return true;
  }
}

function formatPrice(price?: number | null) {
  if (price === undefined || price === null) return 'Harga hubungi penyedia';
  return `Rp${Number(price).toLocaleString('id-ID')}`;
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function ProviderDashboardPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('katalog');
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('SEMUA');
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'success' | 'error'>('success');
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const loadServices = useCallback(async () => {
    try {
      const res = await apiFetch('/services?all=true', { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal memuat jasa');
      const all = (await res.json()) as Array<Service & { user?: { id: string } | null }>;
      const mine = user ? all.filter((s) => s.user?.id === user.id) : [];
      setServices(mine);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat jasa', 'error');
    }
  }, [user]);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await getProviderOrders());
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat pesanan masuk', 'error');
    }
  }, []);

  useEffect(() => {
    if (!checked || !user) return;
    const timer = window.setTimeout(() => {
      void loadServices();
      void loadOrders();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [checked, user, loadServices, loadOrders]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void loadOrders();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [user, loadOrders]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const submitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      name: form.name,
      skill: form.skill,
      category: form.category,
      priceType: form.priceType,
      price: form.price === '' ? null : Number(form.price),
      location: form.location,
      address: form.address,
      phone: form.phone,
      description: form.description,
      portfolioUrl: form.portfolioUrl === '' ? null : form.portfolioUrl,
      latitude: optionalNumber(form.latitude),
      longitude: optionalNumber(form.longitude),
      isAvailable: form.isAvailable,
    };
    try {
      if (editingId) {
        await updateServiceAdmin(editingId, payload);
        showToast('Jasa berhasil diperbarui');
      } else {
        await createService(payload);
        showToast('Jasa berhasil ditambahkan');
      }
      resetForm();
      await loadServices();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan jasa', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (svc: Service) => {
    setEditingId(svc.id);
    setForm({
      name: svc.name,
      skill: svc.skill,
      category: svc.category,
      priceType: svc.priceType,
      price: svc.price === null || svc.price === undefined ? '' : String(svc.price),
      location: svc.location,
      address: svc.address ?? '',
      phone: svc.phone,
      description: svc.description ?? '',
      portfolioUrl: svc.portfolioUrl ?? '',
      latitude: svc.latitude === null || svc.latitude === undefined ? '' : String(svc.latitude),
      longitude: svc.longitude === null || svc.longitude === undefined ? '' : String(svc.longitude),
      isAvailable: svc.isAvailable,
    });
    setTab('katalog');
  };

  const toggleAvailability = async (svc: Service) => {
    try {
      await updateServiceAdmin(svc.id, { isAvailable: !svc.isAvailable });
      await loadServices();
      showToast(svc.isAvailable ? 'Jasa ditutup sementara' : 'Jasa menerima pesanan');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah ketersediaan', 'error');
    }
  };

  const removeService = async (svc: Service) => {
    if (!confirm('Apakah Anda yakin ingin menghapus permanen jasa ini?')) return;
    try {
      const data = await deleteService(svc.id);
      if (data?.softDeleted) {
        await loadServices();
        showToast('Jasa dinonaktifkan (soft delete) karena memiliki riwayat');
      } else {
        setServices((prev) => prev.filter((s) => s.id !== svc.id));
        showToast('Jasa dihapus permanen');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus jasa', 'error');
    }
  };

  const changeStatus = async (order: Order, status: string) => {
    let cancelReason: string | undefined;
    if (status === 'CANCELLED') {
      const reason = window.prompt('Alasan pembatalan pesanan:');
      if (reason === null) return;
      if (reason.trim() === '') {
        showToast('Alasan pembatalan wajib diisi', 'error');
        return;
      }
      cancelReason = reason;
    }
    setBusyOrderId(order.id);
    try {
      await updateOrderStatusFull(order.id, status, cancelReason);
      await loadOrders();
      showToast(`Status pesanan diubah menjadi ${STATUS_META[status]?.label ?? status}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah status pesanan', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <p className={`${neoCardSm} bg-[#FFE600] px-6 py-4 font-black uppercase text-sm`}>
          Memuat Dashboard Penyedia...
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
            Dashboard penyedia jasa hanya untuk pengguna yang sudah masuk.
          </p>
          <Link href="/" className={`${neoBtn} mt-4 inline-block bg-black text-[#FFE600] px-6 py-3 text-xs`}>
            ← Masuk / Daftar
          </Link>
        </div>
      </div>
    );
  }

  const visibleOrders = orders.filter((o) => matchesFilter(o.status, filter));
  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'SEMUA', label: 'Semua' },
    { key: 'MENUNGGU', label: 'Menunggu' },
    { key: 'DIPROSES', label: 'Diproses' },
    { key: 'SELESAI', label: 'Selesai' },
    { key: 'DIBATALKAN', label: 'Dibatalkan' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <h1 className="pt-4 text-2xl font-black uppercase">
          🧰 Dashboard <span className="bg-[#FFE600] px-1">Penyedia</span>
        </h1>

        {toast && (
          <p className={`${neoCardSm} mt-4 ${toastKind === 'error' ? 'bg-[#FF007A] text-white' : 'bg-[#00E676]'} px-4 py-2 text-xs font-black uppercase`}>
            {toast}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTab('katalog')}
            className={`${neoBtn} px-3 py-2 text-xs ${tab === 'katalog' ? 'bg-black text-white' : 'bg-white'}`}
          >
            🗂️ Katalog Jasa Saya ({services.length})
          </button>
          <button
            onClick={() => setTab('pesanan')}
            className={`${neoBtn} px-3 py-2 text-xs ${tab === 'pesanan' ? 'bg-black text-white' : 'bg-white'}`}
          >
            📥 Pesanan Masuk ({orders.length})
          </button>
        </div>

        {tab === 'katalog' && (
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={submitService} className={`bg-white p-4 space-y-3 self-start ${neoCardSm}`}>
              <h2 className="text-lg font-black uppercase">
                {editingId ? 'Edit Jasa' : 'Tambah Jasa Baru'}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase">Nama Jasa</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Kategori</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="Servis, Tukang, Kuliner..." />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Skill /aphewan</label>
                  <input required value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Jenis Harga</label>
                  <select value={form.priceType} onChange={(e) => setForm({ ...form, priceType: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}>
                    <option value="FIXED">FIXED (Tetap)</option>
                    <option value="HOURLY">HOURLY (Per Jam)</option>
                    <option value="ESTIMATE">ESTIMATE (Estimasi)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Harga (Rp)</label>
                  <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Wilayah</label>
                  <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Alamat Lengkap</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">No. WhatsApp</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">URL Portofolio/Gambar</label>
                  <input value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Latitude</label>
                  <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="-6.2" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Longitude</label>
                  <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="106.8" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-black uppercase">Deskripsi</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
              </div>
              {form.portfolioUrl && (
                <img src={form.portfolioUrl} alt="Pratinjau portofolio" className={`max-h-40 object-cover ${neoCardSm}`} />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} className="w-4 h-4 accent-[#00E676]" />
                <span className="text-sm font-black uppercase">Menerima Pesanan</span>
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className={`${neoBtn} flex-1 py-3 text-sm bg-[#FFE600] disabled:opacity-50`}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan →' : 'Tambah Jasa →'}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className={`${neoBtn} px-4 py-3 text-sm bg-white`}>
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              {services.length === 0 && (
                <p className={`bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>
                  Belum ada jasa. Tasikan form untuk mulai menawarkan jasa.
                </p>
              )}
              {services.map((s) => (
                <div key={s.id} className={`bg-white p-4 ${neoCardSm} ${s.isAvailable ? '' : 'opacity-60'}`}>
                  <p className="font-black uppercase text-sm">
                    {s.category || s.skill} — {s.name}
                  </p>
                  <p className="text-xs font-bold opacity-60">
                    📍 {s.location} • 💰 {formatPrice(s.price)} ({s.priceType}) • ⭐ {s.avgRating ?? 0} ({s.reviewCount ?? 0})
                  </p>
                  {s.portfolioUrl && (
                    <img src={s.portfolioUrl} alt={s.name} className="mt-2 max-h-32 object-cover border-2 border-black" />
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`text-[11px] font-black uppercase px-2 py-1 border-2 border-black ${s.isAvailable ? 'bg-[#00E676]' : 'bg-[#FF007A] text-white'}`}>
                      {s.isAvailable ? '✓ Menerima Pesanan' : '⏸ Sedang Tutup'}
                    </span>
                    {s.isVerified && <span className="text-[11px] font-black uppercase px-2 py-1 border-2 border-black bg-[#FFE600]">Terverifikasi</span>}
                    {s.isDeleted && <span className="text-[11px] font-black uppercase px-2 py-1 border-2 border-black bg-[#FF007A] text-white">Nonaktif</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => startEdit(s)} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs`}>
                      Edit ✎
                    </button>
                    <button onClick={() => toggleAvailability(s)} className={`${neoBtn} ${s.isAvailable ? 'bg-[#FF007A] text-white' : 'bg-[#00E676] text-black'} px-3 py-2 text-xs`}>
                      {s.isAvailable ? 'Tutup Sementara ⏸' : 'Buka Terima Pesanan ▶'}
                    </button>
                    <button onClick={() => removeService(s)} className={`${neoBtn} bg-[#FF007A] text-white px-3 py-2 text-xs`}>
                      Hapus Permanen ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'pesanan' && (
          <section className="mt-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`${neoBtn} px-3 py-2 text-xs ${filter === f.key ? 'bg-black text-white' : 'bg-white'}`}
                >
                  {f.label}
                </button>
              ))}
              <button onClick={() => void loadOrders()} className={`${neoBtn} px-3 py-2 text-xs bg-[#0052FF] text-white`}>
                ↻ Muat Ulang
              </button>
            </div>

            {visibleOrders.length === 0 && (
              <p className={`bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>Tidak ada pesanan pada filter ini</p>
            )}

            {visibleOrders.map((o) => {
              const meta = STATUS_META[o.status] ?? { label: o.status, warna: 'bg-white' };
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
                  <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs font-bold opacity-80">
                    <p>👤 Pemesan: {o.user?.name ?? o.userId} {o.user?.email ? `(${o.user.email})` : ''}</p>
                    <p>📞 {o.customerPhone || '—'}</p>
                    <p className="sm:col-span-2">🏠 Alamat: {o.deliveryAddress || '—'}</p>
                    {o.notes && <p className="sm:col-span-2">📝 Catatan: {o.notes}</p>}
                    {o.cancelReason && <p className="sm:col-span-2">❌ Alasan batal: {o.cancelReason}</p>}
                    {o.completedAt && <p className="sm:col-span-2">✅ Selesai: {new Date(o.completedAt).toLocaleString('id-ID')}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.mapsLink && (
                      <a href={o.mapsLink} target="_blank" rel="noopener noreferrer" className={`${neoBtn} bg-[#FFE600] text-black px-3 py-2 text-xs`}>
                        📍 Pinpoint Maps
                      </a>
                    )}
                    {o.waLink && (
                      <a href={o.waLink} target="_blank" rel="noopener noreferrer" className={`${neoBtn} bg-[#00E676] text-black px-3 py-2 text-xs`}>
                        💬 Hubungi via WhatsApp
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.status === 'PENDING' && (
                      <>
                        <button disabled={busyOrderId === o.id} onClick={() => changeStatus(o, 'CONFIRMED')} className={`${neoBtn} bg-[#00E676] text-black px-3 py-2 text-xs disabled:opacity-50`}>
                          Terima ✓
                        </button>
                        <button disabled={busyOrderId === o.id} onClick={() => changeStatus(o, 'CANCELLED')} className={`${neoBtn} bg-[#FF007A] text-white px-3 py-2 text-xs disabled:opacity-50`}>
                          Batalkan ✕
                        </button>
                      </>
                    )}
                    {o.status === 'CONFIRMED' && (
                      <>
                        <button disabled={busyOrderId === o.id} onClick={() => changeStatus(o, 'IN_PROGRESS')} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs disabled:opacity-50`}>
                          Mulai Kerjakan ▶
                        </button>
                        <button disabled={busyOrderId === o.id} onClick={() => changeStatus(o, 'CANCELLED')} className={`${neoBtn} bg-[#FF007A] text-white px-3 py-2 text-xs disabled:opacity-50`}>
                          Batalkan ✕
                        </button>
                      </>
                    )}
                    {o.status === 'IN_PROGRESS' && (
                      <button disabled={busyOrderId === o.id} onClick={() => changeStatus(o, 'COMPLETED')} className={`${neoBtn} bg-black text-white px-3 py-2 text-xs disabled:opacity-50`}>
                        Selesaikan ✓
                      </button>
                    )}
                    {(o.status === 'COMPLETED' || o.status === 'CANCELLED') && (
                      <span className="text-[11px] font-black uppercase opacity-50">Tidak ada aksi lagi</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
