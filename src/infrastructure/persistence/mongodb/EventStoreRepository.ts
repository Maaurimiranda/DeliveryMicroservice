// src/infrastructure/persistence/mongodb/EventStoreRepository.ts

import { Collection, MongoError } from "mongodb";
import { MongoDbConnection } from "./MongoDbConnection";
import { ShipmentEvent } from "../../../domain/shipment/ShipmentEvent";

export interface IEventStoreRepository {
  saveEvents(shipmentId: string, events: ShipmentEvent[]): Promise<void>;
  getEventsByShipmentId(shipmentId: string): Promise<ShipmentEvent[]>;
  getEventsByOrderId(orderId: string): Promise<ShipmentEvent[]>;
  getAllEvents(limit?: number, skip?: number): Promise<ShipmentEvent[]>;
  countEvents(): Promise<number>;
  getEventsByDateRange(startDate: Date, endDate: Date): Promise<ShipmentEvent[]>;
  getEventsByType(eventType: string): Promise<ShipmentEvent[]>;
}

export class EventStoreRepository implements IEventStoreRepository {
  private collection: Collection;
  private readonly COLLECTION_NAME = "events";

  constructor() {
    const db = MongoDbConnection.getInstance().getDb();
    this.collection = db.collection(this.COLLECTION_NAME);
  }

  /**
   * Guarda eventos en el Event Store
   * Implementa idempotencia usando el eventId como _id
   */
  async saveEvents(shipmentId: string, events: ShipmentEvent[]): Promise<void> {
    if (!shipmentId || shipmentId.trim() === "") {
      throw new Error("shipmentId es requerido para guardar eventos");
    }

    if (!events || events.length === 0) {
      console.log("⚠️ No hay eventos para guardar");
      return;
    }

    try {
      // Preparar documentos para insertar
      const documents = events.map(event => {
        const primitives = event.toPrimitives();
        return {
          _id: event.eventId, // Usar eventId como _id para idempotencia
          ...primitives,
          shipmentId, // Asegurar que shipmentId está presente
          savedAt: new Date() // Timestamp de cuándo se guardó
        };
      });

      // Insertar con ordered: false para que continúe si hay duplicados
      const result = await this.collection.insertMany(documents, { ordered: false });
      
      console.log(`✅ ${result.insertedCount} eventos guardados para envío ${shipmentId}`);

      // Si algunos fueron rechazados por duplicados, no es error
      if (result.insertedCount < events.length) {
        console.log(`⚠️ ${events.length - result.insertedCount} eventos ya existían (idempotencia)`);
      }

    } catch (error: any) {
      // Error 11000 es clave duplicada - esto es esperado en caso de reintentos
      if (error instanceof MongoError && error.code === 11000) {
        console.log(`⚠️ Algunos eventos ya existían (idempotencia aplicada)`);
        // No lanzar error, esto es comportamiento esperado
        return;
      }

      // Otros errores sí se lanzan
      console.error(`❌ Error al guardar eventos:`, error);
      throw new Error(`Error al guardar eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los eventos de un envío ordenados cronológicamente
   */
  async getEventsByShipmentId(shipmentId: string): Promise<ShipmentEvent[]> {
    if (!shipmentId || shipmentId.trim() === "") {
      throw new Error("shipmentId es requerido");
    }

    try {
      const documents = await this.collection
        .find({ shipmentId })
        .sort({ timestamp: 1 }) // Orden cronológico
        .toArray();

      return documents.map(doc => ShipmentEvent.fromPrimitives(doc));

    } catch (error: any) {
      console.error(`❌ Error al obtener eventos del envío ${shipmentId}:`, error);
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene eventos por orderId
   */
  async getEventsByOrderId(orderId: string): Promise<ShipmentEvent[]> {
    if (!orderId || orderId.trim() === "") {
      throw new Error("orderId es requerido");
    }

    try {
      const documents = await this.collection
        .find({ orderId })
        .sort({ timestamp: 1 })
        .toArray();

      return documents.map(doc => ShipmentEvent.fromPrimitives(doc));

    } catch (error: any) {
      console.error(`❌ Error al obtener eventos de la orden ${orderId}:`, error);
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los eventos con paginación
   */
  async getAllEvents(limit: number = 100, skip: number = 0): Promise<ShipmentEvent[]> {
    try {
      const documents = await this.collection
        .find({})
        .sort({ timestamp: -1 }) // Más recientes primero
        .skip(skip)
        .limit(limit)
        .toArray();

      return documents.map(doc => ShipmentEvent.fromPrimitives(doc));

    } catch (error: any) {
      console.error(`❌ Error al obtener todos los eventos:`, error);
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  }

  /**
   * Cuenta el total de eventos en el store
   */
  async countEvents(): Promise<number> {
    try {
      return await this.collection.countDocuments();
    } catch (error: any) {
      console.error(`❌ Error al contar eventos:`, error);
      throw new Error(`Error al contar eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene eventos en un rango de fechas
   */
  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<ShipmentEvent[]> {
    if (!startDate || !endDate) {
      throw new Error("startDate y endDate son requeridos");
    }

    if (startDate > endDate) {
      throw new Error("startDate debe ser anterior a endDate");
    }

    try {
      const documents = await this.collection
        .find({
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .sort({ timestamp: 1 })
        .toArray();

      return documents.map(doc => ShipmentEvent.fromPrimitives(doc));

    } catch (error: any) {
      console.error(`❌ Error al obtener eventos por rango de fechas:`, error);
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene eventos por tipo
   */
  async getEventsByType(eventType: string): Promise<ShipmentEvent[]> {
    if (!eventType || eventType.trim() === "") {
      throw new Error("eventType es requerido");
    }

    try {
      const documents = await this.collection
        .find({ eventType })
        .sort({ timestamp: -1 })
        .toArray();

      return documents.map(doc => ShipmentEvent.fromPrimitives(doc));

    } catch (error: any) {
      console.error(`❌ Error al obtener eventos por tipo ${eventType}:`, error);
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  }

  /**
   * Verifica si existe un evento específico
   */
  async eventExists(eventId: string): Promise<boolean> {
    try {
      const count = await this.collection.countDocuments({ _id: eventId });
      return count > 0;
    } catch (error: any) {
      console.error(`❌ Error al verificar existencia de evento:`, error);
      return false;
    }
  }

  /**
   * Obtiene el último evento de un envío
   */
  async getLastEventByShipmentId(shipmentId: string): Promise<ShipmentEvent | null> {
    try {
      const document = await this.collection
        .find({ shipmentId })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();

      if (document.length === 0) {
        return null;
      }

      return ShipmentEvent.fromPrimitives(document[0]);

    } catch (error: any) {
      console.error(`❌ Error al obtener último evento:`, error);
      throw new Error(`Error al obtener último evento: ${error.message}`);
    }
  }

  /**
   * Cuenta eventos por envío
   */
  async countEventsByShipmentId(shipmentId: string): Promise<number> {
    try {
      return await this.collection.countDocuments({ shipmentId });
    } catch (error: any) {
      console.error(`❌ Error al contar eventos del envío:`, error);
      throw new Error(`Error al contar eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de eventos
   */
  async getEventStatistics(): Promise<any> {
    try {
      const stats = await this.collection.aggregate([
        {
          $group: {
            _id: "$eventType",
            count: { $sum: 1 },
            firstOccurrence: { $min: "$timestamp" },
            lastOccurrence: { $max: "$timestamp" }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]).toArray();

      return stats;

    } catch (error: any) {
      console.error(`❌ Error al obtener estadísticas de eventos:`, error);
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }
}