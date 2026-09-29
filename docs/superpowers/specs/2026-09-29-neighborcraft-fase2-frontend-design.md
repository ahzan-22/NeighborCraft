# NeighborCraft — Design Spec Fase 2 Frontend

Tanggal: 2026-09-29
Status: Approved (desain), menunggu review spec sebelum implementation plan
Scope: Fase 2 = frontend + penguncian akhir. Backend Fase 1 (commit `b744b72`) tidak diubah kecuali penambahan guard L3.

## 1. Konteks & Keputusan

- Frontend saat ini: halaman `/` dan `/admin` saja; auth via `localStorage.neighborcraft_user` tanpa token; `lib/api.ts` tanpa header `Authorization`.
- Backend Fase 1 sudah mengembalikan `accessToken` (JWT `{sub,email,role}`) dan punya endpoint provider/status/reviews/notifications + helper `waLink`/`mapsLink`.
- Keputusan user: (a) Full Bearer sekarang — semua fetch kirim token, `/admin` lama ikut dikonversi; (b) pendekatan Berlapis L1→L2→L3; (c) upload = URL gambar, bell = polling 30–60 detik.
- Temuan final-review Fase 1 yang dituntaskan di L3: guard `/users`, `/services/:id/verify`, `GET /orders`, `POST /orders`, `POST /reviews`.

## 2. L1 — Auth Client (`apps/web/lib/`)

- `lib/auth.ts` (baru): `saveSession(user, accessToken)`, `getToken()`, `getSessionUser()`, `logout()` (hapus storage + redirect `/`), tipe `SessionUser { id, name, email, role, isBanned? }`.
- `lib/api.ts` (bungkus ulang): helper internal `apiFetch(path, init?)` yang selalu menyertakan `Authorization: Bearer <token>` bila ada; respons 401 → `logout()` + redirect login; semua fungsi lama (`getServices`, `createOrder`, dst) dialihkan lewat `apiFetch` dan diperluas tipenya (`category`, `priceType`, `isAvailable`, `latitude/longitude`, `deliveryAddress`, `customerPhone`, `notes`, `cancelReason`, `completedAt`).
- Halaman login/register (`/` yang ada) menyimpan `accessToken` saat sukses; route guard sisi klien: dashboard redirect ke `/` bila tanpa token; tab admin hanya untuk `role ADMIN`.
- Tanpa `any` implisit; error fetch menampilkan pesan backend (`err.message`) via toast.

## 3. L2 — Halaman Baru

- `/dashboard/provider` (warga pemilik jasa): Tab "Katalog Jasa Saya" — form tambah & edit (nama, kategori/skill, `priceType`, harga, lokasi, alamat, lat/lng opsional, telepon/WA, deskripsi, URL portofolio, toggle `isAvailable` "Menerima Pesanan/Tutup Sementara"), hapus permanen milik sendiri dengan `confirm('Apakah Anda yakin ingin menghapus permanen jasa ini?')`. Tab "Pesanan Masuk" — ambil `GET /orders/provider`, filter (Semua/Menunggu/Diproses/Selesai/Dibatalkan), kartu berisi info pemesan, alamat lengkap, catatan, `mapsLink`, tombol WA (buka `waLink` backend), aksi Terima (`CONFIRMED`), Mulai (`IN_PROGRESS`), Selesaikan (`COMPLETED`), Batalkan (`CANCELLED` + `cancelReason` wajib).
- `/dashboard/orders` (pelanggan): "Pesanan Saya" via `GET /orders/user/:id` dengan polling 30 detik untuk progres; modal "Beri Ulasan & Bintang" aktif otomatis saat `COMPLETED` → `POST /reviews { rating 1-5, serviceId, userId, orderId, comment? }`; tolak duplikat dengan pesan backend.
- `/services` (+ `/services/:id` bila rute dinamis diizinkan): filter dinamis kategori, rentang harga, rating bintang, indikator buka/tutup (`isAvailable && !isDeleted`); daftar ulasan + rating transparan per jasa (`GET /reviews/service/:id`); tombol pesan → `POST /orders` (wajib `deliveryAddress`, `customerPhone`).
- `/notifications` + bell header: `GET /notifications` polling 30–60 detik, badge angka unread, klik menandai `PATCH /notifications/:id/read`; perubahan status order memunculkan notifikasi lawan via backend.
- Gaya mengikuti pola Neo-brutalism yang sudah ada (`neoCard`, `neoBtn`); tidak ada upload biner di Fase 2.

## 4. L3 — Konversi Admin + Hardening Backend

- `/admin` dikonversi ke `apiFetch` Bearer; akses tanpa token/role ADMIN → "Akses Ditolak".
- Backend (satu-satunya perubahan backend di Fase 2): pasang `JwtAuthGuard` pada `UsersController` (GET/PATCH/DELETE), `PATCH /services/:id/verify`, `GET /orders` (+ `user/:userId`, `service/:serviceId` — hanya pemilik/admin), `POST /orders` (abaikan `userId` body, pakai `sub`), `POST /reviews` (pakai `sub` sebagai `userId`); `ForbiddenException` bila lintas pemilik. Frontend lama yang belum kirim token akan ditolak — disengaja (keputusan Full Bearer).
- Self-review: tanpa placeholder; konsisten dengan JWT Fase 1; scope satu plan frontend (+ guard kecil); tidak ada ambiguitas rute (`/orders/provider` didaftarkan sebelum rute parametrik).

## 5. Verifikasi Fase 2

- `bun run check-types` + `eslint` web exit 0; `check-types` + `oxlint` + `vitest` api exit 0/passing.
- End-to-end manual: register/login simpan token → provider tambah jasa + toggle tersedia → pelanggan pesan + lacak progres → provider terima→mulai→selesai → pelanggan beri bintang → notifikasi + badge bell muncul di kedua sisi → tanpa token API sensitif balas 401, lintas pemilik balas 403.
