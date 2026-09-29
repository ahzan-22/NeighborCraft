import { getToken, logout } from './auth';
import type { SessionUser } from './auth';

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

export type Service = {
  id: string;
  name: string;
  skill: string;
  location: string;
  address?: string;
  phone: string;
  description?: string;
  price?: number | null;
  isVerified: boolean;
  createdAt: string;
  avgRating?: number;
  reviewCount?: number;
  category: string;
  priceType: string;
  isAvailable: boolean;
  latitude?: number | null;
  longitude?: number | null;
  isDeleted: boolean;
  portfolioUrl?: string | null;
  user?: { id: string; name: string; email: string; role: string } | null;
  reviews?: Review[];
};

export type Order = {
  id: string;
  status: string;
  serviceId: string;
  userId: string;
  createdAt: string;
  deliveryAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  customerPhone: string;
  cancelReason?: string | null;
  completedAt?: string | null;
  waLink?: string;
  mapsLink?: string;
  review?: unknown | null;
  service?: { id: string; name: string; skill: string; phone?: string; category?: string; location?: string } | null;
  user?: { id: string; name: string; email?: string; phone?: string } | null;
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  serviceId: string;
  userId: string;
  orderId: string;
  createdAt: string;
  user?: { id: string; name: string };
};

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
};

export type AuthResponse = {
  message: string;
  user: SessionUser;
  accessToken: string;
};

export async function register(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: SessionUser; accessToken: string }> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const json = await readJson<AuthResponse>(res, 'Register');
  return { user: json.user, accessToken: json.accessToken };
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<{ user: SessionUser; accessToken: string }> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const json = await readJson<AuthResponse>(res, 'Login');
  return { user: json.user, accessToken: json.accessToken };
}

export async function getServices(): Promise<Service[]> {
  const res = await apiFetch('/services', { cache: 'no-store' });
  return readJson<Service[]>(res, 'Memuat jasa');
}

export type ServiceInput = {
  name: string;
  skill: string;
  category?: string;
  priceType?: string;
  location: string;
  address?: string;
  phone: string;
  description?: string;
  price?: number | null;
  portfolioUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isAvailable?: boolean;
};

export async function createService(data: ServiceInput): Promise<Service> {
  const res = await apiFetch('/services', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return readJson<Service>(res, 'Menawarkan jasa');
}

export type DeleteServiceResult = {
  message: string;
  service?: Service;
  softDeleted: boolean;
};

export async function deleteService(id: string): Promise<DeleteServiceResult> {
  const res = await apiFetch(`/services/${id}`, { method: 'DELETE' });
  return readJson<DeleteServiceResult>(res, 'Menghapus jasa');
}

export async function updateServiceAvailability(id: string, isAvailable: boolean): Promise<Service> {
  const res = await apiFetch(`/services/${id}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ isAvailable }),
  });
  return readJson<Service>(res, 'Mengubah ketersediaan jasa');
}

export type CreateOrderInput = {
  serviceId: string;
  userId: string;
  deliveryAddress: string;
  customerPhone: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function createOrder(data: CreateOrderInput): Promise<Order> {
  const res = await apiFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return readJson<Order>(res, 'Membuat pesanan');
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  const res = await apiFetch(`/orders/user/${userId}`, {
    cache: 'no-store',
  });
  return readJson<Order[]>(res, 'Memuat pesanan');
}

export async function getProviderOrders(): Promise<Order[]> {
  const res = await apiFetch('/orders/provider', { cache: 'no-store' });
  return readJson<Order[]>(res, 'Memuat pesanan penyedia');
}

export async function updateOrderStatus(id: string, status: string) {
  const res = await apiFetch(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return readJson<Order>(res, 'Mengubah status pesanan');
}

export async function updateOrderStatusFull(id: string, status: string, cancelReason?: string) {
  const res = await apiFetch(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(cancelReason ? { status, cancelReason } : { status }),
  });
  return readJson<Order>(res, 'Mengubah status pesanan');
}

export async function getAllOrders(): Promise<Order[]> {
  const res = await apiFetch('/orders', { cache: 'no-store' });
  return readJson<Order[]>(res, 'Memuat semua pesanan');
}

export async function createReview(data: {
  rating: number;
  comment?: string;
  serviceId: string;
  userId: string;
  orderId: string;
}): Promise<Review> {
  const res = await apiFetch('/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return readJson<Review>(res, 'Mengirim ulasan');
}

export async function getServiceReviews(serviceId: string): Promise<Review[]> {
  const res = await apiFetch(`/reviews/service/${serviceId}`, {
    cache: 'no-store',
  });
  return readJson<Review[]>(res, 'Memuat ulasan');
}

export async function getNotifications(userId?: string): Promise<NotificationItem[]> {
  const res = await apiFetch(userId ? `/notifications?userId=${userId}` : '/notifications', {
    cache: 'no-store',
  });
  return readJson<NotificationItem[]>(res, 'Memuat notifikasi');
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
  return readJson<NotificationItem>(res, 'Menandai notifikasi');
}

export async function getUsers() {
  const res = await apiFetch('/users', { cache: 'no-store' });
  return readJson<SessionUser[]>(res, 'Memuat pengguna');
}

export async function getContacts() {
  const res = await apiFetch('/contacts', { cache: 'no-store' });
  return readJson(res, 'Memuat laporan');
}

export async function createContact(data: {
  name: string;
  email?: string;
  subject?: string;
  message: string;
}) {
  const res = await apiFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return readJson(res, 'Mengirim laporan');
}

// Admin API functions
export async function updateServiceAdmin(id: string, data: Partial<ServiceInput> & {
  isVerified?: boolean;
  isDeleted?: boolean;
}) {
  const res = await apiFetch(`/services/${id}/admin`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return readJson<Service>(res, 'Memperbarui jasa');
}

export async function updateUser(id: string, data: {
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'WARGA';
  isBanned?: boolean;
}) {
  const res = await apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return readJson<SessionUser>(res, 'Memperbarui pengguna');
}

export async function deleteUser(id: string) {
  const res = await apiFetch(`/users/${id}`, {
    method: 'DELETE',
  });
  return readJson(res, 'Menghapus pengguna');
}
