import type { Shipment } from "../entities/shipment.js";

// Filtro de listado (CU11): admin lista todo (sin userId); user solo lo suyo (userId presente).
export type ShipmentFilter = { readonly userId?: string };
export type Page = { readonly limit: number; readonly skip: number };

// Interfaz pura de repositorio: el dominio no conoce MongoDB.
// No lanza ShipmentNotFoundError: findById devuelve null y el caso de uso decide.
export interface ShipmentRepository {
  save(shipment: Shipment): Promise<void>;
  findById(id: string): Promise<Shipment | null>;
  // Sin defaults de paginación acá; los defaults (50/máx 100) viven en el caso de uso/controller.
  findAll(filter: ShipmentFilter, page: Page): Promise<Shipment[]>;
  // Total para la paginación de CU11 (`total`/`pages`), con el mismo filtro que findAll.
  count(filter: ShipmentFilter): Promise<number>;
  update(shipment: Shipment): Promise<void>;
}
