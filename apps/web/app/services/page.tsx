'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getServices, type Service } from '../../lib/api';

export const dynamic = 'force-dynamic';

const neoCardSm = 'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
const neoBtn =
  'border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black uppercase';
const neoInput =
  'border-[3px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-[#FFE600]/30 placeholder:text-black/40 font-bold';

type Availability = 'SEMUA' | 'BUKA' | 'TUTUP';

const PRICE_TYPE_LABEL: Record<string, string> = {
  FIXED: 'Harga Tetap',
  HOURLY: 'Per Jam',
  ESTIMATE: 'Estimasi',
};

function formatPrice(price?: number | null) {
  if (price === undefined || price === null) return 'Harga hubungi penyedia';
  return `Rp${Number(price).toLocaleString('id-ID')}`;
}

function isOpen(svc: Service): boolean {
  return svc.isAvailable && !svc.isDeleted;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [checked, setChecked] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [availability, setAvailability] = useState<Availability>('SEMUA');

  const load = useCallback(async () => {
    try {
      setServices(await getServices());
    } catch {
      setServices([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [checked, load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      if (s.category) set.add(s.category);
      if (s.skill) set.add(s.skill);
    }
    return Array.from(set).sort();
  }, [services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice === '' ? null : Number(minPrice);
    const max = maxPrice === '' ? null : Number(maxPrice);
    const minR = minRating === '' ? null : Number(minRating);
    return services.filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.skill} ${s.category} ${s.location} ${s.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category && s.category !== category && s.skill !== category) return false;
      if (min !== null && (s.price === null || s.price === undefined || s.price < min)) return false;
      if (max !== null && (s.price === null || s.price === undefined || s.price > max)) return false;
      if (minR !== null && (s.avgRating ?? 0) < minR) return false;
      if (availability === 'BUKA' && !isOpen(s)) return false;
      if (availability === 'TUTUP' && isOpen(s)) return false;
      return true;
    });
  }, [services, query, category, minPrice, maxPrice, minRating, availability]);

  const resetFilters = () => {
    setQuery('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setAvailability('SEMUA');
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <h1 className="pt-4 text-2xl font-black uppercase">
          🛠️ Cari <span className="bg-[#FFE600] px-1">Jasa</span>
        </h1>

        <section className={`mt-4 bg-white p-4 ${neoCardSm}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black uppercase">Filter Pencarian</h2>
            <button onClick={resetFilters} className={`${neoBtn} bg-white px-3 py-1.5 text-xs`}>
              Reset
            </button>
          </div>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-black uppercase">Kata Kunci</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} placeholder="nama jasa, lokasi..." />
            </div>
            <div>
              <label className="text-xs font-black uppercase">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}>
                <option value="">Semua kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase">Harga Minimum (Rp)</label>
              <input type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
            </div>
            <div>
              <label className="text-xs font-black uppercase">Harga Maksimum (Rp)</label>
              <input type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`} />
            </div>
            <div>
              <label className="text-xs font-black uppercase">Rating Minimum</label>
              <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}>
                <option value="">Semua rating</option>
                <option value="4">⭐ 4 ke atas</option>
                <option value="3">⭐ 3 ke atas</option>
                <option value="2">⭐ 2 ke atas</option>
                <option value="1">⭐ 1 ke atas</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase">Status</label>
              <select value={availability} onChange={(e) => setAvailability(e.target.value as Availability)} className={`mt-1 w-full bg-white px-3 py-2.5 text-sm ${neoInput}`}>
                <option value="SEMUA">Semua status</option>
                <option value="BUKA">Buka (Menerima Pesanan)</option>
                <option value="TUTUP">Tutup Sementara</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs font-black uppercase opacity-60">
            {checked ? `${filtered.length} jasa ditemukan dari ${services.length}` : 'Memuat...'}
          </p>
        </section>

        {checked && filtered.length === 0 && (
          <p className={`mt-6 bg-white p-6 text-center font-black uppercase ${neoCardSm}`}>
            Tidak ada jasa yang cocok dengan filter ini
          </p>
        )}

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className={`bg-white p-4 flex flex-col ${neoCardSm} ${isOpen(s) ? '' : 'opacity-70'}`}>
              {s.portfolioUrl && (
                <img src={s.portfolioUrl} alt={s.name} className="mb-2 h-36 w-full object-cover border-2 border-black" />
              )}
              <div className="flex flex-wrap gap-1 mb-1">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black ${isOpen(s) ? 'bg-[#00E676]' : 'bg-[#FF007A] text-white'}`}>
                  {isOpen(s) ? '● Buka' : '⏸ Tutup Sementara'}
                </span>
                {s.isVerified && <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black bg-[#FFE600]">Terverifikasi</span>}
                {s.category && <span className="text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black bg-white">{s.category}</span>}
              </div>
              <p className="font-black uppercase text-sm">{s.name}</p>
              <p className="text-xs font-bold opacity-60">{s.skill}</p>
              <p className="mt-1 text-xs font-bold">
                📍 {s.location} • ⭐ {s.avgRating ?? 0} ({s.reviewCount ?? 0} ulasan)
              </p>
              <p className="text-sm font-black mt-1">
                {formatPrice(s.price)}{' '}
                <span className="text-[10px] opacity-60">{PRICE_TYPE_LABEL[s.priceType] ?? s.priceType}</span>
              </p>
              <p className="text-xs font-bold opacity-70 line-clamp-2 mt-1">{s.description}</p>
              <div className="mt-3 flex gap-2 mt-auto">
                {isOpen(s) ? (
                  <Link href={`/services/${s.id}`} className={`${neoBtn} bg-[#0052FF] text-white px-3 py-2 text-xs`}>
                    Detail & Pesan
                  </Link>
                ) : (
                  <>
                    <span
                      aria-disabled="true"
                      title="Jasa sedang tutup sementara, tidak bisa dipesan"
                      className={`${neoBtn} bg-[#FF007A]/30 text-black/50 px-3 py-2 text-xs cursor-not-allowed select-none`}
                    >
                      Tutup Sementara
                    </span>
                    <Link href={`/services/${s.id}`} className={`${neoBtn} bg-white px-3 py-2 text-xs`}>
                      Lihat Detail
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
