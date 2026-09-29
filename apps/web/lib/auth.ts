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
