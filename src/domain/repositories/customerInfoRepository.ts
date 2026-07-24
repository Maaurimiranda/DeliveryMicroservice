import type { CustomerInfo } from "../entities/customerInfo.js";

// Interfaz pura: un documento por userId. findByUserId devuelve null cuando no existe.
export interface CustomerInfoRepository {
  save(info: CustomerInfo): Promise<void>; // upsert por userId
  findByUserId(userId: string): Promise<CustomerInfo | null>;
  update(info: CustomerInfo): Promise<void>;
}
