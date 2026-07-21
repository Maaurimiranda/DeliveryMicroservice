// Usuario devuelto por authgo (`GET /users/current`). Admin = "admin" en `permissions`.
export type AuthUser = {
  id: string;
  name: string;
  login: string;
  permissions: string[];
  enabled: boolean;
};

// Cache de tokens en memoria con TTL ~5 min. Key = el jwt (sin el prefijo `Bearer `),
// para que el logout (fanout `auth`, que trae el token) pueda invalidar la entrada exacta.
// Estado a nivel módulo (sin clases), igual que las conexiones Mongo/Rabbit.
const TTL_MS = 5 * 60 * 1000;

type Entry = { user: AuthUser; expiresAt: number };
const cache = new Map<string, Entry>();

export function getCachedUser(token: string): AuthUser | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(token);
    return null;
  }
  return entry.user;
}

export function setCachedUser(token: string, user: AuthUser, ttlMs: number = TTL_MS): void {
  cache.set(token, { user, expiresAt: Date.now() + ttlMs });
}

export function invalidate(token: string): void {
  cache.delete(token);
}

// Solo para tests: vacía el cache entre casos.
export function clearCache(): void {
  cache.clear();
}
