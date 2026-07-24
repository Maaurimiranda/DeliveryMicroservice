import type { Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import { loadShipment } from "./shipmentAccess.js";

// CU10: consultar un envío. Sin `requesterId` (admin y tracking público) devuelve cualquiera;
// con él, un envío ajeno se reporta como inexistente.

export type GetShipmentCommand = {
  readonly shipmentId: string;
  readonly requesterId?: string;
};

export type GetShipmentDeps = {
  readonly shipmentRepo: ShipmentRepository;
};

export async function getShipment(
  command: GetShipmentCommand,
  deps: GetShipmentDeps
): Promise<Shipment> {
  return loadShipment(deps.shipmentRepo, command.shipmentId, command.requesterId);
}
