export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
};

export async function getServices(): Promise<Service[]> {
  const res = await fetch(`${API_URL}/services`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /services failed: ${res.status}`);
  return res.json();
}

export async function createService(data: {
  name: string;
  skill: string;
  location: string;
  address?: string;
  phone: string;
  description?: string;
  price?: number;
  userId: string;
}): Promise<Service> {
  const res = await fetch(`${API_URL}/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `POST /services failed: ${res.status}`);
  }
  return res.json();
}

export async function createOrder(data: {
  serviceId: string;
  userId: string;
}) {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `POST /orders failed: ${res.status}`);
  }
  return res.json();
}

export async function getUserOrders(userId: string) {
  const res = await fetch(`${API_URL}/orders/user/${userId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET /orders/user failed: ${res.status}`);
  return res.json();
}

export async function updateOrderStatus(id: string, status: string) {
  const res = await fetch(`${API_URL}/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `PATCH /orders status failed: ${res.status}`);
  }
  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${API_URL}/users`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /users failed: ${res.status}`);
  return res.json();
}

export async function getAllOrders() {
  const res = await fetch(`${API_URL}/orders`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /orders failed: ${res.status}`);
  return res.json();
}

export async function getContacts() {
  const res = await fetch(`${API_URL}/contacts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /contacts failed: ${res.status}`);
  return res.json();
}

export async function createContact(data: {
  name: string;
  email?: string;
  subject?: string;
  message: string;
}) {
  const res = await fetch(`${API_URL}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `POST /contacts failed: ${res.status}`);
  }
  return res.json();
}

// Admin API functions
export async function updateServiceAdmin(id: string, data: {
  name?: string;
  skill?: string;
  location?: string;
  address?: string;
  phone?: string;
  description?: string;
  price?: number | null;
  isVerified?: boolean;
  isDeleted?: boolean;
}) {
  const res = await fetch(`${API_URL}/services/${id}/admin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `PATCH /services/${id}/admin failed: ${res.status}`);
  }
  return res.json();
}

export async function updateUser(id: string, data: {
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'WARGA';
  isBanned?: boolean;
}) {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `PATCH /users/${id} failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `DELETE /users/${id} failed: ${res.status}`);
  }
  return res.json();
}
