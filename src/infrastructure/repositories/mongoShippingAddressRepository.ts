import type { ShippingAddress } from "../../domain/entities/shippingAddress.js";
import type { ShippingAddressRepository } from "../../domain/repositories/shippingAddressRepository.js";
import { getDb } from "../mongo.js";
import {
  type ShippingAddressDocument,
  toDocument,
  toDomain,
} from "../schemas/shippingAddressSchema.js";

const collection = () => getDb().collection<ShippingAddressDocument>("shipping_addresses");

// Un documento por userId (_id = userId): save y update son el mismo upsert.
async function upsert(address: ShippingAddress): Promise<void> {
  const doc = toDocument(address);
  await collection().replaceOne({ _id: doc._id }, doc, { upsert: true });
}

export const mongoShippingAddressRepository: ShippingAddressRepository = {
  save: upsert,
  update: upsert,

  async findByUserId(userId: string): Promise<ShippingAddress | null> {
    const doc = await collection().findOne({ _id: userId });
    return doc ? toDomain(doc) : null;
  },
};
