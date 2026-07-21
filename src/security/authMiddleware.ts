import type { NextFunction, Request, Response } from "express";
import { env } from "../tools/environment.js";
import {
  type AuthUser,
  getCachedUser,
  setCachedUser,
} from "./tokenCache.js";

// Dependencias inyectables para testear validateToken sin red ni env global.
export type ValidateTokenDeps = {
  fetchFn?: typeof fetch;
  authServiceUrl?: string;
};

// Valida el token contra authgo (no se verifica la firma localmente: el JWT no trae `exp`).
// Cache-aside: si está cacheado no re-consulta authgo dentro del TTL.
export async function validateToken(
  token: string,
  deps: ValidateTokenDeps = {}
): Promise<AuthUser | null> {
  const cached = getCachedUser(token);
  if (cached) return cached;

  const fetchFn = deps.fetchFn ?? fetch;
  const baseUrl = deps.authServiceUrl ?? env.authServiceUrl;

  try {
    const res = await fetchFn(`${baseUrl}/users/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const user = (await res.json()) as AuthUser;
    setCachedUser(token, user);
    return user;
  } catch {
    return null; // authgo caído / red / respuesta inválida: no autenticado
  }
}

function extractBearer(req: Request): string | null {
  const header = req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token === "" ? null : token;
}

// Middleware: exige token válido y adjunta el user al request.
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ success: false, message: "No autenticado" });
    return;
  }

  const user = await validateToken(token);
  if (!user) {
    res.status(401).json({ success: false, message: "Token inválido o expirado" });
    return;
  }

  req.user = user;
  next();
}

// Middleware: exige rol admin ("admin" en permissions). Usar después de authMiddleware.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.permissions.includes("admin")) {
    res.status(403).json({ success: false, message: "Requiere rol admin" });
    return;
  }
  next();
}
