import {
  cancel,
  completeExchange,
  completeReturn,
  prepare,
  type Shipment,
} from "../entities/shipment.js";
import { InvalidShipmentDataError } from "../errors/domainErrors.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type {
  ProductCondition,
  ShippingEventPublisher,
} from "./shippingEventPublisher.js";

// CU09: un admin cierra el cambio evaluando la condición del producto original devuelto.
//   good | defective → el cambio procede: original EXCHANGE_PROCESSED, nuevo PREPARED.
//   damaged          → el cambio se rechaza: original RETURNED, nuevo CANCELLED.

const RECHAZO_POR_DAÑO = "producto original recibido dañado";

export type CompleteExchangeCommand = {
  readonly originalShipmentId: string;
  readonly newShipmentId: string;
  readonly actor: string;
  readonly productCondition: ProductCondition;
  readonly correlationId: string;
  readonly description?: string;
};

export type CompleteExchangeDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export type CompleteExchangeResult = {
  readonly originalShipment: Shipment;
  readonly newShipment: Shipment;
};

export async function completeExchangeOfShipment(
  command: CompleteExchangeCommand,
  deps: CompleteExchangeDeps
): Promise<CompleteExchangeResult> {
  const { originalShipmentId, newShipmentId, actor, productCondition, correlationId, description } =
    command;
  const { shipmentRepo, publisher } = deps;

  const original = await loadShipment(shipmentRepo, originalShipmentId);
  const nuevo = await loadShipment(shipmentRepo, newShipmentId);

  // Los dos ids tienen que ser las dos puntas del mismo cambio, no dos envíos cualesquiera.
  if (original.relatedShipmentId !== newShipmentId) {
    throw new InvalidShipmentDataError(
      "newShipmentId",
      `El envío ${newShipmentId} no es el envío de cambio vinculado a ${originalShipmentId}.`
    );
  }

  const rechazado = productCondition === "damaged";

  const originalShipment = rechazado
    ? completeReturn(original, actor, description)
    : completeExchange(original, actor, description);

  const newShipment = rechazado
    ? cancel(nuevo, actor, RECHAZO_POR_DAÑO)
    : prepare(nuevo, actor);

  await shipmentRepo.update(originalShipment);
  await shipmentRepo.update(newShipment);
  await publisher.exchangeFinalized(
    originalShipment,
    newShipment,
    productCondition,
    correlationId
  );

  return { originalShipment, newShipment };
}
