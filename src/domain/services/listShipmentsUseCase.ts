import type { Shipment } from "../entities/shipment.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";

// CU11: listado paginado. Sin `userId` (admin) devuelve todos; con él, solo los del usuario.
// Los defaults y el techo de paginación viven acá, no en el repositorio.

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ListShipmentsCommand = {
  readonly userId?: string;
  readonly limit?: number;
  readonly skip?: number;
};

export type ListShipmentsDeps = {
  readonly shipmentRepo: ShipmentRepository;
};

export type ShipmentPage = {
  readonly items: readonly Shipment[];
  readonly pagination: {
    readonly limit: number;
    readonly skip: number;
    readonly total: number;
    readonly pages: number;
  };
};

// Valores fuera de rango o no numéricos caen al default en vez de romper la consulta.
function normalizeLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function normalizeSkip(skip?: number): number {
  if (skip === undefined || !Number.isFinite(skip)) return 0;
  return Math.max(Math.trunc(skip), 0);
}

export async function listShipments(
  command: ListShipmentsCommand,
  deps: ListShipmentsDeps
): Promise<ShipmentPage> {
  const { shipmentRepo } = deps;

  const limit = normalizeLimit(command.limit);
  const skip = normalizeSkip(command.skip);
  const filter = { userId: command.userId };

  const [items, total] = await Promise.all([
    shipmentRepo.findAll(filter, { limit, skip }),
    shipmentRepo.count(filter),
  ]);

  return { items, pagination: { limit, skip, total, pages: Math.ceil(total / limit) } };
}
