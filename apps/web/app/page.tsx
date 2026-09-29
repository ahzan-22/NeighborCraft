'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSessionUser, logout, saveSession } from '../lib/auth';
import type { SessionUser } from '../lib/auth';
import { apiFetch, getServices, getUserOrders, createService, createOrder as apiCreateOrder, updateOrderStatusFull, deleteService, createReview, createContact } from '../lib/api';
import type { Service as ApiService, Order as ApiOrder, Review as ApiReview } from '../lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/* ---------- Types ---------- */
interface Review {
  id: string;
  rating: number;
  comment: string;
  user?: { id: string; name: string };
}
interface Service {
  id: string;
  name: string;
  skill: string;
  location: string;
  address: string;
  phone: string;
  description: string;
  price?: number | null;
  isVerified: boolean;
  avgRating: number;
  reviewCount: number;
  reviews: Review[];
}
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
interface OrderItem {
  id: string;
  status: string;
  serviceId: string;
  userId: string;
  createdAt: string;
  service?: { id: string; name: string; skill: string } | null;
}
interface Toast {
  msg: string;
  kind: 'error' | 'success';
}

const CATEGORIES = ['Semua', 'Servis', 'Tukang', 'Kuliner', 'Les', 'Digital'];
const TESTIMONI = [
  { nama: 'Bu Ani — RT 02', teks: '"AC langsung dingin, pembayaran setelah pekerjaan selesai. Sangat amanah!"', warna: 'bg-[#FFE600]' },
  { nama: 'Pak RW 01', teks: '"Seluruh penyedia jasa yang terverifikasi telah diperiksa KTP dan domisilinya. Sangat baik!"', warna: 'bg-[#00E676]' },
  { nama: 'Dinda — RT 04', teks: '"Pesanan paket kudapan sehari sebelumnya tetap dilayani. Dapur Mak Ijah memang terbaik!"', warna: 'bg-[#FF007A] text-white' },
];
const ALUR = [
  { step: '01', judul: 'Cari Jasa', desk: 'Cari dan saring kategori jasa tetangga terdekat.', warna: 'bg-[#FFE600]' },
  { step: '02', judul: 'Periksa Detail', desk: 'Lihat penilaian, ulasan, alamat, dan deskripsi lengkap.', warna: 'bg-[#0052FF] text-white' },
  { step: '03', judul: 'Hubungi WhatsApp', desk: 'Hubungi penyedia jasa secara langsung tanpa perantara.', warna: 'bg-[#00E676]' },
  { step: '04', judul: 'Beri Ulasan', desk: 'Berikan penilaian bintang 1–5 agar warga lain merasa yakin.', warna: 'bg-[#FF007A] text-white' },
];

/* ---------- Neo helpers ---------- */
const neoCard = 'border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]';
const neoCardSm = 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const neoBtn =
  'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black uppercase';
const neoInput =
  'border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-[#FFE600]/30 placeholder:text-black/40 font-bold';

function Stars({ value }: { value: number }) {
  return (
    <span className="font-black text-sm tracking-tight">
      {'★'.repeat(Math.round(value) || 0)}
      <span className="opacity-30">{'★'.repeat(5 - (Math.round(value) || 0))}</span>{' '}
      <span className="bg-black text-white px-1 text-xs">{value ? value.toFixed(1) : 'Baru'}</span>
    </span>
  );
}

function formatPrice(price?: number | null) {
  if (price === undefined || price === null) return 'Harga hubungi penyedia';
  return `Rp${Number(price).toLocaleString('id-ID')}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('id-ID');
  } catch {
    return iso;
  }
}

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authErr, setAuthErr] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [detail, setDetail] = useState<Service | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [canReview, setCanReview] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [showOrders, setShowOrders] = useState(false);
  const [showRegisterService, setShowRegisterService] = useState(false);
  const [formRegister, setFormRegister] = useState({
    name: '',
    skill: '',
    location: '',
    address: '',
    phone: '',
    description: '',
    price: '',
  });
  const [savingService, setSavingService] = useState(false);
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sendingReport, setSendingReport] = useState(false);

  const showToast = (msg: string, kind: Toast['kind']) => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 4000);
  };

  /* ----- restore session ----- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const sess: SessionUser | null = getSessionUser();
      await Promise.resolve();
      if (!alive || !sess) return;
      setUser(sess);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ----- services: selalu dari database nyata ----- */
  const fetchServices = async () => {
    try {
      const data = await getServices();
      if (!Array.isArray(data)) {
        setServices([]);
        return;
      }
      setServices(
        data.map((d: ApiService) => ({
          id: String(d.id),
          name: d.name,
          skill: d.skill,
          location: d.location,
          address: d.address ?? d.location ?? '-',
          phone: d.phone,
          description: d.description ?? '-',
          price: d.price ?? null,
          isVerified: !!d.isVerified,
          avgRating: d.avgRating ?? 0,
          reviewCount: d.reviewCount ?? (d.reviews?.length ?? 0),
          reviews: (d.reviews ?? []).map((rv: ApiReview) => ({
            id: String(rv.id),
            rating: rv.rating,
            comment: rv.comment,
            user: rv.user,
          })),
        }))
      );
    } catch {
      setServices([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchServices(), 0);
    return () => window.clearTimeout(timer);
     
  }, []);

  /* ----- orders milik user: selalu dari API ----- */
  const fetchUserOrders = async (userId: string) => {
    try {
      const data = await getUserOrders(userId);
      const mapped: OrderItem[] = data.map((o: ApiOrder) => ({
        id: String(o.id),
        status: o.status,
        serviceId: String(o.serviceId),
        userId: String(o.userId),
        createdAt: String(o.createdAt),
        service: o.service
          ? { id: String(o.service.id), name: o.service.name, skill: o.service.skill }
          : null,
      }));
      setOrders(mapped);
      return mapped;
    } catch {
      setOrders([]);
      return [];
    }
  };

  useEffect(() => {
    if (!user) {
      const timer = window.setTimeout(() => setOrders([]), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => void fetchUserOrders(user.id), 0);
    return () => window.clearTimeout(timer);
     
  }, [user]);

  /* ----- canReview + orderId untuk form ulasan ----- */
  useEffect(() => {
    let alive = true;
    const checkCanReview = async () => {
      if (!detail || !user) {
        setCanReview(false);
        setReviewOrderId(null);
        return;
      }
      const list = await fetchUserOrders(user.id);
      const completedOrder = list.find(
        (o) => o.serviceId === detail.id && o.status === 'COMPLETED',
      );
      if (!alive) return;
      setCanReview(!!completedOrder);
      setReviewOrderId(completedOrder ? completedOrder.id : null);
    };
    const timer = window.setTimeout(() => void checkCanReview(), 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
     
  }, [detail, user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return services.filter(
      (s) =>
        (s.name.toLowerCase().includes(q) || s.skill.toLowerCase().includes(q) || s.location.toLowerCase().includes(q)) &&
        (category === 'Semua' || s.skill.toLowerCase().includes(category.toLowerCase()) || s.location.includes(category))
    );
  }, [services, search, category]);

  const totalWarga = 120 + services.length;
  const verified = services.filter((s) => s.isVerified).length;
  const kepuasan = services.length
    ? (services.reduce((a, s) => a + (s.avgRating || 0), 0) / services.length).toFixed(1)
    : '5.0';

  /* ----- auth nyata ----- */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr('');
    try {
      const url = authMode === 'login' ? `${API}/auth/login` : `${API}/auth/register`;
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : { ...authForm, role: 'WARGA' };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? 'Gagal autentikasi');
      saveSession(data.user as SessionUser, data.accessToken as string);
      setUser(data.user as AuthUser);
      setShowAuth(false);
      setAuthForm({ name: '', email: '', password: '' });
      showToast(data.message ?? 'Berhasil masuk', 'success');
      window.location.href = (data.user as AuthUser).role === 'ADMIN' ? '/admin' : '/services';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal autentikasi';
      setAuthErr(msg);
      showToast(msg, 'error');
    }
  };

  const handleLogout = () => {
    setDetail(null);
    setShowOrders(false);
    setOrders([]);
    setCanReview(false);
    logout();
  };

  /* ----- tambah jasa nyata: POST /services ----- */
  const handleRegisterService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Masuk terlebih dahulu untuk menawarkan jasa', 'error');
      setShowAuth(true);
      return;
    }
    setSavingService(true);
    try {
      const payload = {
        name: formRegister.name,
        skill: formRegister.skill,
        location: formRegister.location,
        address: formRegister.address || formRegister.location,
        phone: formRegister.phone,
        description: formRegister.description,
        price: formRegister.price === '' ? undefined : Number(formRegister.price),
        userId: user.id,
      };
      await createService(payload);
      setShowRegisterService(false);
      setFormRegister({ name: '', skill: '', location: '', address: '', phone: '', description: '', price: '' });
      await fetchServices();
      showToast('Jasa berhasil ditawarkan dan tersimpan di katalog', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mendaftar jasa', 'error');
    } finally {
      setSavingService(false);
    }
  };

  /* ----- pesan jasa nyata: POST /orders ----- */
  const createOrder = async (serviceId: string) => {
    if (!user) {
      showToast('Masuk terlebih dahulu untuk memesan jasa', 'error');
      setShowAuth(true);
      return;
    }
    const deliveryAddress = window.prompt('Alamat lengkap pengerjaan:');
    if (deliveryAddress === null) return;
    if (deliveryAddress.trim() === '') {
      showToast('Alamat wajib diisi', 'error');
      return;
    }
    const customerPhone = window.prompt('No. WhatsApp pemesan:');
    if (customerPhone === null) return;
    if (customerPhone.trim() === '') {
      showToast('Nomor WhatsApp wajib diisi', 'error');
      return;
    }
    setOrderingId(serviceId);
    try {
      await apiCreateOrder({
        serviceId,
        userId: user.id,
        deliveryAddress: deliveryAddress.trim(),
        customerPhone: customerPhone.trim(),
      });
      await fetchUserOrders(user.id);
      setShowOrders(true);
      showToast('Pesanan berhasil dibuat', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat pesanan', 'error');
    } finally {
      setOrderingId(null);
    }
  };

  /* ----- status order nyata: PATCH /orders/:id/status ----- */
  const updateOrderStatus = async (id: string, status: string) => {
    try {
      await updateOrderStatusFull(id, status);
      setOrders((p) => p.map((o) => (o.id === id ? { ...o, status } : o)));
      showToast(`Pesanan ${status === 'COMPLETED' ? 'diselesaikan' : 'dibatalkan'}`, 'success');
      if (detail && user) {
        const list = await fetchUserOrders(user.id);
        const completedOrder = list.find((o) => o.serviceId === detail.id && o.status === 'COMPLETED');
        setCanReview(!!completedOrder);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah status', 'error');
    }
  };

  /* ----- admin ----- */
  const handleVerify = async (id: string) => {
    try {
      await apiFetch(`/services/${id}/verify`, { method: 'PATCH' });
      await fetchServices();
      if (detail && detail.id === id) setDetail({ ...detail, isVerified: true });
      showToast('Jasa diverifikasi', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal verifikasi', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jasa ini?')) return;
    try {
      await deleteService(id);
      setDetail(null);
      await fetchServices();
      showToast('Jasa dihapus', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus', 'error');
    }
  };

  /* ----- ulasan nyata: POST /reviews (butuh COMPLETED) ----- */
  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !user || !reviewOrderId) return;
    try {
      await createReview({
        rating,
        comment,
        serviceId: detail.id,
        userId: user.id,
        orderId: reviewOrderId,
      });
      setComment('');
      await fetchServices();
      // Refresh modal detail supaya ulasan baru langsung muncul,
      // cegah user klik kirim 2x karena mengira gagal.
      try {
        const rs = await apiFetch(`/services/${detail.id}`, { cache: 'no-store' });
        if (rs.ok) {
          const fresh = await rs.json();
          setDetail({
            id: String(fresh.id),
            name: fresh.name,
            skill: fresh.skill,
            location: fresh.location,
            address: fresh.address ?? fresh.location ?? '-',
            phone: fresh.phone,
            description: fresh.description ?? '-',
            price: fresh.price ?? null,
            isVerified: !!fresh.isVerified,
            avgRating: fresh.avgRating ?? 0,
            reviewCount: fresh.reviewCount ?? (fresh.reviews?.length ?? 0),
            reviews: (fresh.reviews ?? []).map((rv: ApiReview) => ({
              id: String(rv.id),
              rating: rv.rating,
              comment: rv.comment,
              user: rv.user,
            })),
          });
        }
      } catch {
        /* abaikan, daftar utama sudah ter-refresh */
      }
      showToast('Ulasan terkirim, terima kasih!', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim ulasan', 'error');
    }
  };

  const openOrders = async () => {
    if (!user) return;
    await fetchUserOrders(user.id);
    setShowOrders(true);
  };

  /* ----- lapor warga: POST /contacts ----- */
  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.name || !reportForm.message) {
      showToast('Nama dan isi laporan wajib diisi', 'error');
      return;
    }
    setSendingReport(true);
    try {
      await createContact(reportForm);
      setReportForm({ name: '', email: '', subject: '', message: '' });
      showToast('Laporan warga terkirim, terima kasih!', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim laporan', 'error');
    } finally {
      setSendingReport(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
          <p
            className={`${neoCardSm} px-4 py-2 text-xs font-black uppercase ${
              toast.kind === 'error' ? 'bg-[#FF007A] text-white' : 'bg-[#00E676] text-black'
            }`}
          >
            {toast.msg}
          </p>
        </div>
      )}

      {/* Ticker */}
      <div className="bg-black text-[#FFE600] text-xs font-black uppercase tracking-widest py-2 px-4 border-b-4 border-black overflow-hidden whitespace-nowrap">
        ★ Portal Resmi Komunitas Lokal ★ Penyedia Jasa Terverifikasi RT/RW ★ Tanpa Perantara ★ Bayar Setelah Pekerjaan Selesai ★
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-[#FFE600] border-b-4 border-black">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`bg-[#FF007A] text-white px-2 py-1 text-xl ${neoCardSm}`}>🏘️</span>
            <span className="text-xl font-black uppercase tracking-tight">Neighbor<span className="bg-black text-[#FFE600] px-1">Craft</span></span>
            <span className="hidden sm:inline-block bg-black text-white text-[10px] font-black uppercase px-2 py-1 rotate-[-2deg]">Edisi Neobrutalisme</span>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className={`bg-white px-3 py-1.5 text-xs font-black uppercase hidden sm:block ${neoCardSm}`}>👋 {user.name} • {user.role}</span>
              {user.role === 'ADMIN' && (
                <Link href="/admin" className={`${neoBtn} bg-black text-[#FFE600] px-3 py-1.5 text-xs`}>Dashboard Admin →</Link>
              )}
              <button onClick={() => setShowRegisterService(true)} className={`${neoBtn} bg-[#00E676] text-black px-3 py-1.5 text-xs`}>Tawarkan Jasa →</button>
              <button onClick={openOrders} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-1.5 text-xs`}>Riwayat ({orders.length})</button>
              <button onClick={handleLogout} className={`${neoBtn} bg-[#FF007A] text-white px-3 py-1.5 text-xs`}>Logout</button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className={`${neoBtn} bg-black text-[#FFE600] px-4 py-2 text-xs`}>Masuk / Daftar Warga →</button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {!user ? (
          <>
            {/* ===== 1. PUBLIC LANDING ===== */}
            <section className={`mt-8 bg-[#0052FF] text-white p-6 md:p-10 relative overflow-hidden ${neoCard}`}>
              <span className="absolute right-4 top-4 rotate-6 bg-[#00E676] text-black text-xs font-black uppercase px-3 py-2 border-[3px] border-black">✅ Portal Resmi Warga</span>
              <p className="inline-block bg-black text-[#FFE600] text-[11px] font-black uppercase px-2 py-1">★ Komunitas Lokal • Terverifikasi RT/RW</p>
              <h1 className="mt-3 text-4xl md:text-6xl font-black uppercase leading-[0.95]">Butuh Tukang?<br /><span className="bg-[#FFE600] text-black px-2">Tanya Tetangga!</span></h1>
              <p className="mt-4 max-w-lg font-bold text-sm md:text-base">Jasa servis, pertukangan, kuliner, hingga les privat — seluruhnya telah diperiksa oleh RT/RW. Penilaian jujur dari warga, hubungi langsung tanpa perantara.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => setShowAuth(true)} className={`${neoBtn} bg-[#FFE600] text-black px-6 py-3 text-sm`}>Masuk / Daftar Warga →</button>
                <a href="#alur" className={`${neoBtn} bg-white text-black px-6 py-3 text-sm`}>Lihat Cara Kerja ↓</a>
              </div>
            </section>

            {/* Stat cards */}
            <section className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Warga', val: `${totalWarga}+`, warna: 'bg-[#FFE600]' },
                { label: 'Jasa Terverifikasi', val: `${verified}`, warna: 'bg-[#00E676]' },
                { label: 'Kepuasan Warga', val: `⭐ ${kepuasan}`, warna: 'bg-[#FF007A] text-white' },
              ].map((s) => (
                <div key={s.label} className={`${s.warna} p-5 ${neoCard}`}>
                  <p className="text-3xl font-black">{s.val}</p>
                  <p className="text-xs font-black uppercase mt-1">{s.label}</p>
                </div>
              ))}
            </section>

            {/* Alur */}
            <section id="alur" className="mt-10">
              <h2 className="text-2xl md:text-3xl font-black uppercase inline-block bg-black text-white px-3 py-1 rotate-[-1deg]">Alur Layanan Komunitas</h2>
              <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ALUR.map((a) => (
                  <div key={a.step} className={`${a.warna} p-5 ${neoCardSm}`}>
                    <p className="text-4xl font-black">{a.step}</p>
                    <p className="font-black uppercase mt-1">{a.judul}</p>
                    <p className="text-sm font-bold mt-1">{a.desk}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Testimoni */}
            <section className="mt-10">
              <h2 className="text-2xl md:text-3xl font-black uppercase inline-block bg-[#FF007A] text-white px-3 py-1 border-4 border-black rotate-[1deg]">Kata Warga 💬</h2>
              <div className="mt-5 grid md:grid-cols-3 gap-4">
                {TESTIMONI.map((t) => (
                  <div key={t.nama} className={`${t.warna} p-5 ${neoCardSm}`}>
                    <p className="font-bold text-sm">{t.teks}</p>
                    <p className="mt-3 text-xs font-black uppercase bg-black text-white inline-block px-2 py-1">{t.nama}</p>
                  </div>
                ))}
              </div>
              <div className={`mt-6 bg-white p-6 text-center ${neoCard}`}>
                <p className="font-black uppercase text-lg">Masuk terlebih dahulu untuk melihat katalog jasa 👀</p>
                <button onClick={() => setShowAuth(true)} className={`${neoBtn} mt-3 bg-black text-[#FFE600] px-6 py-3 text-sm`}>Masuk / Daftar Warga →</button>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* ===== 2. MEMBER DASHBOARD ===== */}
            <section className={`mt-8 bg-black text-white p-5 flex flex-wrap items-center justify-between gap-3 ${neoCard} !shadow-[6px_6px_0px_0px_rgba(255,0,122,1)]`}>
              <div>
                <p className="text-[11px] font-black uppercase bg-[#00E676] text-black inline-block px-2 py-0.5">✓ Warga Terautentikasi</p>
                <h2 className="text-2xl font-black uppercase mt-1">Halo, {user.name}! <span className="text-[#FFE600]">({user.role})</span></h2>
                <p className="text-xs font-bold text-white/70">{user.email} • {filtered.length} jasa ditampilkan</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Cari jasa, nama, atau wilayah..." className={`flex-1 sm:w-64 bg-white text-black px-3 py-2.5 text-sm ${neoInput}`} />
              </div>
            </section>

            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className={`${neoBtn} px-3 py-1.5 text-xs ${category === c ? 'bg-black text-white' : 'bg-white'}`}>{c}</button>
              ))}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s, i) => (
                <article key={s.id} className={`${['bg-[#FFE600]', 'bg-white', 'bg-[#00E676]/30', 'bg-[#FF007A]/15'][i % 4]} p-5 flex flex-col ${neoCardSm}`}>
                  <div className="flex justify-between gap-2">
                    <span className={`text-[11px] font-black uppercase px-2 py-1 border-[3px] border-black ${s.isVerified ? 'bg-[#00E676]' : 'bg-[#FFE600]'}`}>
                      {s.isVerified ? '✓ Terverifikasi RT/RW' : 'Belum Terverifikasi'}
                    </span>
                    <Stars value={s.avgRating} />
                  </div>
                  <h3 className="mt-3 text-lg font-black uppercase leading-tight">{s.skill}</h3>
                  <p className="text-sm font-bold">👤 {s.name} • 📍 {s.location}</p>
                  <p className="text-xs font-black mt-1">💰 {formatPrice(s.price)}</p>
                  <p className="text-xs font-bold opacity-60">💬 {s.reviewCount} ulasan</p>
                  <button onClick={() => setDetail(s)} className={`${neoBtn} mt-2 bg-black text-white py-2.5 text-xs`}>Lihat Detail & Kontak →</button>
                  <button onClick={() => createOrder(s.id)} disabled={orderingId === s.id} className={`${neoBtn} mt-2 bg-[#0052FF] text-white py-2.5 text-xs disabled:opacity-50`}>
                    {orderingId === s.id ? 'Memesan...' : 'Pesan Jasa Ini →'}
                  </button>
                </article>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className={`mt-6 bg-white p-10 text-center ${neoCard}`}><p className="font-black uppercase text-lg">Data tidak ditemukan 🥲</p><p className="mt-1 text-sm font-bold opacity-60">Silakan coba kata kunci atau kategori lain.</p></div>
            )}
          </>
        )}

        {/* ===== Lapor Warga: POST /contacts ===== */}
        <section className={`mt-12 bg-white p-6 ${neoCard}`}>
          <h2 className="text-2xl font-black uppercase inline-block bg-black text-white px-3 py-1 rotate-[-1deg]">Lapor Warga 📢</h2>
          <p className="mt-3 text-sm font-bold opacity-70">Ada gangguan, usulan, atau laporan untuk pengurus? Sampaikan di sini, langsung tercatat di Dashboard Admin.</p>
          <form onSubmit={handleReport} className="mt-4 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase">Nama Pelapor</label>
              <input value={reportForm.name} onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })} placeholder="Nama Anda" className={`mt-1 w-full bg-[#FAF8F5] px-3 py-2.5 text-sm ${neoInput}`} required />
            </div>
            <div>
              <label className="text-xs font-black uppercase">Email (opsional)</label>
              <input type="email" value={reportForm.email} onChange={(e) => setReportForm({ ...reportForm, email: e.target.value })} placeholder="warga@rt01.id" className={`mt-1 w-full bg-[#FAF8F5] px-3 py-2.5 text-sm ${neoInput}`} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-black uppercase">Subjek</label>
              <input value={reportForm.subject} onChange={(e) => setReportForm({ ...reportForm, subject: e.target.value })} placeholder="cth: Lampu jalan mati di Blok A" className={`mt-1 w-full bg-[#FAF8F5] px-3 py-2.5 text-sm ${neoInput}`} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-black uppercase">Isi Laporan</label>
              <textarea value={reportForm.message} onChange={(e) => setReportForm({ ...reportForm, message: e.target.value })} placeholder="Tulis laporan Anda secara jelas..." rows={3} className={`mt-1 w-full bg-[#FAF8F5] px-3 py-2.5 text-sm ${neoInput}`} required />
            </div>
            <button disabled={sendingReport} className={`${neoBtn} sm:col-span-2 bg-[#FF007A] text-white py-3 text-sm disabled:opacity-50`}>{sendingReport ? 'Mengirim...' : 'Kirim Laporan →'}</button>
          </form>
        </section>

        <footer className={`mt-12 bg-[#FFE600] p-4 text-center text-xs font-black uppercase ${neoCardSm}`}>© 2026 NeighborCraft Edisi Neobrutalisme — Dibuat oleh warga, untuk warga ✊</footer>
      </main>

      {/* ===== Auth modal ===== */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAuth(false)}>
          <div className={`w-full max-w-md bg-[#FAF8F5] p-6 ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black uppercase">{authMode === 'login' ? 'Masuk Akun 🔑' : 'Pendaftaran Warga 🚀'}</h3>
              <button onClick={() => setShowAuth(false)} className={`${neoBtn} bg-[#FF007A] text-white px-2 py-1 text-xs`}>✕</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['login', 'register'] as const).map((m) => (
                <button key={m} onClick={() => setAuthMode(m)} className={`${neoBtn} py-2 text-xs ${authMode === m ? 'bg-black text-white' : 'bg-white'}`}>{m === 'login' ? 'Masuk' : 'Daftar'}</button>
              ))}
            </div>
            <form onSubmit={handleAuth} className="mt-4 space-y-3">
              {authMode === 'register' && (
                <div><label className="text-xs font-black uppercase">Nama Lengkap</label>
                  <input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Nama lengkap Anda" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              )}
              <div><label className="text-xs font-black uppercase">Email</label>
                <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="warga@rt01.id" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              <div><label className="text-xs font-black uppercase">Password</label>
                <input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              {authErr && <p className="bg-[#FF007A] text-white text-xs font-black uppercase px-2 py-1 border-[3px] border-black">{authErr}</p>}
              <button className={`${neoBtn} w-full py-3 text-sm ${authMode === 'login' ? 'bg-[#0052FF] text-white' : 'bg-[#FFE600]'}`}>{authMode === 'login' ? 'Masuk Sekarang →' : 'Daftar Sekarang →'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Tambah jasa modal: POST /services ===== */}
      {showRegisterService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRegisterService(false)}>
          <div className={`w-full max-w-md bg-[#FAF8F5] p-6 ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black uppercase">Daftarkan Jasa Saya 🚀</h3>
              <button onClick={() => setShowRegisterService(false)} className={`${neoBtn} bg-[#FF007A] text-white px-2 py-1 text-xs`}>✕</button>
            </div>
            <form onSubmit={handleRegisterService} className="mt-4 space-y-3">
              <div><label className="text-xs font-black uppercase">Nama Penyedia</label>
                <input value={formRegister.name} onChange={(e) => setFormRegister({ ...formRegister, name: e.target.value })} placeholder="Nama Anda / usaha Anda" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              <div><label className="text-xs font-black uppercase">Kategori</label>
                <select value={formRegister.skill} onChange={(e) => setFormRegister({ ...formRegister, skill: e.target.value })} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required>
                  <option value="">— Pilih kategori —</option>
                  <option value="Servis">Servis</option>
                  <option value="Tukang">Tukang</option>
                  <option value="Kuliner">Kuliner</option>
                  <option value="Les">Les</option>
                  <option value="Digital">Digital</option>
                </select></div>
              <div><label className="text-xs font-black uppercase">Lokasi / Wilayah</label>
                <input value={formRegister.location} onChange={(e) => setFormRegister({ ...formRegister, location: e.target.value })} placeholder="cth: RT 02 / Blok A" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              <div><label className="text-xs font-black uppercase">Alamat Lengkap</label>
                <input value={formRegister.address} onChange={(e) => setFormRegister({ ...formRegister, address: e.target.value })} placeholder="Jl. Warga No. 1" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} /></div>
              <div><label className="text-xs font-black uppercase">No. WhatsApp</label>
                <input value={formRegister.phone} onChange={(e) => setFormRegister({ ...formRegister, phone: e.target.value })} placeholder="08xxxxxxxxxx" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              <div><label className="text-xs font-black uppercase">Harga / Tarif (Rp)</label>
                <input type="number" min={0} step={1} value={formRegister.price} onChange={(e) => setFormRegister({ ...formRegister, price: e.target.value })} placeholder="cth: 50000" className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} /></div>
              <div><label className="text-xs font-black uppercase">Deskripsi</label>
                <textarea value={formRegister.description} onChange={(e) => setFormRegister({ ...formRegister, description: e.target.value })} placeholder="Deskripsi jasa Anda" rows={2} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} required /></div>
              <button disabled={savingService} className={`${neoBtn} w-full py-3 text-sm bg-[#FFE600] text-black disabled:opacity-50`}>{savingService ? 'Menyimpan...' : 'Daftarkan Jasa →'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Riwayat Pesanan: GET /orders/user/:userId ===== */}
      {showOrders && user && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setShowOrders(false)}>
          <div className={`w-full max-w-2xl bg-[#FAF8F5] my-6 ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#0052FF] text-white p-5 border-b-4 border-black flex justify-between gap-3">
              <h3 className="text-xl font-black uppercase">Riwayat Pesanan Saya</h3>
              <button onClick={() => setShowOrders(false)} className={`${neoBtn} bg-[#FF007A] text-white px-2 py-1 text-xs`}>✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="font-black uppercase text-sm">Detail Pesanan ({orders.length})</p>
                {orders.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {orders.map((o) => (
                      <div key={o.id} className={`bg-white p-4 ${neoCardSm}`}>
                        <p className="font-black uppercase text-xs">Status: {o.status}</p>
                        <p className="font-bold mt-1">Jasa: {o.service?.skill ?? o.service?.name ?? o.serviceId}</p>
                        <p className="text-sm opacity-60">Dibuat: {formatDate(o.createdAt)}</p>
                        {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                          <button onClick={() => updateOrderStatus(o.id, 'COMPLETED')} className={`${neoBtn} mt-2 w-full bg-[#00E676] text-black py-2.5 text-xs`}>Selesaikan Pesanan</button>
                        )}
                        {o.status === 'PENDING' && (
                          <button onClick={() => updateOrderStatus(o.id, 'CANCELLED')} className={`${neoBtn} mt-2 w-full bg-[#FF007A] text-white py-2.5 text-xs`}>Batal Pesanan</button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-bold opacity-60">Belum ada pesanan</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Detail & reviews modal ===== */}
      {detail && user && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setDetail(null)}>
          <div className={`w-full max-w-2xl bg-[#FAF8F5] my-6 ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#0052FF] text-white p-5 border-b-4 border-black flex justify-between gap-3">
              <div>
                <span className={`text-[11px] font-black uppercase px-2 py-1 border-[3px] border-black ${detail.isVerified ? 'bg-[#00E676] text-black' : 'bg-[#FFE600] text-black'}`}>{detail.isVerified ? '✓ Terverifikasi RT/RW' : 'Belum Terverifikasi'}</span>
                <h3 className="mt-2 text-2xl font-black uppercase leading-tight">{detail.skill}</h3>
                <p className="text-sm font-bold">👤 {detail.name} • <Stars value={detail.avgRating} /> ({detail.reviewCount})</p>
              </div>
              <button onClick={() => setDetail(null)} className={`${neoBtn} self-start bg-[#FF007A] text-white px-2 py-1 text-xs shrink-0`}>✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className={`bg-white p-3 ${neoCardSm}`}><p className="text-[11px] font-black uppercase">📍 Alamat Lengkap</p><p className="text-sm font-bold">{detail.address}</p></div>
                <div className={`bg-white p-3 ${neoCardSm}`}><p className="text-[11px] font-black uppercase">📞 Kontak</p><p className="text-sm font-bold">{detail.phone} • {detail.location}</p></div>
              </div>
              <div className={`bg-white p-3 ${neoCardSm}`}><p className="text-[11px] font-black uppercase">💰 Tarif</p><p className="text-sm font-bold">{formatPrice(detail.price)}</p></div>
              <div className={`bg-[#FFE600] p-3 ${neoCardSm}`}><p className="text-[11px] font-black uppercase">📝 Deskripsi Lengkap</p><p className="text-sm font-bold">{detail.description}</p></div>
              <a href={`https://wa.me/${detail.phone.replace(/\D/g, '')}`} target="_blank" className={`${neoBtn} block text-center bg-[#00E676] py-3 text-sm`}>💬 Hubungi via WhatsApp</a>

              {isAdmin && (
                <div className="flex gap-2">
                  {!detail.isVerified && <button onClick={() => handleVerify(detail.id)} className={`${neoBtn} flex-1 bg-[#0052FF] text-white py-2.5 text-xs`}>Setujui Verifikasi ✓</button>}
                  <button onClick={() => handleDelete(detail.id)} className={`${neoBtn} flex-1 bg-[#FF007A] text-white py-2.5 text-xs`}>Hapus Jasa ✕</button>
                </div>
              )}

              {/* form review */}
              {canReview ? (
                <form onSubmit={handleReview} className={`bg-white p-4 ${neoCardSm}`}>
                  <p className="font-black uppercase text-sm">Beri Penilaian & Ulasan ⭐</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} onClick={() => setRating(n)} className={`text-2xl border-2 border-black px-1 ${n <= rating ? 'bg-[#FFE600]' : 'bg-white opacity-40'}`}>★</button>
                    ))}
                  </div>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Bagaimana pengalaman Anda menggunakan jasa ini?..." rows={2} className={`mt-3 w-full bg-[#FAF8F5] px-3 py-2 text-sm ${neoInput}`} required />
                  <button className={`${neoBtn} mt-3 w-full bg-black text-[#FFE600] py-2.5 text-xs`}>Kirim Ulasan →</button>
                </form>
              ) : (
                <div className={`bg-white p-4 ${neoCardSm}`}>
                  <p className="font-black uppercase text-sm">Beri Penilaian & Ulasan ⭐</p>
                  <p className="text-sm text-red-600 font-bold mt-2">Anda hanya dapat memberikan ulasan setelah transaksi jasa ini selesai.</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} disabled className={`text-2xl border-2 border-black px-1 ${n <= rating ? 'bg-[#FFE600]' : 'bg-white opacity-40'}`}>★</button>
                    ))}
                  </div>
                  <textarea disabled placeholder="Bagaimana pengalaman Anda menggunakan jasa ini?..." rows={2} className={`mt-3 w-full bg-[#FAF8F5] px-3 py-2 text-sm ${neoInput}`} readOnly />
                  <button disabled className={`${neoBtn} mt-3 w-full bg-black text-[#FFE600] py-2.5 text-xs opacity-50`}>Kirim Ulasan →</button>
                </div>
              )}

              {/* list ulasan */}
              <div>
                <p className="font-black uppercase text-sm">Ulasan Warga ({detail.reviews.length})</p>
                <div className="mt-2 space-y-2">
                  {detail.reviews.length === 0 && <p className="text-sm font-bold opacity-60">Belum ada ulasan. Jadilah yang pertama memberikan ulasan! 🔥</p>}
                  {detail.reviews.map((rv) => (
                    <div key={rv.id} className={`bg-white p-3 ${neoCardSm}`}>
                      <p className="text-xs font-black uppercase">⭐ {rv.rating} • {rv.user?.name ?? 'Warga'}</p>
                      <p className="text-sm font-bold mt-1">{rv.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
