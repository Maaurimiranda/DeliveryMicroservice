import type { AuthUser } from "./tokenCache.js";

// Augmenta Express.Request con el user autenticado que adjunta authMiddleware.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
