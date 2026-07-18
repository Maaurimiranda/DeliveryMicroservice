import type { ShippingAddress } from "../../domain/entities/shippingAddress.js";

// Un documento por usuario: el userId de dominio es el _id (unicidad 1:1 gratis).
export type ShippingAddressDocument = {
  _id: string;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
  updatedAt: Date;
};

export function toDocument(address: ShippingAddress): ShippingAddressDocument {
  const { userId, ...rest } = address;
  return { _id: userId, ...rest };
}

export function toDomain(doc: ShippingAddressDocument): ShippingAddress {
  const { _id, ...rest } = doc;
  return { userId: _id, ...rest };
}
