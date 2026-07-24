import { ship, type Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU03: un admin despacha el envío (PREPARED → IN_TRANSIT). Desde acá ya no se puede cancelar.

export type ShipShipmentCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  readonly correlationId: string;
  readonly description?: string;
};

export type ShipShipmentDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export async function shipShipment(
  command: ShipShipmentCommand,
  deps: ShipShipmentDeps
): Promise<Shipment> {
  const { shipmentId, actor, correlationId, description } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId);
  const inTransit = ship(shipment, actor, description);

  await shipmentRepo.update(inTransit);
  await publisher.shippingStateChanged(inTransit, shipment.status, correlationId);

  return inTransit;
}
