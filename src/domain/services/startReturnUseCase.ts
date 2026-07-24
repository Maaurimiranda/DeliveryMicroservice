import { startReturn, type Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU06: el usuario inicia la devolución de un envío propio (DELIVERED → RETURNING).

export type StartReturnCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  readonly reason: string;
  readonly correlationId: string;
  // Endpoint de usuario: siempre viene, para que un envío ajeno se reporte como inexistente.
  readonly requesterId: string;
  readonly description?: string;
};

export type StartReturnDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export async function startReturnOfShipment(
  command: StartReturnCommand,
  deps: StartReturnDeps
): Promise<Shipment> {
  const { shipmentId, actor, reason, correlationId, requesterId, description } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId, requesterId);
  const returning = startReturn(shipment, actor, reason, description);

  await shipmentRepo.update(returning);
  await publisher.returnInitiated(returning, reason, correlationId);

  return returning;
}
