import {
  createExchangeShipment,
  linkRelatedShipment,
  startExchange,
  type Shipment,
} from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU08: el usuario inicia el cambio de un envío propio. El original vuelve al almacén
// (DELIVERED → RETURNING) y nace un segundo envío EXCHANGE en PENDING vinculado a él.

export type StartExchangeCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  // Motivo del cambio: es el `description` requerido del body y también el texto de tracking.
  readonly reason: string;
  readonly correlationId: string;
  readonly requesterId: string;
};

export type StartExchangeDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export type StartExchangeResult = {
  readonly originalShipment: Shipment;
  readonly newShipment: Shipment;
};

export async function startExchangeOfShipment(
  command: StartExchangeCommand,
  deps: StartExchangeDeps
): Promise<StartExchangeResult> {
  const { shipmentId, actor, reason, correlationId, requesterId } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId, requesterId);
  const returning = startExchange(shipment, actor, reason);

  // El envío de cambio reusa los artículos y el snapshot de dirección del original: si el
  // cliente editó su CustomerInfo después, el cambio igual se despacha a la dirección original.
  const newShipment = createExchangeShipment(returning, returning.articles, actor);
  // El vínculo inverso es obligatorio: sin él, completeExchange (CU09) rechaza el original.
  const originalShipment = linkRelatedShipment(returning, newShipment.id);

  await shipmentRepo.save(newShipment);
  await shipmentRepo.update(originalShipment);
  await publisher.exchangeInitiated(originalShipment, newShipment, correlationId);

  return { originalShipment, newShipment };
}
