import { Request, Response, NextFunction } from "express";
import { MongoError } from "mongodb";

// Errores personalizados
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends Error {
  public errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Middleware de manejo de errores
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log del error (en producción usar un logger apropiado)
  console.error("Error capturado:", {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Errores de dominio
  if (err instanceof DomainError) {
    res.status(400).json({
      error: "Error de dominio",
      message: err.message,
      code: "DOMAIN_ERROR"
    });
    return;
  }

  // Errores de validación
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: "Error de validación",
      message: err.message,
      errors: err.errors,
      code: "VALIDATION_ERROR"
    });
    return;
  }

  // Errores de no encontrado
  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: "Recurso no encontrado",
      message: err.message,
      code: "NOT_FOUND"
    });
    return;
  }

  // Errores de autenticación
  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: "No autenticado",
      message: err.message,
      code: "UNAUTHORIZED"
    });
    return;
  }

  // Errores de autorización
  if (err instanceof ForbiddenError) {
    res.status(403).json({
      error: "Acceso denegado",
      message: err.message,
      code: "FORBIDDEN"
    });
    return;
  }

  // Errores de MongoDB
  if (err instanceof MongoError) {
    // Error de clave duplicada
    if (err.code === 11000) {
      res.status(409).json({
        error: "Conflicto",
        message: "El recurso ya existe",
        code: "DUPLICATE_KEY"
      });
      return;
    }

    // Otros errores de MongoDB
    res.status(500).json({
      error: "Error de base de datos",
      message: process.env.NODE_ENV === "development" 
        ? err.message 
        : "Error al procesar la solicitud",
      code: "DATABASE_ERROR"
    });
    return;
  }

  // Errores de JSON inválido
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: "JSON inválido",
      message: "El cuerpo de la solicitud contiene JSON inválido",
      code: "INVALID_JSON"
    });
    return;
  }

  // Errores de JWT
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      error: "Token inválido",
      message: "El token de autenticación es inválido",
      code: "INVALID_TOKEN"
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      error: "Token expirado",
      message: "El token de autenticación ha expirado",
      code: "EXPIRED_TOKEN"
    });
    return;
  }

  // Error genérico
  res.status(500).json({
    error: "Error interno del servidor",
    message: process.env.NODE_ENV === "development" 
      ? err.message 
      : "Ha ocurrido un error inesperado",
    code: "INTERNAL_ERROR",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
};

/**
 * Middleware para rutas no encontradas (404)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `No se encontró la ruta ${req.method} ${req.path}`,
    code: "ROUTE_NOT_FOUND",
    availableRoutes: getAvailableRoutes()
  });
};

/**
 * Wrapper para funciones async en rutas
 * Captura errores automáticamente
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Obtiene lista de rutas disponibles (útil para debugging)
 */
function getAvailableRoutes(): string[] {
  return [
    "GET /health",
    "GET /api/shipments",
    "POST /api/shipments",
    "GET /api/shipments/:id",
    "GET /api/shipments/tracking/:id",
    "POST /api/shipments/:id/prepare",
    "POST /api/shipments/:id/ship",
    "POST /api/shipments/:id/deliver",
    "POST /api/shipments/:id/cancel",
    "POST /api/shipments/:id/return",
    "POST /api/shipments/:id/exchange"
  ];
}

/**
 * Logger de requests (opcional, para debugging)
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  // Log al finalizar la respuesta
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? "🔴" : "🟢";
    
    console.log(`${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

/**
 * Validador de Content-Type para POST/PUT
 */
export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"];
    
    if (!contentType || !contentType.includes("application/json")) {
      res.status(415).json({
        error: "Content-Type no soportado",
        message: "El Content-Type debe ser application/json",
        code: "UNSUPPORTED_MEDIA_TYPE"
      });
      return;
    }
  }

  next();
};

/**
 * Limitador de tamaño de payload
 */
export const validatePayloadSize = (maxSizeKB: number = 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers["content-length"];
    
    if (contentLength && parseInt(contentLength) > maxSizeKB * 1024) {
      res.status(413).json({
        error: "Payload demasiado grande",
        message: `El tamaño máximo permitido es ${maxSizeKB}KB`,
        code: "PAYLOAD_TOO_LARGE"
      });
      return;
    }

    next();
  };
};

/**
 * Handler para errores de timeout
 */
export const timeoutHandler = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      res.status(408).json({
        error: "Timeout",
        message: "La solicitud tardó demasiado tiempo en procesarse",
        code: "REQUEST_TIMEOUT"
      });
    }, timeoutMs);

    res.on("finish", () => {
      clearTimeout(timeout);
    });

    next();
  };
};