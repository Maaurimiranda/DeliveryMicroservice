// src/infrastructure/auth/AuthService.ts

import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  login: string;
  permissions?: string[];
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}

export class AuthService {
  private readonly jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Valida un token JWT
   */
  validateToken(token: string): TokenValidationResult {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      
      return {
        valid: true,
        payload: decoded
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Extrae el token del header Authorization
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   */
  hasPermission(payload: JwtPayload, permission: string): boolean {
    if (!payload.permissions) {
      return false;
    }

    return payload.permissions.includes(permission) || 
           payload.permissions.includes("admin");
  }

  /**
   * Verifica si un usuario es admin
   */
  isAdmin(payload: JwtPayload): boolean {
    return this.hasPermission(payload, "admin");
  }

  /**
   * Genera un token de prueba (solo para testing)
   */
  generateTestToken(userId: string, login: string, permissions: string[] = []): string {
    return jwt.sign(
      { userId, login, permissions },
      this.jwtSecret,
      { expiresIn: "24h" }
    );
  }

  /**
   * Decodifica un token sin verificar (útil para debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}