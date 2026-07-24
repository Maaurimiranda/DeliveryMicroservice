import type { Shipment } from "../entities/shipment.js";
import { ShipmentNotFoundError } from "../errors/domainErrors.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";

// Carga compartida por todos los casos de uso que operan sobre un envío existente.
// Anti-IDOR: un envío ajeno se reporta igual que uno inexistente (la capa HTTP responde 404,
// nunca 403, para no filtrar qué ids existen). `requesterId` undefined = admin, ve cualquiera.
// El dueño es shippingAddress.customerId: el snapshot del userId al momento de crear el envío.
export async function loadShipment(
  shipmentRepo: ShipmentRepository,
  shipmentId: string,
  requesterId?: string
): Promise<Shipment> {
  const shipment = await shipmentRepo.findById(shipmentId);
  if (!shipment) {
    throw new ShipmentNotFoundError(shipmentId);
  }
  if (requesterId !== undefined && shipment.shippingAddress.customerId !== requesterId) {
    throw new ShipmentNotFoundError(shipmentId);
  }
  return shipment;
}
