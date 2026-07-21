import type { Shipment } from "../../domain/entities/shipment.js";
import type { ShipmentRepository } from "../../domain/repositories/shipmentRepository.js";
import { getDb } from "../mongo/mongo.js";
import { type ShipmentDocument, toDocument, toDomain } from "../schemas/shipmentSchema.js";

const collection = () => getDb().collection<ShipmentDocument>("shipments");

export const mongoShipmentRepository: ShipmentRepository = {
  async save(shipment: Shipment): Promise<void> {
    await collection().insertOne(toDocument(shipment));
  },

  async findById(id: string): Promise<Shipment | null> {
    const doc = await collection().findOne({ _id: id });
    return doc ? toDomain(doc) : null;
  },

  async findAll(limit: number, skip: number): Promise<Shipment[]> {
    const docs = await collection().find().skip(skip).limit(limit).toArray();
    return docs.map(toDomain);
  },

  async update(shipment: Shipment): Promise<void> {
    await collection().replaceOne({ _id: shipment.id }, toDocument(shipment));
  },
};
