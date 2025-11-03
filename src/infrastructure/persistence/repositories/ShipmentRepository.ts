// src/infrastructure/persistence/repositories/ShipmentRepository.ts

import { Shipment } from "../../../domain/shipment/Shipment";
import { ShipmentEvent } from "../../../domain/shipment/ShipmentEvent";
import { EventStoreRepository } from "../mongodb/EventStoreRepository";
import { ShipmentProjectionRepository } from "../mongodb/ShipmentProjectionRepository";

/**
 * Interfaz del repositorio de Shipment
 * Combina Event Store y Proyecciones
 */
export interface IShipmentRepository {
  // Operaciones principales
  save(shipment: Shipment): Promise<void>;
  findById(shipmentId: string): Promise<Shipment | null>;
  loadById(shipmentId: string): Promise<Shipment>;
  
  // Event Store
  saveEvents(shipmentId: string, events: ShipmentEvent[]): Promise<void>;
  getEvents(shipmentId: string): Promise<ShipmentEvent[]>;
  
  // Queries
  findByOrderId(orderId: string): Promise<Shipment[]>;
  findByCustomerId(customerId: string): Promise<Shipment[]>;
  findByStatus(status: string): Promise<Shipment[]>;
  findAll(limit?: number, skip?: number): Promise<Shipment[]>;
  
  // Estadísticas
  count(): Promise<number>;
  countByStatus(status: string): Promise<number>;
  exists(shipmentId: string): Promise<boolean>;
}

/**
 * Implementación del repositorio combinando Event Store y Proyecciones
 */
export class ShipmentRepository implements IShipmentRepository {
  constructor(
    private readonly eventStoreRepository: EventStoreRepository,
    private readonly projectionRepository: ShipmentProjectionRepository
  ) {}

  /**
   * Guarda un agregado completo
   * - Guarda eventos en Event Store
   * - Actualiza proyección
   * - Limpia eventos del agregado
   */
  async save(shipment: Shipment): Promise<void> {
    try {
      const events = shipment.events;

      // 1. Guardar eventos si hay
      if (events.length > 0) {
        await this.eventStoreRepository.saveEvents(shipment.id, events);
        console.log(`✅ Eventos guardados en Event Store: ${events.length}`);
      }

      // 2. Actualizar proyección
      await this.projectionRepository.save(shipment);
      console.log(`✅ Proyección actualizada para envío: ${shipment.id}`);

      // 3. Limpiar eventos del agregado (ya persistidos)
      shipment.clearEvents();

    } catch (error: any) {
      console.error(`❌ Error al guardar envío ${shipment.id}:`, error);
      throw new Error(`Error al guardar envío: ${error.message}`);
    }
  }

  /**
   * Busca un envío por ID desde la proyección (rápido)
   */
  async findById(shipmentId: string): Promise<Shipment | null> {
    try {
      return await this.projectionRepository.findById(shipmentId);
    } catch (error: any) {
      console.error(`❌ Error al buscar envío ${shipmentId}:`, error);
      throw new Error(`Error al buscar envío: ${error.message}`);
    }
  }

  /**
   * Carga un envío reconstruyéndolo desde eventos (fuente de verdad)
   * Lanza error si no existe
   */
  async loadById(shipmentId: string): Promise<Shipment> {
    try {
      const events = await this.eventStoreRepository.getEventsByShipmentId(shipmentId);

      if (events.length === 0) {
        throw new Error(`Envío no encontrado: ${shipmentId}`);
      }

      console.log(`✅ Envío ${shipmentId} reconstruido desde ${events.length} eventos`);
      return Shipment.fromEvents(events);

    } catch (error: any) {
      if (error.message.includes("no encontrado")) {
        throw error; // Re-lanzar error de "no encontrado"
      }
      console.error(`❌ Error al cargar envío ${shipmentId}:`, error);
      throw new Error(`Error al cargar envío: ${error.message}`);
    }
  }

  /**
   * Guarda solo eventos (sin actualizar proyección)
   * Útil para batch processing
   */
  async saveEvents(shipmentId: string, events: ShipmentEvent[]): Promise<void> {
    try {
      await this.eventStoreRepository.saveEvents(shipmentId, events);
    } catch (error: any) {
      console.error(`❌ Error al guardar eventos:`, error);
      throw new Error(`Error al guardar eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene eventos de un envío
   */
  async getEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    try {
      return await this.eventStoreRepository.getEventsByShipmentId(shipmentId);
    } catch (error: any) {
      console.error(`❌ Error al obtener eventos:`, error);
      throw new Error(`Error al obtener eventos: ${error.message}`);
    }
  }

  /**
   * Busca envíos por orderId
   */
  async findByOrderId(orderId: string): Promise<Shipment[]> {
    try {
      return await this.projectionRepository.findByOrderId(orderId);
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
      return await this.projectionRepository.findByCustomerId(customerId);
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
      return await this.projectionRepository.findByStatus(status);
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
      return await this.projectionRepository.findAll(limit, skip);
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
      return await this.projectionRepository.count();
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
      return await this.projectionRepository.countByStatus(status);
    } catch (error: any) {
      console.error(`❌ Error al contar por status:`, error);
      throw new Error(`Error al contar envíos: ${error.message}`);
    }
  }

  /**
   * Verifica si existe un envío
   */
  async exists(shipmentId: string): Promise<boolean> {
    try {
      const shipment = await this.projectionRepository.findById(shipmentId);
      return shipment !== null;
    } catch (error: any) {
      console.error(`❌ Error al verificar existencia:`, error);
      return false;
    }
  }

  /**
   * Reconstruye la proyección de un envío desde eventos
   * Útil para reparar inconsistencias
   */
  async rebuildProjection(shipmentId: string): Promise<void> {
    try {
      const shipment = await this.loadById(shipmentId);
      await this.projectionRepository.save(shipment);
      console.log(`✅ Proyección reconstruida para envío: ${shipmentId}`);
    } catch (error: any) {
      console.error(`❌ Error al reconstruir proyección:`, error);
      throw new Error(`Error al reconstruir proyección: ${error.message}`);
    }
  }

  /**
   * Valida consistencia entre eventos y proyección
   */
  async validateConsistency(shipmentId: string): Promise<boolean> {
    try {
      const shipmentFromEvents = await this.loadById(shipmentId);
      const shipmentFromProjection = await this.findById(shipmentId);

      if (!shipmentFromProjection) {
        console.warn(`⚠️ Proyección no existe para envío: ${shipmentId}`);
        return false;
      }

      const eventsStatus = shipmentFromEvents.status.value;
      const projectionStatus = shipmentFromProjection.status.value;

      if (eventsStatus !== projectionStatus) {
        console.warn(`⚠️ Inconsistencia detectada en envío ${shipmentId}:`);
        console.warn(`   Eventos: ${eventsStatus}`);
        console.warn(`   Proyección: ${projectionStatus}`);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error(`❌ Error al validar consistencia:`, error);
      return false;
    }
  }
}