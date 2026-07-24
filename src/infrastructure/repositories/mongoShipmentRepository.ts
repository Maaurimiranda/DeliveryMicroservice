import type { Filter } from "mongodb";
import type { Shipment } from "../../domain/entities/shipment.js";
import type {
  Page,
  ShipmentFilter,
  ShipmentRepository,
} from "../../domain/repositories/shipmentRepository.js";
import { getDb } from "../mongo/mongo.js";
import { type ShipmentDocument, toDocument, toDomain } from "../schemas/shipmentSchema.js";

const collection = () => getDb().collection<ShipmentDocument>("shipments");

// Ownership: el dueño del envío es shippingAddress.customerId (snapshot del userId al crear).
function toMongoFilter(filter: ShipmentFilter): Filter<ShipmentDocument> {
  return filter.userId ? { "shippingAddress.customerId": filter.userId } : {};
}

export const mongoShipmentRepository: ShipmentRepository = {
  async save(shipment: Shipment): Promise<void> {
    await collection().insertOne(toDocument(shipment));
  },

  async findById(id: string): Promise<Shipment | null> {
    const doc = await collection().findOne({ _id: id });
    return doc ? toDomain(doc) : null;
  },

  async findAll(filter: ShipmentFilter, page: Page): Promise<Shipment[]> {
    const docs = await collection()
      .find(toMongoFilter(filter))
      .skip(page.skip)
      .limit(page.limit)
      .toArray();
    return docs.map(toDomain);
  },

  async count(filter: ShipmentFilter): Promise<number> {
    return collection().countDocuments(toMongoFilter(filter));
  },

  async update(shipment: Shipment): Promise<void> {
    await collection().replaceOne({ _id: shipment.id }, toDocument(shipment));
  },
};
