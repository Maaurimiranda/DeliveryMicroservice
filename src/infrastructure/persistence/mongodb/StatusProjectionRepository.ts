// src/infrastructure/persistence/mongodb/StatusProjectionRepository.ts

import { Collection } from "mongodb";
import { MongoDbConnection } from "./MongoDbConnection";

export interface StatusProjection {
  status: string;
  count: number;
  shipmentIds: string[];
  updatedAt: Date;
}

export class StatusProjectionRepository {
  private collection: Collection;

  constructor() {
    const db = MongoDbConnection.getInstance().getDb();
    this.collection = db.collection("status_projection");
  }

  async incrementStatus(status: string, shipmentId: string): Promise<void> {
    await this.collection.updateOne(
      { status },
      {
        $inc: { count: 1 },
        $addToSet: { shipmentIds: shipmentId },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
  }

  async decrementStatus(status: string, shipmentId: string): Promise<void> {
    await this.collection.updateOne(
      { status },
      {
        $inc: { count: -1 },
        $pull: { shipmentIds: shipmentId },
        $set: { updatedAt: new Date() }
      }
    );

    // Eliminar si count llega a 0
    await this.collection.deleteOne({ status, count: { $lte: 0 } });
  }

  async updateShipmentStatus(
    shipmentId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await this.decrementStatus(oldStatus, shipmentId);
    await this.incrementStatus(newStatus, shipmentId);
  }

  async getStatusSummary(status: string): Promise<StatusProjection | null> {
    const doc = await this.collection.findOne({ status });
    return doc as StatusProjection | null;
  }

  async getAllStatusSummaries(): Promise<StatusProjection[]> {
    const docs = await this.collection.find({}).toArray();
    return docs as StatusProjection[];
  }

  async getTotalShipments(): Promise<number> {
    const summaries = await this.getAllStatusSummaries();
    return summaries.reduce((total, summary) => total + summary.count, 0);
  }

  async rebuildFromProjections(shipments: any[]): Promise<void> {
    // Limpiar colección
    await this.collection.deleteMany({});

    // Agrupar por estado
    const statusMap = new Map<string, string[]>();

    shipments.forEach(shipment => {
      const status = shipment.status;
      const ids = statusMap.get(status) || [];
      ids.push(shipment.id);
      statusMap.set(status, ids);
    });

    // Insertar resúmenes
    const documents = Array.from(statusMap.entries()).map(([status, shipmentIds]) => ({
      status,
      count: shipmentIds.length,
      shipmentIds,
      updatedAt: new Date()
    }));

    if (documents.length > 0) {
      await this.collection.insertMany(documents);
    }

    console.log(`✅ Status projection reconstruida: ${documents.length} estados`);
  }
}