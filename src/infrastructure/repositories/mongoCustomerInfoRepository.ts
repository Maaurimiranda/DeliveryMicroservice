import type { CustomerInfo } from "../../domain/entities/customerInfo.js";
import type { CustomerInfoRepository } from "../../domain/repositories/customerInfoRepository.js";
import { getDb } from "../mongo/mongo.js";
import {
  type CustomerInfoDocument,
  toDocument,
  toDomain,
} from "../schemas/customerInfoSchema.js";

const collection = () => getDb().collection<CustomerInfoDocument>("customer_info");

export const mongoCustomerInfoRepository: CustomerInfoRepository = {
  // Un documento por userId (_id = userId): crear y actualizar son el mismo upsert.
  async save(info: CustomerInfo): Promise<void> {
    const doc = toDocument(info);
    await collection().replaceOne({ _id: doc._id }, doc, { upsert: true });
  },

  async findByUserId(userId: string): Promise<CustomerInfo | null> {
    const doc = await collection().findOne({ _id: userId });
    return doc ? toDomain(doc) : null;
  },
};
