import type { NextFunction, Request, Response } from "express";
import {
  DomainError,
  InvalidShipmentDataError,
  InvalidTransitionError,
  ShipmentNotFoundError,
} from "../domain/errors/domainErrors.js";

// Traduce los errores de dominio a HTTP. Es el único lugar donde se hace ese mapeo: los casos
// de uso lanzan y los controllers no atrapan (Express 5 propaga el rechazo de handlers async).
// ShipmentNotFoundError cubre también el envío ajeno: 404, nunca 403 (anti-IDOR).
function statusFor(error: DomainError): number {
  if (error instanceof ShipmentNotFoundError) return 404;
  if (error instanceof InvalidTransitionError) return 409;
  if (error instanceof InvalidShipmentDataError) return 400;
  return 500;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof DomainError) {
    res.status(statusFor(error)).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }

  console.error("Error inesperado:", error);
  res.status(500).json({ success: false, message: "Error interno del servidor" });
}
