import type { Shipment } from "../entities/shipment.js";

// Interfaz pura de repositorio: el dominio no conoce MongoDB.
// No lanza ShipmentNotFoundError: findById devuelve null y el caso de uso decide.
export interface ShipmentRepository {
  save(shipment: Shipment): Promise<void>;
  findById(id: string): Promise<Shipment | null>;
  // Sin defaults de paginación acá; los defaults (50/máx 100) viven en el caso de uso/controller.
  findAll(limit: number, skip: number): Promise<Shipment[]>;
  update(shipment: Shipment): Promise<void>;
}
