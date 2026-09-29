# NeighborCraft Enterprise — Design Spec Fase 1 Backend

Tanggal: 2026-09-29
Status: Approved (desain), menunggu review spec sebelum implementation plan
Scope: Fase 1 = fondasi backend saja. Frontend (/dashboard/provider, /dashboard/orders, /services, /notifications) = Fase 2 terpisah.

## 1. Konteks & Temuan

- Skema aktual: `apps/api/prisma/schema.prisma` (SQLite `file:./dev.db`).
- `packages/` saat ini hanya berisi `eslint-config/`, `typescript-config/`, `ui/` — belum ada `packages/db`.
- Auth saat ini tanpa JWT: `AuthService.register/login` kembalikan `user` tanpa token; frontend simpan user di `localStorage`.
- Controller yang ada: `services`, `orders`, `reviews`, `users`, `contacts`, `auth`. Belum ada guard kepemilikan, belum ada endpoint provider/notifications.
- Keputusan user: (a) pindah source-of-truth ke `packages/db` + JWT penuh, (b) eksekusi Fase 1 backend dulu.

## 2. Desain Database (`packages/db/prisma/schema.prisma`)

- Jadikan `packages/db/prisma/schema.prisma` sebagai source of truth (SQLite, `file:./dev.db` untuk Fase 1).
- `apps/api/prisma/schema.prisma` dipertahankan sebagai re-export/shim yang mengimpor dari `packages/db` agar `prisma generate/client` di API tetap jalan tanpa duplikasi definisi.
- SQLite tidak punya native enum → semua enum dimodelkan sebagai `String` + validasi di service layer:
  - `Service.priceType`: `FIXED | HOURLY | ESTIMATE` (default `FIXED`).
  - `Order.status`: `PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED` (default `PENDING`).
- Perubahan model:
  - `Service`: `+ isAvailable Boolean @default(true)`, `address String?` (ubah dari `String @default("")` menjadi nullable), `latitude Float?`, `longitude Float?`, `category String @default("")`, `priceType String @default("FIXED")`.
  - `Order`: `status String @default("PENDING")`, `+ deliveryAddress String @default("")`, `latitude Float?`, `longitude Float?`, `notes String?`, `customerPhone String @default("")`, `cancelReason String?`, `completedAt DateTime?`.
  - `Review`: pertahankan (`rating`, `comment`, `serviceId`, `userId`, `orderId @unique`, `createdAt`); tambah validasi rating 1–5 di service.
  - `Notification` (baru): `id String @id @default(uuid())`, `userId String`, `user User @relation(fields:[userId], references:[id], onDelete: Cascade)`, `title String`, `message String`, `isRead Boolean @default(false)`, `type String @default("ORDER")`, `createdAt DateTime @default(now())`, `@@index([userId])`.
- Relasi aman:
  - `User -> services/reviews/notifications`: `onDelete: Cascade`.
  - `User -> orders`: `onDelete: Cascade` (riwayat order ikut terhapus saat hard-delete user; konsisten dengan `UsersService.remove` hard-delete yang sudah ada).
  - `Service -> reviews`: `Cascade`; `Service -> orders`: `Restrict` (jaga riwayat transaksi; hapus jasa dengan riwayat harus soft-delete `isDeleted=true`, pola yang sudah ada di `ServicesService.deleteService`).
  - `Order -> review`: `Cascade` (hapus order menghapus review-nya; `Review.orderId` unique mencegah duplikat).
- Migrasi: `prisma db push` untuk Fase 1 (SQLite dev). `prisma migrate` menyusul saat target Postgres produksi diputuskan.
- Self-review: tidak ada placeholder; tidak ada kontradiksi dengan hard-delete user yang sudah ada; scope terbatas pada satu plan backend (bukan digabung frontend).

## 3. Desain Auth & Guard (`apps/api`)

- Tambah `@nestjs/jwt` (dan `@types/passport-jwt` bila memakai strategi passport; alternatif minimal: guard kustom verifikasi JWT via `JwtService` agar tanpa dependensi passport).
- `POST /auth/register` & `POST /auth/login`: tetap validasi lama + kembalikan `{ message, user, accessToken }` dengan payload `{ sub: user.id, email, role }`.
- `JwtAuthGuard` (global selektif): baca `Authorization: Bearer <token>`, set `req.user`; `UnauthorizedException` bila hilang/tidak valid; `isBanned` tetap ditolak saat login.
- `OwnershipGuard` untuk `PATCH /services/:id`, `PATCH /services/:id/admin`, `DELETE /services/:id`: lolos jika `service.userId === req.user.sub` ATAU `req.user.role === 'ADMIN'`; selain itu `ForbiddenException`. Endpoint publik `GET /services`, `GET /services/:id`, `POST /services` (buat dengan `userId = req.user.sub`) tetap seperti sekarang + validasi.
- Tidak ada `implicit any`: semua DTO diberi tipe eksplisit; `withRating` dan mapper diberi tipe Prisma, bukan `any`.

## 4. Desain API Fase 1

- `GET /orders/provider` (guard JWT): ambil semua order untuk jasa milik `req.user.sub` (`where: { service: { userId } }`), include `service`, `user`, `review`; urut `createdAt desc`.
- `PATCH /orders/:id/status` (guard JWT): body `{ status, cancelReason? }`; validasi transisi `PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED`, cabang `CANCELLED` dari `PENDING/CONFIRMED/IN_PROGRESS` (wajib `cancelReason`); set `completedAt = now()` saat `COMPLETED`; `NotFoundException` bila order hilang; `ForbiddenException` bila pemanggil bukan pemilik jasa, pemesan, atau admin; setiap perubahan membuat `Notification` untuk pihak lawan + mengembalikan `waLink` dan `mapsLink`.
- `POST /reviews`: hanya bila ada `Order` dengan `status COMPLETED` untuk pasangan (`serviceId`, `userId`) + belum ada review pada `orderId` tersebut; `BadRequestException` bila belum selesai/duplikat; rating int 1–5.
- Notifikasi internal: `GET /notifications?userId=` (guard, hanya milik sendiri/admin), `PATCH /notifications/:id/read`; `type` default `ORDER` (`ORDER_CREATED`, `ORDER_STATUS`, `REVIEW`).
- Helper (`apps/api/src/common/links.ts`): `mapsLink(lat?, lng?, address?) => https://www.google.com/maps/search/?api=1&query=...`, `waLink(phone, message) => https://wa.me/<digits>?text=<encoded>` (normalisasi `08..` → `62..`).
- Error handling: `NotFoundException` (user/service/order hilang), `ForbiddenException` (bukan pemilik/bukan admin), `BadRequestException` (validasi enum, transisi ilegal, duplikat review/order) di setiap endpoint baru; pola lama dipertahankan.

## 5. Non-Goals Fase 1 (masuk Fase 2)

- Halaman `/dashboard/provider`, `/dashboard/orders`, `/services` (filter dinamis), `/notifications` + bell icon.
- Upload portofolio/gambar (diputuskan di Fase 2: local storage vs object storage).
- Realtime badge (polling vs SSE vs WebSocket diputuskan di Fase 2).
- `prisma migrate` produksi / Postgres.

## 6. Verifikasi Fase 1

- `bunx prisma validate` + `prisma db push` sukses.
- `bun run check-types` (api) + `bun run lint` (oxlint) exit 0.
- Uji manual: register/login dapat token; tanpa token akses provider ditolak 401; non-pemilik edit jasa ditolak 403; alur status berurutan + notifikasi + waLink/mapsLink benar; review sebelum COMPLETED ditolak 400.
