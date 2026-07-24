import { prepare, type Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU02: un admin marca el envío como preparado (PENDING → PREPARED).

export type PrepareShipmentCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  readonly correlationId: string;
  readonly description?: string;
};

export type PrepareShipmentDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export async function prepareShipment(
  command: PrepareShipmentCommand,
  deps: PrepareShipmentDeps
): Promise<Shipment> {
  const { shipmentId, actor, correlationId, description } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId);
  const prepared = prepare(shipment, actor, description);

  await shipmentRepo.update(prepared);
  await publisher.shippingStateChanged(prepared, shipment.status, correlationId);

  return prepared;
}
