import type { CustomerInfo } from "../../domain/entities/customerInfo.js";
import type { CustomerInfoRepository } from "../../domain/repositories/customerInfoRepository.js";
import { getDb } from "../mongo/mongo.js";
import {
  type CustomerInfoDocument,
  toDocument,
  toDomain,
} from "../schemas/customerInfoSchema.js";

const collection = () => getDb().collection<CustomerInfoDocument>("customer_info");

// Un documento por userId (_id = userId): save y update son el mismo upsert.
async function upsert(info: CustomerInfo): Promise<void> {
  const doc = toDocument(info);
  await collection().replaceOne({ _id: doc._id }, doc, { upsert: true });
}

export const mongoCustomerInfoRepository: CustomerInfoRepository = {
  save: upsert,
  update: upsert,

  async findByUserId(userId: string): Promise<CustomerInfo | null> {
    const doc = await collection().findOne({ _id: userId });
    return doc ? toDomain(doc) : null;
  },
};
