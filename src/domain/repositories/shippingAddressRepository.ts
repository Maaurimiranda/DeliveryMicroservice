import type { ShippingAddress } from "../entities/shippingAddress.js";

// Interfaz pura: un documento por userId. findByUserId devuelve null cuando no existe.
export interface ShippingAddressRepository {
  save(address: ShippingAddress): Promise<void>; // upsert por userId
  findByUserId(userId: string): Promise<ShippingAddress | null>;
  update(address: ShippingAddress): Promise<void>;
}
