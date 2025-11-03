// src/infrastructure/auth/JwtAuthMiddleware.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  login: string;
  permissions?: string[];
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export class JwtAuthMiddleware {
  private readonly jwtSecret: string;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          error: "No se proporcionó token de autenticación",
          message: "Authorization header is required"
        });
        return;
      }

      // Formato esperado: "Bearer <token>"
      const parts = authHeader.split(" ");
      
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        res.status(401).json({
          error: "Formato de token inválido",
          message: "Format should be: Bearer <token>"
        });
        return;
      }

      const token = parts[1];

      try {
        const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
        req.user = decoded;
        next();
      } catch (error: any) {
        if (error.name === "TokenExpiredError") {
          res.status(401).json({
            error: "Token expirado",
            message: "Your session has expired. Please login again."
          });
          return;
        }

        if (error.name === "JsonWebTokenError") {
          res.status(401).json({
            error: "Token inválido",
            message: "Invalid token"
          });
          return;
        }

        throw error;
      }
    } catch (error) {
      console.error("Error en autenticación:", error);
      res.status(500).json({
        error: "Error interno de autenticación",
        message: "Internal authentication error"
      });
    }
  };

  optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        next();
        return;
      }

      const parts = authHeader.split(" ");
      
      if (parts.length === 2 && parts[0] === "Bearer") {
        const token = parts[1];

        try {
          const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
          req.user = decoded;
        } catch (error) {
          // En modo opcional, ignoramos errores de token
          console.log("Token inválido o expirado en modo opcional");
        }
      }

      next();
    } catch (error) {
      console.error("Error en autenticación opcional:", error);
      next();
    }
  };

  requirePermission = (permission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: "No autenticado",
          message: "Authentication required"
        });
        return;
      }

      const userPermissions = req.user.permissions || [];

      if (!userPermissions.includes(permission) && !userPermissions.includes("admin")) {
        res.status(403).json({
          error: "Permiso denegado",
          message: `Required permission: ${permission}`
        });
        return;
      }

      next();
    };
  };

  requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "No autenticado",
        message: "Authentication required"
      });
      return;
    }

    const userPermissions = req.user.permissions || [];

    if (!userPermissions.includes("admin")) {
      res.status(403).json({
        error: "Permiso denegado",
        message: "Admin permission required"
      });
      return;
    }

    next();
  };
}