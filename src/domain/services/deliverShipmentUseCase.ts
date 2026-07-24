import { deliver, type Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU04: un admin confirma la entrega (IN_TRANSIT → DELIVERED). Habilita devolución y cambio.

export type DeliverShipmentCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  readonly correlationId: string;
  readonly description?: string;
};

export type DeliverShipmentDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export async function deliverShipment(
  command: DeliverShipmentCommand,
  deps: DeliverShipmentDeps
): Promise<Shipment> {
  const { shipmentId, actor, correlationId, description } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId);
  const delivered = deliver(shipment, actor, description);

  await shipmentRepo.update(delivered);
  await publisher.shippingDelivered(delivered, correlationId);

  return delivered;
}
