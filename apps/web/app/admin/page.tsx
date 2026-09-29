'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const STORAGE_KEY = 'neighborcraft_user';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned?: boolean;
  _count?: {
    services: number;
    orders: number;
    reviews: number;
  };
}
interface AdminService {
  id: string;
  name: string;
  skill: string;
  location: string;
  address: string;
  phone: string;
  description: string;
  price?: number | null;
  isVerified: boolean;
  isDeleted: boolean;
  avgRating?: number;
  reviewCount?: number;
  user?: { id: string; name: string; email: string; role: string };
}
interface AdminOrder {
  id: string;
  status: string;
  serviceId: string;
  userId: string;
  createdAt: string;
  service?: { id: string; name: string; skill: string } | null;
  user?: { id: string; name: string; email?: string } | null;
}
interface AdminContact {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

type Tab = 'statistik' | 'verifikasi' | 'warga' | 'pesan';

const neoCard = 'border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]';
const neoCardSm = 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const neoBtn =
  'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black uppercase';
const neoInput =
  'border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-[#FFE600]/30 placeholder:text-black/40 font-bold';

function formatPrice(price?: number | null) {
  if (price === undefined || price === null) return 'Harga hubungi penyedia';
  return `Rp${Number(price).toLocaleString('id-ID')}`;
}

export default function AdminPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('statistik');
  const [services, setServices] = useState<AdminService[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Service Modal
  const [editService, setEditService] = useState<AdminService | null>(null);
  interface EditServiceForm {
    name?: string;
    skill?: string;
    location?: string;
    address?: string;
    phone?: string;
    description?: string;
    price?: string | number | null;
    isVerified?: boolean;
    isDeleted?: boolean;
  }
  const [editServiceForm, setEditServiceForm] = useState<EditServiceForm>({});
  const [savingService, setSavingService] = useState(false);

  // Edit User Modal
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<AuthUser>>({});
  const [savingUser, setSavingUser] = useState(false);

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        if (parsed && parsed.id && parsed.email) setUser(parsed);
      }
    } catch {
      /* abaikan */
    } finally {
      setChecked(true);
    }
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, u, o, c] = await Promise.all([
        fetch(`${API}/services?all=true`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/users`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/orders`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API}/contacts`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setServices(Array.isArray(s) ? s : []);
      setUsers(Array.isArray(u) ? u : []);
      setOrders(Array.isArray(o) ? o : []);
      setContacts(Array.isArray(c) ? c : []);
    } catch {
      showToast('Gagal memuat data admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!checked) return;
    if (user?.role === 'ADMIN') {
      fetchAll();
    } else {
      // Bukan admin: hentikan loading supaya tampil "Akses Ditolak",
      // bukan stuck di "Memuat Dashboard Admin..." selamanya.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, user]);

  // ===== SERVICE ACTIONS =====
  const handleVerify = async (id: string) => {
    try {
      const r = await fetch(`${API}/services/${id}/verify`, { method: 'PATCH' });
      if (!r.ok) throw new Error('Gagal verifikasi');
      setServices((p) => p.map((svc) => (svc.id === id ? { ...svc, isVerified: true } : svc)));
      showToast('Jasa diverifikasi');
    } catch {
      showToast('Gagal verifikasi', 'error');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Hapus jasa ini? Jika jasa memiliki riwayat pesanan/ulasan, akan dilakukan soft delete (dinonaktifkan).')) return;
    try {
      const r = await fetch(`${API}/services/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Gagal menghapus');
      const data = await r.json();
      if (data.softDeleted) {
        setServices((p) => p.map((svc) => (svc.id === id ? { ...svc, isDeleted: true } : svc)));
        showToast('Jasa dinonaktifkan (soft delete) karena memiliki riwayat');
      } else {
        setServices((p) => p.filter((svc) => svc.id !== id));
        showToast('Jasa dihapus permanen');
      }
    } catch {
      showToast('Gagal menghapus jasa', 'error');
    }
  };

  const openEditService = (svc: AdminService) => {
    setEditService(svc);
    setEditServiceForm({
      name: svc.name,
      skill: svc.skill,
      location: svc.location,
      address: svc.address,
      phone: svc.phone,
      description: svc.description,
      price: svc.price ?? '',
      isVerified: svc.isVerified,
      isDeleted: svc.isDeleted,
    });
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editService) return;
    setSavingService(true);
    try {
      const payload = { ...editServiceForm };
      if (payload.price === '' || payload.price === undefined) {
        payload.price = null;
      } else if (typeof payload.price === 'string') {
        payload.price = Number(payload.price);
      }

      const r = await fetch(`${API}/services/${editService.id}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Gagal update' }));
        throw new Error(err.message);
      }
      const updated = await r.json();
      setServices((p) => p.map((svc) => (svc.id === editService.id ? updated : svc)));
      setEditService(null);
      setEditServiceForm({});
      showToast('Jasa berhasil diperbarui');
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal memperbarui jasa', 'error');
    } finally {
      setSavingService(false);
    }
  };
  const closeEditService = () => {
    setEditService(null);
    setEditServiceForm({});
  };

  // ===== USER ACTIONS =====
  const openEditUser = (u: AuthUser) => {
    setEditUser(u);
    setEditUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      isBanned: u.isBanned,
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSavingUser(true);
    try {
      const r = await fetch(`${API}/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUserForm),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Gagal update' }));
        throw new Error(err.message);
      }
      const updated = await r.json();
      setUsers((p) => p.map((usr) => (usr.id === editUser.id ? updated.user : usr)));
      setEditUser(null);
      setEditUserForm({});
      showToast('Data warga berhasil diperbarui');
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal memperbarui warga', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus permanen warga ini dari database?')) return;
    try {
      const r = await fetch(`${API}/users/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Gagal menghapus akun warga' }));
        throw new Error(err.message ?? 'Gagal menghapus akun warga');
      }
      await r.json().catch(() => null);
      // Refresh real-time: ambil ulang daftar warga dari server.
      await fetchAll();
      showToast('Akun warga dihapus permanen');
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menghapus warga', 'error');
    }
  };

  const handleToggleBan = async (id: string, currentlyBanned: boolean) => {
    const nextBanned = !currentlyBanned;
    try {
      const r = await fetch(`${API}/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBanned: nextBanned }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Gagal mengubah status blokir' }));
        throw new Error(err.message ?? 'Gagal mengubah status blokir');
      }
      const data = await r.json();
      // Backend mengembalikan { message, user }; pakai user dari server agar tidak optimistic-stale.
      const bannedFromServer: boolean = data?.user?.isBanned ?? nextBanned;
      setUsers((p) => p.map((usr) => (usr.id === id ? { ...usr, isBanned: bannedFromServer } : usr)));
      showToast(`Akun ${bannedFromServer ? 'diblokir' : 'dibuka blokir'}`);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal mengubah status blokir', 'error');
    }
  };

  const closeEditUser = () => {
    setEditUser(null);
    setEditUserForm({});
  };

  // ===== CONTACT ACTIONS =====
  const handleContactStatus = async (id: string, status: string) => {
    try {
      const r = await fetch(`${API}/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error('Gagal update status');
      setContacts((p) => p.map((c) => (c.id === id ? { ...c, status } : c)));
      showToast(`Pesan ditandai ${status}`);
    } catch {
      showToast('Gagal update status pesan', 'error');
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Hapus pesan ini?')) return;
    try {
      const r = await fetch(`${API}/contacts/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Gagal menghapus');
      setContacts((p) => p.filter((c) => c.id !== id));
      showToast('Pesan dihapus');
    } catch {
      showToast('Gagal menghapus pesan', 'error');
    }
  };

  if (!checked || loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <p className={`${neoCardSm} bg-[#FFE600] px-6 py-4 font-black uppercase text-sm`}>
          Memuat Dashboard Admin...
        </p>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className={`bg-white p-8 max-w-md text-center ${neoCard}`}>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-2 text-xl font-black uppercase">Akses Ditolak</h1>
          <p className="mt-2 text-sm font-bold opacity-70">
            Halaman ini hanya untuk akun ber-role ADMIN. Silakan masuk sebagai admin.
          </p>
          <Link href="/" className={`${neoBtn} mt-4 inline-block bg-black text-[#FFE600] px-6 py-3 text-xs`}>
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const verified = services.filter((s) => s.isVerified && !s.isDeleted).length;
  const pending = services.filter((s) => !s.isVerified && !s.isDeleted).length;
  const disabled = services.filter((s) => s.isDeleted).length;
  const baruMsg = contacts.filter((c) => c.status === 'BARU').length;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'statistik', label: '📊 Statistik' },
    { key: 'verifikasi', label: `✅ Verifikasi Jasa${pending ? ` (${pending})` : ''}` },
    { key: 'warga', label: `👥 Daftar Warga (${users.length})` },
    { key: 'pesan', label: `✉️ Pesan/Laporan${baruMsg ? ` (${baruMsg})` : ''}` },
  ];

  const activeServices = services.filter((s) => !s.isDeleted);
  const deletedServices = services.filter((s) => s.isDeleted);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <header className="sticky top-0 z-40 bg-black text-white border-b-4 border-black">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black uppercase">
              🛠️ Dashboard <span className="bg-[#FFE600] text-black px-1">Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs font-black uppercase bg-[#00E676] text-black px-2 py-1 border-2 border-white">
              👋 {user.name}
            </span>
            <Link href="/" className={`${neoBtn} bg-[#FFE600] text-black px-3 py-1.5 text-xs`}>
              ← Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {toast && (
          <p className={`${neoCardSm} mt-4 ${toast.includes('Gagal') ? 'bg-[#FF007A] text-white' : 'bg-[#00E676]'} px-4 py-2 text-xs font-black uppercase`}>{toast}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`${neoBtn} px-3 py-2 text-xs ${tab === t.key ? 'bg-black text-white' : 'bg-white'}`}
            >
              {t.label}
            </button>
          ))}
          <button onClick={fetchAll} className={`${neoBtn} px-3 py-2 text-xs bg-[#0052FF] text-white`}>
            ↻ Muat Ulang
          </button>
        </div>

        {/* ===== STATISTIK ===== */}
        {tab === 'statistik' && (
          <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Warga', val: `${users.length}`, warna: 'bg-[#FFE600]' },
              { label: 'Jasa Aktif', val: `${activeServices.length}`, warna: 'bg-white' },
              { label: 'Jasa Nonaktif', val: `${disabled}`, warna: 'bg-[#FF007A] text-white' },
              { label: 'Terverifikasi', val: `${verified}`, warna: 'bg-[#00E676]' },
              { label: 'Perlu Verifikasi', val: `${pending}`, warna: 'bg-[#FFE600]' },
              { label: 'Total Pesanan', val: `${orders.length}`, warna: 'bg-[#0052FF] text-white' },
              { label: 'Pesan Baru', val: `${baruMsg}`, warna: 'bg-black text-white' },
              { label: 'Warga Diblokir', val: `${users.filter((u) => u.isBanned).length}`, warna: 'bg-[#FF007A] text-white' },
            ].map((s) => (
              <div key={s.label} className={`${s.warna} p-5 ${neoCardSm}`}>
                <p className="text-3xl font-black">{s.val}</p>
                <p className="text-xs font-black uppercase mt-1">{s.label}</p>
              </div>
            ))}
            <div className={`sm:col-span-2 lg:col-span-4 bg-white p-5 ${neoCardSm}`}>
              <p className="font-black uppercase text-sm">Ringkasan Pesanan per Status</p>
              <p className="mt-2 text-sm font-bold opacity-70">
                {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => {
                  const n = orders.filter((o) => o.status === st).length;
                  return `${st}: ${n}`;
                }).join(' • ') || 'Belum ada pesanan'}
              </p>
            </div>
          </section>
        )}

        {/* ===== VERIFIKASI JASA ===== */}
        {tab === 'verifikasi' && (
          <section className="mt-6 space-y-3">
            {activeServices.length === 0 && deletedServices.length === 0 && (
              <p className={`bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>Belum ada jasa</p>
            )}

            {activeServices.length > 0 && (
              <>
                <h3 className="text-lg font-black uppercase bg-[#00E676] px-3 py-2 border-4 border-black inline-block mb-2">Jasa Aktif ({activeServices.length})</h3>
                {activeServices.map((s) => (
                  <div key={s.id} className={`bg-white p-4 flex flex-wrap items-center justify-between gap-3 ${neoCardSm}`}>
                    <div>
                      <p className="font-black uppercase text-sm">
                        {s.skill} — {s.name}
                      </p>
                      <p className="text-xs font-bold opacity-60">
                        📍 {s.location} • 📞 {s.phone} • 💰 {formatPrice(s.price)} • ⭐ {s.avgRating ?? '-'} ({s.reviewCount ?? 0})
                      </p>
                      <p className="text-xs font-bold opacity-60">👤 {s.user?.name ?? '-'} ({s.user?.email ?? '-'})</p>
                      <span
                        className={`mt-1 inline-block text-[11px] font-black uppercase px-2 py-0.5 border-2 border-black ${s.isVerified ? 'bg-[#00E676]' : 'bg-[#FFE600]'}`}
                      >
                        {s.isVerified ? '✓ Terverifikasi' : '⏳ Menunggu Verifikasi'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {!s.isVerified && (
                        <button onClick={() => handleVerify(s.id)} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs`}>
                          Verifikasi ✓
                        </button>
                      )}
                      <button onClick={() => openEditService(s)} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs`}>
                        Edit ✎
                      </button>
                      <button onClick={() => handleDeleteService(s.id)} className={`${neoBtn} bg-[#FF007A] text-white px-3 py-2 text-xs`}>
                        Hapus ✕
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {deletedServices.length > 0 && (
              <>
                <h3 className="text-lg font-black uppercase bg-[#FF007A] text-white px-3 py-2 border-4 border-black inline-block mb-2 mt-4">Jasa Nonaktif/Dihapus ({deletedServices.length})</h3>
                {deletedServices.map((s) => (
                  <div key={s.id} className={`bg-white/50 p-4 flex flex-wrap items-center justify-between gap-3 ${neoCardSm} opacity-60`}>
                    <div>
                      <p className="font-black uppercase text-sm line-through">
                        {s.skill} — {s.name}
                      </p>
                      <p className="text-xs font-bold opacity-60">
                        📍 {s.location} • 📞 {s.phone} • 💰 {formatPrice(s.price)}
                      </p>
                      <span className="mt-1 inline-block text-[11px] font-black uppercase px-2 py-0.5 border-2 border-black bg-[#FF007A] text-white">
                        🗑️ Nonaktif (Soft Deleted)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditService(s)} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs`}>
                        Aktifkan / Edit ✎
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {/* ===== DAFTAR WARGA ===== */}
        {tab === 'warga' && (
          <section className="mt-6 space-y-3">
            {users.map((u) => (
              <div key={u.id} className={`bg-white p-4 flex flex-wrap items-center justify-between gap-2 ${neoCardSm} ${u.isBanned ? 'opacity-60' : ''}`}>
                <div>
                  <p className="font-black uppercase text-sm">{u.name} {u.isBanned && <span className="ml-2 text-red-600">🚫 Diblokir</span>}</p>
                  <p className="text-xs font-bold opacity-60">{u.email}</p>
                  <p className="text-[11px] font-black uppercase opacity-50">
                    Jasa: {u._count?.services ?? 0} • Pesanan: {u._count?.orders ?? 0} • Ulasan: {u._count?.reviews ?? 0}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[11px] font-black uppercase px-2 py-1 border-2 border-black ${u.role === 'ADMIN' ? 'bg-black text-[#FFE600]' : u.isBanned ? 'bg-[#FF007A] text-white' : 'bg-[#FFE600]'}`}>
                    {u.role}{u.isBanned ? ' • Blokir' : ''}
                  </span>
                  <button onClick={() => openEditUser(u)} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs`}>
                    Edit Warga ✎
                  </button>
                  <button
                    onClick={() => handleToggleBan(u.id, u.isBanned ?? false)}
                    className={`${neoBtn} ${u.isBanned ? 'bg-[#00E676] text-black' : 'bg-[#FF007A] text-white'} px-3 py-2 text-xs`}
                  >
                    {u.isBanned ? 'Buka Blokir 🔓' : 'Blokir 🔒'}
                  </button>
                  <button onClick={() => handleDeleteUser(u.id)} className={`${neoBtn} bg-[#FF007A] text-white px-3 py-2 text-xs`}>
                    Hapus Akun ✕
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className={`bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>Belum ada warga</p>
            )}
          </section>
        )}

        {/* ===== PESAN/LAPORAN ===== */}
        {tab === 'pesan' && (
          <section className="mt-6 space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className={`bg-white p-4 ${neoCardSm}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-black uppercase text-sm">{c.subject || '(Tanpa subjek)'} — {c.name}</p>
                  <span className={`text-[11px] font-black uppercase px-2 py-1 border-2 border-black ${c.status === 'BARU' ? 'bg-[#FF007A] text-white' : c.status === 'DIBACA' ? 'bg-[#FFE600]' : 'bg-[#00E676]'}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs font-bold opacity-60 mt-1">{c.email} • {new Date(c.createdAt).toLocaleString('id-ID')}</p>
                <p className="mt-2 text-sm font-bold bg-[#FAF8F5] border-2 border-black p-2">{c.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['BARU', 'DIBACA', 'SELESAI'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleContactStatus(c.id, st)}
                      className={`${neoBtn} px-2 py-1 text-[11px] ${c.status === st ? 'bg-black text-white' : 'bg-white'}`}
                    >
                      {st}
                    </button>
                  ))}
                  <button onClick={() => handleDeleteContact(c.id)} className={`${neoBtn} px-2 py-1 text-[11px] bg-[#FF007A] text-white`}>
                    Hapus ✕
                  </button>
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
              <p className={`bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>Belum ada pesan/laporan</p>
            )}
          </section>
        )}

        {/* ===== SEMUA PESANAN ===== */}
        <div className={`mt-8 ${neoCard}`}>
          <div className="bg-black text-white px-4 py-2 text-xs font-black uppercase">Semua Pesanan ({orders.length})</div>
          <div className="bg-white p-4 space-y-2 max-h-96 overflow-y-auto">
            {orders.map((o) => (
              <p key={o.id} className="text-xs font-bold border-b pb-1">
                {o.status} • {o.service?.skill ?? o.serviceId} • {o.user?.name ?? o.userId} • {new Date(o.createdAt).toLocaleString('id-ID')}
              </p>
            ))}
            {orders.length === 0 && <p className="text-xs font-bold opacity-60">Belum ada pesanan</p>}
          </div>
        </div>
      </main>

      {/* ===== EDIT SERVICE MODAL ===== */}
      {editService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeEditService}>
          <div className={`w-full max-w-2xl bg-[#FAF8F5] p-6 max-h-[90vh] overflow-y-auto ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black uppercase">Edit Jasa: {editService.name}</h3>
              <button onClick={closeEditService} className={`${neoBtn} bg-[#FF007A] text-white px-2 py-1 text-xs`}>✕</button>
            </div>
            <form onSubmit={handleUpdateService} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase">Nama Jasa</label>
                  <input
                    value={editServiceForm.name ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, name: e.target.value })}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Kategori / Skill</label>
                  <select
                    value={editServiceForm.skill ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, skill: e.target.value })}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                    required
                  >
                    <option value="Servis">Servis</option>
                    <option value="Tukang">Tukang</option>
                    <option value="Kuliner">Kuliner</option>
                    <option value="Les">Les</option>
                    <option value="Digital">Digital</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase">Lokasi / Wilayah</label>
                  <input
                    value={editServiceForm.location ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, location: e.target.value })}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase">No. WhatsApp</label>
                  <input
                    value={editServiceForm.phone ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, phone: e.target.value })}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase">Alamat Lengkap</label>
                  <input
                    value={editServiceForm.address ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, address: e.target.value })}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase">Harga (Rp, kosongkan untuk 'hubungi penyedia')</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editServiceForm.price ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, price: e.target.value })}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase">Deskripsi</label>
                  <textarea
                    value={editServiceForm.description ?? ''}
                    onChange={(e) => setEditServiceForm({ ...editServiceForm, description: e.target.value })}
                    rows={3}
                    className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editServiceForm.isVerified ?? false}
                      onChange={(e) => setEditServiceForm({ ...editServiceForm, isVerified: e.target.checked })}
                      className="w-4 h-4 accent-[#0052FF]"
                    />
                    <span className="text-sm font-black uppercase">Terverifikasi RT/RW ✓</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editServiceForm.isDeleted ?? false}
                      onChange={(e) => setEditServiceForm({ ...editServiceForm, isDeleted: e.target.checked })}
                      className="w-4 h-4 accent-[#FF007A]"
                    />
                    <span className="text-sm font-black uppercase">Nonaktif / Dihapus 🗑️</span>
                  </label>
                </div>
              </div>
              <button
                disabled={savingService}
                className={`${neoBtn} w-full py-3 text-sm bg-[#FFE600] text-black disabled:opacity-50`}
              >
                {savingService ? 'Menyimpan...' : 'Simpan Perubahan →'}
              </button>
            </form>
          </div>
      </div>
    )}

      {/* ===== EDIT USER MODAL ===== */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeEditUser}>
          <div className={`w-full max-w-md bg-[#FAF8F5] p-6 ${neoCard}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black uppercase">Edit Warga: {editUser.name}</h3>
              <button onClick={closeEditUser} className={`${neoBtn} bg-[#FF007A] text-white px-2 py-1 text-xs`}>✕</button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase">Nama Lengkap</label>
                <input
                  value={editUserForm.name ?? ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase">Email</label>
                <input
                  type="email"
                  value={editUserForm.email ?? ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase">Role</label>
                <select
                  value={editUserForm.role ?? 'WARGA'}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as 'ADMIN' | 'WARGA' })}
                  className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}
                >
                  <option value="WARGA">WARGA</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editUserForm.isBanned ?? false}
                    onChange={(e) => setEditUserForm({ ...editUserForm, isBanned: e.target.checked })}
                    className="w-4 h-4 accent-[#FF007A]"
                  />
                  <span className="text-sm font-black uppercase">Blokir Akun (Tidak bisa login) 🔒</span>
                </label>
              </div>
              <button
                disabled={savingUser}
                className={`${neoBtn} w-full py-3 text-sm bg-[#FFE600] text-black disabled:opacity-50`}
              >
                {savingUser ? 'Menyimpan...' : 'Simpan Perubahan →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}