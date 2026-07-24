import { cancel, type Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU05: un admin cancela el envío. El dominio solo lo permite desde PENDING o PREPARED.

export type CancelShipmentCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly description?: string;
};

export type CancelShipmentDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export async function cancelShipment(
  command: CancelShipmentCommand,
  deps: CancelShipmentDeps
): Promise<Shipment> {
  const { shipmentId, actor, reason, correlationId, description } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId);
  const cancelled = cancel(shipment, actor, reason, description);

  await shipmentRepo.update(cancelled);
  await publisher.shippingCancelled(cancelled, reason, correlationId);

  return cancelled;
}
