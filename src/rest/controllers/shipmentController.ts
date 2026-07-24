import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { ZodType } from "zod";
import type { Shipment } from "../../domain/entities/shipment.js";
import { cancelShipment } from "../../domain/services/cancelShipmentUseCase.js";
import { completeExchangeOfShipment } from "../../domain/services/completeExchangeUseCase.js";
import { completeReturnOfShipment } from "../../domain/services/completeReturnUseCase.js";
import { deliverShipment } from "../../domain/services/deliverShipmentUseCase.js";
import { getShipment } from "../../domain/services/getShipmentUseCase.js";
import { listShipments } from "../../domain/services/listShipmentsUseCase.js";
import { prepareShipment } from "../../domain/services/prepareShipmentUseCase.js";
import { shipShipment } from "../../domain/services/shipShipmentUseCase.js";
import { startExchangeOfShipment } from "../../domain/services/startExchangeUseCase.js";
import { startReturnOfShipment } from "../../domain/services/startReturnUseCase.js";
import { mongoShipmentRepository } from "../../infrastructure/repositories/mongoShipmentRepository.js";
import { rabbitShippingEventPublisher } from "../../rabbit/rabbitShippingEventPublisher.js";
import {
  cancelBodySchema,
  completeExchangeBodySchema,
  completeReturnBodySchema,
  listQuerySchema,
  startExchangeBodySchema,
  startReturnBodySchema,
  transitionBodySchema,
} from "../schemas/shipmentSchema.js";

const deps = {
  shipmentRepo: mongoShipmentRepository,
  publisher: rabbitShippingEventPublisher,
};

// Los errores de dominio no se atrapan acá: Express 5 propaga el rechazo de los handlers async
// al errorHandler, que es el único que traduce dominio → HTTP.

// Valida el body y responde 400 si no pasa. Devuelve null para cortar el handler.
function parseBody<T>(schema: ZodType<T>, req: Request, res: Response): T | null {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Body inválido", data: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

// Express 5 tipa los params como `string | string[]` (por los wildcards). Los nuestros son
// siempre simples; se normaliza en un solo lugar en vez de castear en cada handler.
function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isAdmin(req: Request): boolean {
  return req.user!.permissions.includes("admin");
}

// Un admin consulta cualquier envío; un usuario, solo los propios (ajeno ⇒ 404, no 403).
function requesterFor(req: Request): string | undefined {
  return isAdmin(req) ? undefined : req.user!.id;
}

// El actor queda escrito en el tracking: se usa el login, que identifica a la persona.
function actorOf(req: Request): string {
  return req.user!.login;
}

// Acciones originadas en HTTP: no hay correlation_id entrante, se genera uno nuevo.
function newCorrelationId(): string {
  return randomUUID();
}

// CU07/CU09: `notes` no tiene lugar en el dominio, se pliega en la descripción de tracking.
function trackingDescription(
  base: string,
  body: { description?: string; notes?: string }
): string | undefined {
  if (body.description !== undefined) return body.description;
  return body.notes !== undefined ? `${base}: ${body.notes}` : undefined;
}

// CU10 público: solo el seguimiento, sin dirección ni artículos.
function toTrackingView(shipment: Shipment) {
  return {
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    currentStatus: shipment.status,
    tracking: shipment.tracking,
    lastUpdate: shipment.updatedAt,
  };
}

// GET /api/shipments/tracking/:id — público (CU10).
export async function getTracking(req: Request, res: Response): Promise<void> {
  const shipment = await getShipment({ shipmentId: param(req, "id") }, deps);
  res.json({ success: true, data: toTrackingView(shipment) });
}

// GET /api/shipments/:id — propio para user, cualquiera para admin (CU10).
export async function getShipmentById(req: Request, res: Response): Promise<void> {
  const shipment = await getShipment(
    { shipmentId: param(req, "id"), requesterId: requesterFor(req) },
    deps
  );
  res.json({ success: true, data: shipment });
}

// GET /api/shipments — propios para user, todos para admin, paginado (CU11).
export async function getShipments(req: Request, res: Response): Promise<void> {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: "Query inválida", data: parsed.error.issues });
    return;
  }

  const { items, pagination } = await listShipments(
    { userId: requesterFor(req), limit: parsed.data.limit, skip: parsed.data.skip },
    deps
  );
  res.json({ success: true, data: items, pagination });
}

// POST /api/shipments/:id/prepare — admin (CU02).
export async function postPrepare(req: Request, res: Response): Promise<void> {
  const body = parseBody(transitionBodySchema, req, res);
  if (!body) return;

  const shipment = await prepareShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      correlationId: newCorrelationId(),
      description: body.description,
    },
    deps
  );
  res.json({ success: true, message: "Envío movido a PREPARED", data: shipment });
}

// POST /api/shipments/:id/ship — admin (CU03).
export async function postShip(req: Request, res: Response): Promise<void> {
  const body = parseBody(transitionBodySchema, req, res);
  if (!body) return;

  const shipment = await shipShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      correlationId: newCorrelationId(),
      description: body.description,
    },
    deps
  );
  res.json({ success: true, message: "Envío movido a IN_TRANSIT", data: shipment });
}

// POST /api/shipments/:id/deliver — admin (CU04).
export async function postDeliver(req: Request, res: Response): Promise<void> {
  const body = parseBody(transitionBodySchema, req, res);
  if (!body) return;

  const shipment = await deliverShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      correlationId: newCorrelationId(),
      description: body.description,
    },
    deps
  );
  res.json({ success: true, message: "Envío movido a DELIVERED", data: shipment });
}

// POST /api/shipments/:id/cancel — admin (CU05).
export async function postCancel(req: Request, res: Response): Promise<void> {
  const body = parseBody(cancelBodySchema, req, res);
  if (!body) return;

  const shipment = await cancelShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      reason: body.reason,
      correlationId: newCorrelationId(),
      description: body.description,
    },
    deps
  );
  res.json({ success: true, message: "Envío cancelado exitosamente", data: shipment });
}

// POST /api/shipments/:id/return — user, sobre un envío propio (CU06).
export async function postReturn(req: Request, res: Response): Promise<void> {
  const body = parseBody(startReturnBodySchema, req, res);
  if (!body) return;

  const shipment = await startReturnOfShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      reason: body.reason,
      correlationId: newCorrelationId(),
      requesterId: req.user!.id,
      description: body.description,
    },
    deps
  );
  res.json({ success: true, message: "Devolución iniciada exitosamente", data: shipment });
}

// POST /api/shipments/:id/return/complete — admin (CU07).
export async function postCompleteReturn(req: Request, res: Response): Promise<void> {
  const body = parseBody(completeReturnBodySchema, req, res);
  if (!body) return;

  const shipment = await completeReturnOfShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      productCondition: body.productCondition,
      correlationId: newCorrelationId(),
      description: trackingDescription("Devolución completada", body),
    },
    deps
  );
  res.json({ success: true, message: "Devolución completada exitosamente", data: shipment });
}

// POST /api/shipments/:id/exchange — user, sobre un envío propio (CU08).
export async function postExchange(req: Request, res: Response): Promise<void> {
  const body = parseBody(startExchangeBodySchema, req, res);
  if (!body) return;

  const { originalShipment, newShipment } = await startExchangeOfShipment(
    {
      shipmentId: param(req, "id"),
      actor: actorOf(req),
      reason: body.description,
      correlationId: newCorrelationId(),
      requesterId: req.user!.id,
    },
    deps
  );
  res.json({
    success: true,
    message: "Cambio iniciado exitosamente",
    data: { originalShipment, newShipment },
  });
}

// POST /api/shipments/:originalShipmentId/exchange/:newShipmentId/complete — admin (CU09).
export async function postCompleteExchange(req: Request, res: Response): Promise<void> {
  const body = parseBody(completeExchangeBodySchema, req, res);
  if (!body) return;

  const base = body.productCondition === "damaged" ? "Cambio rechazado" : "Cambio procesado";
  const { originalShipment, newShipment } = await completeExchangeOfShipment(
    {
      originalShipmentId: param(req, "originalShipmentId"),
      newShipmentId: param(req, "newShipmentId"),
      actor: actorOf(req),
      productCondition: body.productCondition,
      correlationId: newCorrelationId(),
      description: trackingDescription(base, body),
    },
    deps
  );
  res.json({
    success: true,
    message: "Cambio completado exitosamente",
    data: { originalShipment, newShipment },
  });
}
