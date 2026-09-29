# NeighborCraft Fase 2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend terintegrasi JWT penuh (Bearer di semua fetch) dengan dashboard provider/pelanggan, pencarian jasa, notifikasi bell polling, plus penguncian guard backend L3.

**Architecture:** L1 membangun `lib/auth.ts` + `apiFetch` Bearer di `lib/api.ts` yang dipakai semua halaman; L2 membangun 4 area halaman di atasnya dengan polling interval; L3 mengonversi `/admin` ke `apiFetch` lalu mengunci endpoint backend yang diparkir di Fase 1.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript strict, NestJS 12 + `@nestjs/jwt`, Prisma 5.22, `vitest` (backend), polling `setInterval` (tanpa SSE/WebSocket).

**Spec:** `docs/superpowers/specs/2026-09-29-neighborcraft-fase2-frontend-design.md`

## Global Constraints

- Full Bearer: setiap fetch ke API wajib header `Authorization: Bearer <token>` bila sesi ada; 401 → logout + redirect `/`.
- Token + user tersimpan di `localStorage` (`neighborcraft_session_v2`: `{ user, accessToken }`); kunci lama `neighborcraft_user` dimigrasi (dibaca sekali lalu dihapus).
- Upload portofolio = URL string saja; tidak ada upload biner/multipart di Fase 2.
- Bell/notifikasi = polling 30–60 detik (`setInterval` + cleanup); tidak ada SSE/WebSocket.
- Status order hanya `PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED`; transisi ikut aturan backend Fase 1.
- Rating integer 1–5; review selalu menyertakan `orderId`.
- Confirm hapus jasa: exact `Apakah Anda yakin ingin menghapus permanen jasa ini?`.
- Confirm hapus warga (tetap): exact `Apakah Anda yakin ingin menghapus permanen warga ini dari database?`.
- Tanpa `any` implisit di kode baru; error fetch menampilkan `err.message` backend.
- Gaya Neo-brutalism existing (`neoCard`, `neoBtn`, `neoInput`) dipakai ulang, bukan sistem baru.

---

### Task 1: L1 auth client + apiFetch

**Files:**
- Create: `apps/web/lib/auth.ts`
- Modify: `apps/web/lib/api.ts` (bungkus ulang penuh, tipe diperluas)
- Modify: `apps/web/app/page.tsx` (login/register simpan token)
- Test: `apps/web` via `bun run check-types` + `bun run lint`

**Interfaces:**
- Consumes: backend `POST /auth/register`, `POST /auth/login` → `{ message, user, accessToken }`
- Produces: `saveSession(user, accessToken)`, `getToken(): string | null`, `getSessionUser(): SessionUser | null`, `logout()`, `apiFetch(path, init?)`, semua helper API lama dengan signature sama + field baru

- [ ] **Step 1: Tulis `lib/auth.ts`**

```ts
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned?: boolean;
}

const SESSION_KEY = 'neighborcraft_session_v2';
const LEGACY_KEY = 'neighborcraft_user';

export function saveSession(user: SessionUser, accessToken: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user, accessToken }));
  localStorage.removeItem(LEGACY_KEY);
}

export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return typeof parsed.accessToken === 'string' ? parsed.accessToken : null;
  } catch {
    return null;
  }
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { user?: SessionUser };
      if (parsed.user?.id && parsed.user?.email) return parsed.user;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as SessionUser;
      if (parsed?.id && parsed?.email) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_KEY);
  window.location.href = '/';
}
```

- [ ] **Step 2: Bungkus ulang `lib/api.ts` di atas `apiFetch`**

```ts
import { getToken, logout } from './auth.js';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const [k, v] of Object.entries(init?.headers ?? {})) headers[k] = v as string;
  const token = typeof window !== 'undefined' ? getToken() : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined') logout();
  return res;
}

async function readJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `${label} gagal: ${res.status}` }));
    throw new Error(typeof err.message === 'string' ? err.message : `${label} gagal`);
  }
  return res.json() as Promise<T>;
}
```

Perluas tipe `Service` dengan `category: string; priceType: string; isAvailable: boolean; latitude?: number | null; longitude?: number | null; isDeleted: boolean;` dan `Order` dengan `deliveryAddress: string; latitude?: number | null; longitude?: number | null; notes?: string | null; customerPhone: string; cancelReason?: string | null; completedAt?: string | null; waLink?: string; mapsLink?: string; review?: unknown | null;`. Semua fungsi lama (`getServices`, `createService`, `createOrder`, `getUserOrders`, `updateOrderStatus`, `getUsers`, `getAllOrders`, `getContacts`, `createContact`, `updateServiceAdmin`, `updateUser`, `deleteUser`) dialihkan ke `apiFetch` dengan signature yang sama, plus fungsi baru: `register`, `login` (kembalikan `{ user, accessToken }`), `getProviderOrders`, `updateOrderStatusFull(id, status, cancelReason?)`, `createReview`, `getServiceReviews`, `getNotifications`, `markNotificationRead`, `deleteService`, `updateServiceAvailability`.

- [ ] **Step 3: Simpan token di `app/page.tsx`**

Ubah handler login/register: `const data = await res.json(); saveSession(data.user, data.accessToken);` lalu redirect sesuai role (`ADMIN` → `/admin`, warga → `/services`). Ganti pembacaan `localStorage neighborcraft_user` menjadi `getSessionUser()`.

- [ ] **Step 4: Verifikasi**

Run: `bun run check-types` di `apps/web`
Expected: PASS (exit 0)

Run: `bun run lint` di `apps/web`
Expected: tidak ada error baru di `lib/` (error pre-existing di `app/` diabaikan bila sudah ada sebelum task; buktikan dengan `git stash` tidak diperlukan — cukup catat file/line error dan pastikan bukan dari file task ini)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/lib/api.ts apps/web/app/page.tsx
git commit -m "feat(web): L1 auth client Bearer + apiFetch"
```

---

### Task 2: Dashboard provider `/dashboard/provider`

**Files:**
- Create: `apps/web/app/dashboard/provider/page.tsx`
- Test: `apps/web` via `bun run check-types` + `bun run lint`

**Interfaces:**
- Consumes: Task 1 (`apiFetch`, `getSessionUser`, tipe `Service`/`Order` baru)
- Produces: halaman provider (tidak diekspor ke task lain selain pola polling/filter)

- [ ] **Step 1: Tulis halaman dengan dua tab**

Struktur (ikuti pola `apps/web/app/admin/page.tsx`: `'use client'`, `export const dynamic = 'force-dynamic'`, konstanta `neoCard/neoBtn/neoInput`, state `user/checked/tab/loading/toast`):
- Guard: `getSessionUser()`; tanpa sesi → tampil "Masuk dulu" + link `/`; halaman ini untuk semua warga (bukan khusus ADMIN).
- Tab `katalog`: daftar jasa milik sendiri (`GET /services?all=true` lalu filter `s.user?.id === user.id`), form tambah (`POST /services` tanpa `userId` — backend pakai `sub`), form edit (`PATCH /services/:id/admin`), toggle `isAvailable` (`PATCH /services/:id/admin { isAvailable }`), hapus (`DELETE /services/:id` + `confirm('Apakah Anda yakin ingin menghapus permanen jasa ini?')` + tangani `softDeleted` seperti pola admin).
- Tab `pesanan`: `GET /orders/provider` + polling 30 detik (`setInterval` + `clearInterval` di cleanup); filter chips (Semua/Menunggu=`PENDING,CONFIRMED`/Diproses=`IN_PROGRESS`/Selesai=`COMPLETED`/Dibatalkan=`CANCELLED`); kartu berisi nama/telepon pemesan, `deliveryAddress`, `notes`, link `<a href={o.mapsLink} target="_blank">Pinpoint Maps</a>`, tombol `<a href={o.waLink} target="_blank">WA</a>`; aksi `PATCH /orders/:id/status` (Terima→`CONFIRMED`, Mulai→`IN_PROGRESS`, Selesaikan→`COMPLETED`, Batalkan→`prompt cancelReason` → `CANCELLED`); setelah aksi panggil ulang fetch.
- Field form: `name, skill, category, priceType (FIXED/HOURLY/ESTIMATE), price, location, address, phone, description, portfolioUrl (string URL), latitude?, longitude?, isAvailable`. Tanpa upload file.

- [ ] **Step 2: Verifikasi**

Run: `bun run check-types` di `apps/web`
Expected: PASS (exit 0)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/provider/page.tsx
git commit -m "feat(web): dashboard provider katalog + pesanan masuk"
```

---

### Task 3: Dashboard pelanggan `/dashboard/orders` + modal ulasan

**Files:**
- Create: `apps/web/app/dashboard/orders/page.tsx`
- Test: `apps/web` via `bun run check-types` + `bun run lint`

**Interfaces:**
- Consumes: Task 1 (`apiFetch`, tipe `Order`/`Review`)
- Produces: halaman pesanan saya + modal ulasan

- [ ] **Step 1: Tulis halaman**

Struktur pola admin (`'use client'`, guard sesi, `loading/toast`):
- Muat `GET /orders/user/:id` + polling 30 detik; tampilkan status progres tiap kartu (PENDING→CONFIRMED→IN_PROGRESS→COMPLETED/CANCELLED) + `completedAt` bila ada.
- Jika `order.status === 'COMPLETED'` dan belum ada `order.review`: tombol "Beri Ulasan ★" membuka modal (rating 1–5 button bintang, textarea comment) → `POST /reviews { rating, serviceId, userId, orderId: order.id, comment }`; sukses → refresh + toast; error backend (duplikat/belum selesai) → toast error dengan `err.message`.
- Batalkan pesanan sendiri bila masih `PENDING/CONFIRMED` (prompt `cancelReason`).

- [ ] **Step 2: Verifikasi**

Run: `bun run check-types` di `apps/web`
Expected: PASS (exit 0)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/orders/page.tsx
git commit -m "feat(web): dashboard pesanan saya + modal ulasan"
```

---

### Task 4: Pencarian jasa `/services` + detail

**Files:**
- Create: `apps/web/app/services/page.tsx`
- Create: `apps/web/app/services/[id]/page.tsx`
- Test: `apps/web` via `bun run check-types` + `bun run lint`

**Interfaces:**
- Consumes: Task 1 (`getServices`, `getServiceReviews`, `createOrder`)
- Produces: halaman daftar + detail (mandiri)

- [ ] **Step 1: Tulis halaman daftar**

Filter dinamis (state): kategori (text/select dari data), rentang harga (min/max number), rating bintang minimum (number, bandingkan `avgRating`), status buka/tutup (`isAvailable && !isDeleted`). Kartu: nama, skill/kategori, harga, rating (`avgRating (reviewCount)`), badge Buka/Tutup, link detail. Tanpa token pun bisa dibuka (GET publik), tetapi tombol "Pesan" meminta login bila tanpa sesi.

- [ ] **Step 2: Tulis halaman detail**

`GET /services/:id` + `GET /reviews/service/:id` (ulasan transparan: nama, rating, comment, tanggal). Form pesan: `deliveryAddress` (wajib), `customerPhone` (wajib), `notes`, lat/lng opsional → `POST /orders`; sukses → redirect `/dashboard/orders`.

- [ ] **Step 3: Verifikasi**

Run: `bun run check-types` di `apps/web`
Expected: PASS (exit 0)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/services/page.tsx "apps/web/app/services/[id]/page.tsx"
git commit -m "feat(web): pencarian jasa + detail + ulasan"
```

---

### Task 5: Notifikasi + bell header

**Files:**
- Create: `apps/web/components/NotificationBell.tsx`
- Create: `apps/web/app/notifications/page.tsx`
- Modify: `apps/web/app/layout.tsx` (pasang bell di header global)
- Test: `apps/web` via `bun run check-types` + `bun run lint`

**Interfaces:**
- Consumes: Task 1 (`getNotifications`, `markNotificationRead`)
- Produces: `NotificationBell` + halaman notifikasi

- [ ] **Step 1: Tulis `NotificationBell`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getNotifications, markNotificationRead } from '../lib/api.js';
import { getSessionUser } from '../lib/auth.js';

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!getSessionUser()) return;
    let alive = true;
    const load = async () => {
      try {
        const list = await getNotifications();
        if (alive) setUnread(list.filter((n: { isRead: boolean }) => !n.isRead).length);
      } catch { /* abaikan polling error */ }
    };
    load();
    const t = setInterval(load, 45000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <Link href="/notifications" aria-label="Notifikasi">
      🔔{unread > 0 && <span>{unread}</span>}
    </Link>
  );
}
```

Halaman `/notifications`: daftar (`GET /notifications`), badge unread, klik item → `PATCH /notifications/:id/read` + refresh. Pasang `<NotificationBell />` di `app/layout.tsx` (client boundary: bell adalah client component; layout tetap server — impor langsung valid).

- [ ] **Step 2: Verifikasi**

Run: `bun run check-types` di `apps/web`
Expected: PASS (exit 0)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/NotificationBell.tsx apps/web/app/notifications/page.tsx apps/web/app/layout.tsx
git commit -m "feat(web): bell notifikasi polling + halaman notifikasi"
```

---

### Task 6: L3 konversi admin + hardening backend

**Files:**
- Modify: `apps/web/app/admin/page.tsx` (ganti semua `fetch` ke `apiFetch`, sesi via `lib/auth`)
- Modify: `apps/api/src/users.controller.ts` (guard +z admin-only findAll)
- Modify: `apps/api/src/services.controller.ts` (guard verify)
- Modify: `apps/api/src/orders.controller.ts` (guard + pakai `sub`)
- Modify: `apps/api/src/reviews.controller.ts` (pakai `sub`)
- Test: `apps/api/src/orders.guard.spec.ts`

**Interfaces:**
- Consumes: Task 1–5, `JwtAuthGuard`, `CurrentUser`
- Produces: admin Bearer-only; endpoint sensitif 401 tanpa token / 403 lintas pemilik

- [ ] **Step 1: Tulis locking test guard (verbatim, dipakai apa adanya)**

```ts
import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

describe('orders guard', () => {
  it('updateStatus menolak aktor asing', async () => {
    const prisma = {
      order: { findUnique: async () => ({ id: 'o1', userId: 'pemesan', status: 'PENDING', service: { userId: 'pemilik', phone: '08' }, customerPhone: '08' }) },
    };
    const svc = new OrdersService(prisma as never);
    await expect(svc.updateStatus('o1', 'CONFIRMED', { sub: 'orang-asing', role: 'WARGA' })).rejects.toThrow(ForbiddenException);
  });
  it('findByProvider hanya mengembalikan milik provider', async () => {
    const prisma = {
      order: { findMany: async (args: { where: { service: { userId: string } } }) => (args.where.service.userId === 'p1' ? [{ id: 'o1' }] : []) },
    };
    const svc = new OrdersService(prisma as never);
    const rows = await svc.findByProvider('p1');
    expect(rows).toEqual([{ id: 'o1' }]);
  });
});
```

- [ ] **Step 2: Run test, pastikan gagal/lolos sesuai implementasi**

Run: `bun run test --run src/orders.guard.spec.ts`
Expected: PASS setelah guard Fase 1 (guard sudah ada) — test ini mengunci perilaku; bila FAIL, perbaiki service dulu.

- [ ] **Step 3: Kunci controller**

`users.controller.ts`: `@UseGuards(JwtAuthGuard)` di semua rute; `findAll` + `findOne` tambahan cek `req.user.role === 'ADMIN'` (else `ForbiddenException`); `PATCH/DELETE :id` lolos bila `id === sub` atau ADMIN.
`services.controller.ts`: `PATCH :id/verify` + `@UseGuards(JwtAuthGuard)` + tolak non-ADMIN.
`orders.controller.ts`: `GET /` (admin only), `GET provider` (guard, pakai `sub`), `POST` (guard, `userId = sub`), `PATCH :id/status` (guard, teruskan actor), `GET user/:userId` (hanya pemilik/admin), `GET service/:serviceId` (hanya pemilik jasa/admin — perlu lookup service).
`reviews.controller.ts`: `POST` (guard, `userId = sub`).
`admin/page.tsx`: ganti `fetch(...)` → `apiFetch(...)`, sesi via `getSessionUser()/getToken()`, tanpa token atau bukan ADMIN → "Akses Ditolak".

- [ ] **Step 4: Verifikasi penuh**

Run: `bun run test --run` di `apps/api`
Expected: PASS semua

Run: `bun run check-types` di `apps/api` dan `apps/web`
Expected: PASS exit 0

Run: `bun run lint` di `apps/api`
Expected: PASS exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/page.tsx apps/api/src/users.controller.ts apps/api/src/services.controller.ts apps/api/src/orders.controller.ts apps/api/src/reviews.controller.ts apps/api/src/orders.guard.spec.ts
git commit -m "feat: L3 admin Bearer-only + hardening guard backend"
```
