// src/infrastructure/persistence/mongodb/ShipmentProjectionRepository.ts

import { Collection } from "mongodb";
import { MongoDbConnection } from "./MongoDbConnection";
import { Shipment } from "../../../domain/shipment/Shipment";
import { ShipmentStatus } from "../../../domain/shipment/ShipmentStatus";
import { ShipmentType } from "../../../domain/shipment/ShipmentType";

export interface IShipmentProjectionRepository {
  save(shipment: Shipment): Promise<void>;
  findById(shipmentId: string): Promise<Shipment | null>;
  findByOrderId(orderId: string): Promise<Shipment[]>;
  findByCustomerId(customerId: string): Promise<Shipment[]>;
  findByStatus(status: string): Promise<Shipment[]>;
  findAll(limit?: number, skip?: number): Promise<Shipment[]>;
  count(): Promise<number>;
  countByStatus(status: string): Promise<number>;
  delete(shipmentId: string): Promise<void>;
}

export class ShipmentProjectionRepository implements IShipmentProjectionRepository {
  private collection: Collection;
  private readonly COLLECTION_NAME = "shipment_projection";

  constructor() {
    const db = MongoDbConnection.getInstance().getDb();
    this.collection = db.collection(this.COLLECTION_NAME);
  }

  /**
   * Guarda o actualiza la proyección de un envío
   */
  async save(shipment: Shipment): Promise<void> {
    try {
      const document = this.toDocument(shipment);

      await this.collection.updateOne(
        { id: shipment.id },
        { $set: document },
        { upsert: true }
      );

      console.log(`✅ Proyección guardada/actualizada: ${shipment.id}`);
    } catch (error: any) {
      console.error(`❌ Error al guardar proyección:`, error);
      throw new Error(`Error al guardar proyección: ${error.message}`);
    }
  }

  /**
   * Busca un envío por ID
   */
  async findById(shipmentId: string): Promise<Shipment | null> {
    try {
      const document = await this.collection.findOne({ id: shipmentId });

      if (!document) {
        return null;
      }

      return this.toDomain(document);
    } catch (error: any) {
      console.error(`❌ Error al buscar por ID:`, error);
      throw new Error(`Error al buscar envío: ${error.message}`);
    }
  }

  /**
   * Busca envíos por orderId
   */
  async findByOrderId(orderId: string): Promise<Shipment[]> {
    try {
      const documents = await this.collection
        .find({ orderId })
        .sort({ createdAt: -1 })
        .toArray();

      return documents.map(doc => this.toDomain(doc));
    } catch (error: any) {
      console.error(`❌ Error al buscar por orderId:`, error);
      throw new Error(`Error al buscar envíos: ${error.message}`);
    }
  }

  /**
   * Busca envíos por customerId
   */
  async findByCustomerId(customerId: string): Promise<Shipment[]> {
    try {
      const documents = await this.collection
        .find({ "customerInfo.customerId": customerId })
        .sort({ createdAt: -1 })
        .toArray();

      return documents.map(doc => this.toDomain(doc));
    } catch (error: any) {
      console.error(`❌ Error al buscar por customerId:`, error);
      throw new Error(`Error al buscar envíos: ${error.message}`);
    }
  }

  /**
   * Busca envíos por estado
   */
  async findByStatus(status: string): Promise<Shipment[]> {
    try {
      const documents = await this.collection
        .find({ status: status.toUpperCase() })
        .sort({ updatedAt: -1 })
        .toArray();

      return documents.map(doc => this.toDomain(doc));
    } catch (error: any) {
      console.error(`❌ Error al buscar por status:`, error);
      throw new Error(`Error al buscar envíos: ${error.message}`);
    }
  }

  /**
   * Lista todos los envíos con paginación
   */
  async findAll(limit: number = 50, skip: number = 0): Promise<Shipment[]> {
    try {
      const documents = await this.collection
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      return documents.map(doc => this.toDomain(doc));
    } catch (error: any) {
      console.error(`❌ Error al listar envíos:`, error);
      throw new Error(`Error al listar envíos: ${error.message}`);
    }
  }

  /**
   * Cuenta total de envíos
   */
  async count(): Promise<number> {
    try {
      return await this.collection.countDocuments();
    } catch (error: any) {
      console.error(`❌ Error al contar envíos:`, error);
      throw new Error(`Error al contar envíos: ${error.message}`);
    }
  }

  /**
   * Cuenta envíos por estado
   */
  async countByStatus(status: string): Promise<number> {
    try {
      return await this.collection.countDocuments({ 
        status: status.toUpperCase() 
      });
    } catch (error: any) {
      console.error(`❌ Error al contar por status:`, error);
      throw new Error(`Error al contar envíos: ${error.message}`);
    }
  }

  /**
   * Elimina un envío de la proyección
   */
  async delete(shipmentId: string): Promise<void> {
    try {
      await this.collection.deleteOne({ id: shipmentId });
      console.log(`✅ Proyección eliminada: ${shipmentId}`);
    } catch (error: any) {
      console.error(`❌ Error al eliminar proyección:`, error);
      throw new Error(`Error al eliminar proyección: ${error.message}`);
    }
  }

  /**
   * Convierte un Shipment a documento de MongoDB
   */
  private toDocument(shipment: Shipment): any {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      type: shipment.type.value,
      customerInfo: shipment.customerInfo,
      articles: shipment.articles,
      tracking: shipment.tracking,
      relatedShipmentId: shipment.relatedShipmentId,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt
    };
  }

  /**
   * Convierte un documento de MongoDB a Shipment
   */
  private toDomain(document: any): Shipment {
    const shipment = new Shipment(
      document.id,
      document.orderId,
      document.customerInfo,
      document.articles,
      ShipmentStatus.create(document.status),
      ShipmentType.create(document.type)
    );

    // Restaurar tracking
    if (document.tracking && Array.isArray(document.tracking)) {
      document.tracking.forEach((entry: any) => {
        shipment['_tracking'].push({
          status: entry.status,
          description: entry.description,
          timestamp: entry.timestamp,
          actor: entry.actor
        });
      });
    }

    // Restaurar relatedShipmentId si existe
    if (document.relatedShipmentId) {
      shipment['_relatedShipmentId'] = document.relatedShipmentId;
    }

    // Restaurar fechas
    shipment['_createdAt'] = document.createdAt;
    shipment['_updatedAt'] = document.updatedAt;

    return shipment;
  }

  /**
   * Reconstruye todas las proyecciones desde events
   */
  async rebuildAll(shipments: Shipment[]): Promise<void> {
    try {
      // Limpiar colección
      await this.collection.deleteMany({});

      // Insertar todas las proyecciones
      if (shipments.length > 0) {
        const documents = shipments.map(s => this.toDocument(s));
        await this.collection.insertMany(documents);
      }

      console.log(`✅ ${shipments.length} proyecciones reconstruidas`);
    } catch (error: any) {
      console.error(`❌ Error al reconstruir proyecciones:`, error);
      throw new Error(`Error al reconstruir proyecciones: ${error.message}`);
    }
  }
}