import { completeReturn, type Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";
import type {
  ProductCondition,
  ShippingEventPublisher,
} from "./shippingEventPublisher.js";

// CU07: un admin cierra la devolución (RETURNING → RETURNED). La condición del producto viaja
// en el evento; el dominio no la guarda. Sigue permitido sobre un original de cambio dañado.

export type CompleteReturnCommand = {
  readonly shipmentId: string;
  readonly actor: string;
  readonly productCondition: ProductCondition;
  readonly correlationId: string;
  readonly description?: string;
};

export type CompleteReturnDeps = {
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

export async function completeReturnOfShipment(
  command: CompleteReturnCommand,
  deps: CompleteReturnDeps
): Promise<Shipment> {
  const { shipmentId, actor, productCondition, correlationId, description } = command;
  const { shipmentRepo, publisher } = deps;

  const shipment = await loadShipment(shipmentRepo, shipmentId);
  const returned = completeReturn(shipment, actor, description);

  await shipmentRepo.update(returned);
  await publisher.returnCompleted(returned, productCondition, correlationId);

  return returned;
}
