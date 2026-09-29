# NeighborCraft Fase 1 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fondasi backend Fase 1 (DB packages/db + JWT + guard + orders/reviews/notifications) yang testable tanpa menyentuh frontend.

**Architecture:** Source-of-truth Prisma pindah ke `packages/db/prisma/schema.prisma` (SQLite); `apps/api` memakai `@nestjs/jwt` dengan `JwtAuthGuard` + ownership check di service layer; transisi status order divalidasi berurutan dan setiap perubahan menulis `Notification` serta mengembalikan `waLink`/`mapsLink` dari helper murni.

**Tech Stack:** NestJS 12, Prisma 5.22.0, SQLite, `@nestjs/jwt` 12.x, `bcryptjs`, `vitest` 4.x, TypeScript strict (no implicit any).

**Spec:** `docs/superpowers/specs/2026-09-29-neighborcraft-enterprise-phase1-backend-design.md`

## Global Constraints

- SQLite tidak punya native enum: simpan `priceType`/`status` sebagai `String` + validasi di service.
- `priceType` hanya `FIXED | HOURLY | ESTIMATE` (default `FIXED`).
- `Order.status` hanya `PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED` (default `PENDING`).
- Transisi legal: `PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED`; `CANCELLED` hanya dari `PENDING | CONFIRMED | IN_PROGRESS` dan wajib `cancelReason`.
- `Review.rating` integer 1-5; satu review per `orderId`.
- Tidak ada `any` implisit pada kode baru; setiap endpoint memakai `NotFoundException | ForbiddenException | BadRequestException | UnauthorizedException` yang tepat.
- `prisma db push` untuk Fase 1 (bukan migrate produksi).

---

### Task 1: packages/db scaffold + schema Fase 1

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/prisma/schema.prisma`
- Modify: `apps/api/package.json` (tambah dep `@nestjs/jwt`, script `prisma:push`)
- Test: `packages/db/prisma/schema.prisma` via `bunx prisma validate`

**Interfaces:**
- Consumes: skema lama di `apps/api/prisma/schema.prisma`
- Produces: model `Notification`; field baru `Service`/`Order`; relasi cascade/restrict yang dipakai Task 2-6

- [ ] **Step 1: Buat package packages/db**

```json
{
  "name": "@neighborcraft/db",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "prisma:validate": "prisma validate",
    "prisma:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "5.22.0"
  },
  "devDependencies": {
    "prisma": "5.22.0"
  }
}
```

- [ ] **Step 2: Tulis skema Fase 1**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id            String         @id @default(uuid())
  name          String
  email         String         @unique
  password      String
  role          String         @default("WARGA")
  isBanned      Boolean        @default(false)
  services      Service[]      @relation("UserServices")
  reviews       Review[]       @relation("UserReviews")
  orders        Order[]        @relation("OrderUsers")
  notifications Notification[] @relation("UserNotifications")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model Service {
  id          String   @id @default(uuid())
  name        String
  skill       String
  category    String   @default("")
  priceType   String   @default("FIXED")
  location    String
  address     String?
  phone       String
  description String   @default("")
  price       Int?
  latitude    Float?
  longitude   Float?
  isAvailable Boolean  @default(true)
  isVerified  Boolean  @default(false)
  isDeleted   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  userId      String
  user        User     @relation("UserServices", fields: [userId], references: [id], onDelete: Cascade)
  reviews     Review[] @relation("ServiceReviews")
  orders      Order[]  @relation("OrderServices")
  @@index([userId])
}

model Order {
  id              String    @id @default(uuid())
  status          String    @default("PENDING")
  deliveryAddress String    @default("")
  latitude        Float?
  longitude       Float?
  notes           String?
  customerPhone   String    @default("")
  cancelReason    String?
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  serviceId       String
  service         Service   @relation("OrderServices", fields: [serviceId], references: [id])
  userId          String
  user            User      @relation("OrderUsers", fields: [userId], references: [id], onDelete: Cascade)
  review          Review?   @relation("OrderReviews")
  @@index([serviceId])
  @@index([userId])
}

model Review {
  id        String   @id @default(uuid())
  rating    Int
  comment   String   @default("")
  createdAt DateTime @default(now())
  serviceId String
  service   Service  @relation("ServiceReviews", fields: [serviceId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation("UserReviews", fields: [userId], references: [id], onDelete: Cascade)
  orderId   String   @unique
  order     Order    @relation("OrderReviews", fields: [orderId], references: [id], onDelete: Cascade)
  @@index([serviceId])
  @@index([userId])
}

model ContactMessage {
  id        String   @id @default(uuid())
  name      String
  email     String   @default("")
  subject   String   @default("")
  message   String
  status    String   @default("BARU")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  title     String
  message   String
  isRead    Boolean  @default(false)
  type      String   @default("ORDER")
  createdAt DateTime @default(now())
  @@index([userId])
}
```

- [ ] **Step 3: Validate schema**

Run: `bunx prisma validate --schema=packages/db/prisma/schema.prisma`
Expected: PASS (`The schema is valid`)

- [ ] **Step 4: Sinkronkan apps/api ke skema baru lalu push**

Run: salin file menjadi `apps/api/prisma/schema.prisma`, lalu `bunx prisma db push --schema=apps/api/prisma/schema.prisma`
Expected: PASS (DB SQLite ter-update tanpa error FK)

- [ ] **Step 5: Commit**

```bash
git add packages/db apps/api/prisma/schema.prisma
git commit -m "feat(db): fase1 schema packages/db + Notification dan field enterprise"
```

---

### Task 2: JWT auth + JwtAuthGuard

**Files:**
- Modify: `apps/api/package.json` (tambah `@nestjs/jwt@^12.0.1`)
- Modify: `apps/api/src/app.module.ts` (register `JwtModule`)
- Create: `apps/api/src/auth/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/current-user.decorator.ts`
- Modify: `apps/api/src/auth.service.ts` (kembalikan `accessToken`)
- Test: `apps/api/src/auth/jwt-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `JwtService`
- Produces: `JwtAuthGuard` (set `req.user: { sub: string; email: string; role: string }`), `CurrentUser()` decorator, `AuthService.login/register` mengembalikan `{ message, user, accessToken }`

- [ ] **Step 1: Tulis failing test guard**

```ts
import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  it('menolak request tanpa Bearer token', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: async () => { throw new Error('invalid'); } } as never);
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as never)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, pastikan gagal**

Run: `bun run test --run src/auth/jwt-auth.guard.spec.ts`
Expected: FAIL (`JwtAuthGuard` belum ada)

- [ ] **Step 3: Implementasi guard + decorator minimal (tanpa passport)**

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload { sub: string; email: string; role: string; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
    const header = req.headers['authorization'] ?? req.headers['Authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token tidak ditemukan');
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('Token tidak valid');
    }
  }
}
```

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from './jwt-auth.guard.js';
export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): JwtPayload => {
  return ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user;
});
```

- [ ] **Step 4: Tambah token pada AuthService**

```ts
const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
return { message: 'Login berhasil', user: safeUser, accessToken };
```

- [ ] **Step 5: Run test + typecheck**

Run: `bun run test --run src/auth/jwt-auth.guard.spec.ts`
Expected: PASS
Run: `bun run check-types`
Expected: PASS (exit 0)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth apps/api/src/auth.service.ts apps/api/package.json
git commit -m "feat(auth): JWT accessToken + JwtAuthGuard"
```

---

### Task 3: Ownership guard untuk Service EDIT/DELETE

**Files:**
- Modify: `apps/api/src/services.service.ts` (tambah `assertCanMutate`, validasi `priceType`/`isAvailable`/koordinat, hapus `any`)
- Modify: `apps/api/src/services.controller.ts` (guard + teruskan `req.user`)
- Test: `apps/api/src/services.ownership.spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `req.user: JwtPayload`
- Produces: `ServicesService.assertCanMutate(serviceUserId, actor)`; controller menolak non-pemilik dengan `ForbiddenException`

- [ ] **Step 1: Tulis failing test ownership**

```ts
import { describe, it, expect } from 'vitest';
import { ServicesService } from './services.service.js';
import { ForbiddenException } from '@nestjs/common';

describe('ownership jasa', () => {
  it('non-pemilik bukan admin ditolak', async () => {
    const svc = new ServicesService({} as never);
    expect(() => (svc as unknown as { assertCanMutate: (a: string, b: { sub: string; role: string }) => void }).assertCanMutate('owner-1', { sub: 'orang-lain', role: 'WARGA' })).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run, pastikan gagal**

Run: `bun run test --run src/services.ownership.spec.ts`
Expected: FAIL (`assertCanMutate` belum ada)

- [ ] **Step 3: Implementasi minimal**

```ts
import { ForbiddenException, BadRequestException } from '@nestjs/common';

const PRICE_TYPES = ['FIXED', 'HOURLY', 'ESTIMATE'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

assertCanMutate(serviceUserId: string, actor: { sub: string; role: string }): void {
  if (actor.role === 'ADMIN' || serviceUserId === actor.sub) return;
  throw new ForbiddenException('Anda bukan pemilik jasa ini');
}

private parsePriceType(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !((PRICE_TYPES as readonly string[]).includes(v))) {
    throw new BadRequestException('priceType harus FIXED, HOURLY, atau ESTIMATE');
  }
  return v;
}
```

Terapkan di `updateServiceAdmin`/`deleteService` sebelum mutasi; tambah field `category`, `priceType`, `isAvailable`, `latitude`, `longitude` pada DTO dengan tipe eksplisit `string | number | boolean | null | undefined` (tanpa `any`).

- [ ] **Step 4: Run test + typecheck**

Run: `bun run test --run src/services.ownership.spec.ts`
Expected: PASS
Run: `bun run check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services.service.ts apps/api/src/services.controller.ts apps/api/src/services.ownership.spec.ts
git commit -m "feat(services): ownership guard + validasi priceType"
```

---

### Task 4: Provider orders + transisi status + notifikasi hook

**Files:**
- Create: `apps/api/src/common/links.ts`
- Modify: `apps/api/src/orders.service.ts` (tambah `findByProvider`, `updateStatus` baru)
- Modify: `apps/api/src/orders.controller.ts` (`GET /orders/provider`, `PATCH /orders/:id/status` dengan guard)
- Test: `apps/api/src/orders.transitions.spec.ts`

**Interfaces:**
- Consumes: `JwtPayload`, `mapsLink`, `waLink`, model `Notification`
- Produces: `OrdersService.findByProvider(providerId: string)`, `OrdersService.updateStatus(id, status, actor, cancelReason?)` mengembalikan `{ order, waLink, mapsLink }`

- [ ] **Step 1: Tulis failing test transisi**

```ts
import { describe, it, expect } from 'vitest';
import { isValidTransition } from './orders.service.js';

describe('transisi status', () => {
  it('PENDING -> IN_PROGRESS langsung ditolak', () => {
    expect(isValidTransition('PENDING', 'IN_PROGRESS')).toBe(false);
  });
  it('PENDING -> CONFIRMED diterima', () => {
    expect(isValidTransition('PENDING', 'CONFIRMED')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, pastikan gagal**

Run: `bun run test --run src/orders.transitions.spec.ts`
Expected: FAIL (`isValidTransition` belum ada)

- [ ] **Step 3: Implementasi helper + service**

```ts
export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return NEXT[from]?.includes(to) ?? false;
}
```

```ts
export function mapsLink(lat?: number | null, lng?: number | null, address?: string | null): string {
  const q = lat != null && lng != null ? `${lat},${lng}` : (address ?? '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function waLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('08')) digits = '62' + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
```

`updateStatus`: cek `NEXT`, wajib `cancelReason` bila `CANCELLED`, set `completedAt` bila `COMPLETED`, cek `ForbiddenException` (pemilik jasa/pemesan/admin), tulis `Notification` untuk lawan, kembalikan `{ order, waLink, mapsLink }`. `CreateOrderDto` diperluas: `deliveryAddress: string`, `customerPhone: string`, `latitude?: number | null`, `longitude?: number | null`, `notes?: string`.

- [ ] **Step 4: Run test + typecheck**

Run: `bun run test --run src/orders.transitions.spec.ts`
Expected: PASS
Run: `bun run check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders.service.ts apps/api/src/orders.controller.ts apps/api/src/common/links.ts apps/api/src/orders.transitions.spec.ts
git commit -m "feat(orders): provider list + transisi status + waLink/mapsLink"
```

---

### Task 5: Review berbasis order COMPLETED

**Files:**
- Modify: `apps/api/src/reviews.service.ts` (`CreateReviewDto` tambah `orderId`, validasi COMPLETED + unik)
- Modify: `apps/api/src/reviews.controller.ts` (teruskan DTO baru)
- Test: `apps/api/src/reviews.guard.spec.ts`

**Interfaces:**
- Consumes: `Order.status`, `Review.orderId`
- Produces: `ReviewsService.createReview({ rating, serviceId, userId, orderId, comment? })`

- [ ] **Step 1: Tulis failing test**

```ts
import { describe, it, expect } from 'vitest';
import { assertRating } from './reviews.service.js';

describe('rating', () => {
  it('rating 0 ditolak', () => {
    expect(() => assertRating(0)).toThrow();
  });
  it('rating 5 diterima', () => {
    expect(() => assertRating(5)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, pastikan gagal**

Run: `bun run test --run src/reviews.guard.spec.ts`
Expected: FAIL (`assertRating` belum ada)

- [ ] **Step 3: Implementasi**

```ts
export function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestException('Rating harus bilangan bulat 1-5');
  }
}
```

`createReview` wajib menerima `orderId`; ambil order by id, pastikan `order.serviceId === serviceId && order.userId === userId && order.status === 'COMPLETED'`; tolak bila review untuk `orderId` sudah ada (`P2002` → `BadRequestException`); tulis `Notification` tipe `REVIEW` untuk pemilik jasa.

- [ ] **Step 4: Run test + typecheck**

Run: `bun run test --run src/reviews.guard.spec.ts`
Expected: PASS
Run: `bun run check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/reviews.service.ts apps/api/src/reviews.controller.ts apps/api/src/reviews.guard.spec.ts
git commit -m "feat(reviews): wajib order COMPLETED per orderId"
```

---

### Task 6: Notifications module + cleanup hard-delete

**Files:**
- Create: `apps/api/src/notifications.service.ts`
- Create: `apps/api/src/notifications.controller.ts`
- Modify: `apps/api/src/app.module.ts` (daftar controller/provider baru + `JwtModule`)
- Modify: `apps/api/src/users.service.ts` (hapus juga `notification` saat hard-delete user)
- Test: `apps/api/src/notifications.service.spec.ts`

**Interfaces:**
- Consumes: `JwtPayload`
- Produces: `GET /notifications` (milik sendiri/admin), `PATCH /notifications/:id/read`; `NotificationsService.notify(userId, title, message, type)`

- [ ] **Step 1: Tulis failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildOrderStatusMessage } from './notifications.service.js';

describe('notifikasi', () => {
  it('membuat judul status yang benar', () => {
    expect(buildOrderStatusMessage('CONFIRMED').title).toContain('CONFIRMED');
  });
});
```

- [ ] **Step 2: Run, pastikan gagal**

Run: `bun run test --run src/notifications.service.spec.ts`
Expected: FAIL (fungsi belum ada)

- [ ] **Step 3: Implementasi**

```ts
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  notify(input: { userId: string; title: string; message: string; type?: string }) {
    return this.prisma.notification.create({ data: { userId: input.userId, title: input.title, message: input.message, type: input.type ?? 'ORDER' } });
  }
  listFor(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
  async markRead(id: string, actor: { sub: string; role: string }) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException(`Notifikasi ${id} tidak ditemukan`);
    if (n.userId !== actor.sub && actor.role !== 'ADMIN') throw new ForbiddenException('Bukan notifikasi milik Anda');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }
}

export function buildOrderStatusMessage(status: string): { title: string; message: string } {
  return { title: `Pesanan ${status}`, message: `Status pesanan Anda berubah menjadi ${status}.` };
}
```

Tambahkan `this.prisma.notification.deleteMany({ where: { userId: id } })` sebagai langkah pertama `$transaction` di `UsersService.remove`.

- [ ] **Step 4: Run full verification**

Run: `bun run test --run`
Expected: PASS (semua spec hijau)
Run: `bun run check-types`
Expected: PASS
Run: `bun run lint`
Expected: PASS (oxlint exit 0)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications.service.ts apps/api/src/notifications.controller.ts apps/api/src/app.module.ts apps/api/src/users.service.ts
git commit -m "feat(notifications): modul notifikasi + cleanup hard-delete"
```
