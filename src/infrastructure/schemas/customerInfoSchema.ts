import type { CustomerInfo } from "../../domain/entities/customerInfo.js";

// Un documento por usuario: el userId de dominio es el _id (unicidad 1:1 gratis).
export type CustomerInfoDocument = {
  _id: string;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
  updatedAt: Date;
};

export function toDocument(info: CustomerInfo): CustomerInfoDocument {
  const { userId, ...rest } = info;
  return { _id: userId, ...rest };
}

export function toDomain(doc: CustomerInfoDocument): CustomerInfo {
  const { _id, ...rest } = doc;
  return { userId: _id, ...rest };
}
