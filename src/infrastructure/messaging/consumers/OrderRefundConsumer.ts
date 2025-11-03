// src/infrastructure/messaging/consumers/OrderRefundConsumer.ts

import { RabbitMqConsumer } from "../rabbitmq/RabbitMqConsumer";
import { ShipmentProjectionRepository } from "../../persistence/mongodb/ShipmentProjectionRepository";
import { EventStoreRepository } from "../../persistence/mongodb/EventStoreRepository";

export interface OrderRefundMessage {
  type: string;
  orderId: string;
  customerId?: string;
  refundAmount?: number;
  reason?: string;
  timestamp?: string;
}

export class OrderRefundConsumer extends RabbitMqConsumer {
  constructor(
    private readonly projectionRepository: ShipmentProjectionRepository,
    private readonly eventStoreRepository: EventStoreRepository,
    queueName: string = "delivery.order_refund"
  ) {
    super(queueName, "order.refund.processed");
  }

  protected async processMessage(content: OrderRefundMessage): Promise<void> {
    console.log("📥 Procesando ORDER_REFUND:", {
      orderId: content.orderId,
      reason: content.reason || "No especificado"
    });

    // Validar mensaje
    this.validateMessage(content);

    try {
      // Buscar envíos relacionados a esta orden
      const shipments = await this.projectionRepository.findByOrderId(content.orderId);

      if (shipments.length === 0) {
        console.warn(`⚠️ No se encontraron envíos para la orden ${content.orderId}`);
        return; // No es error, simplemente no hay envíos
      }

      console.log(`📦 Encontrados ${shipments.length} envíos para orden ${content.orderId}`);

      // Procesar cada envío
      for (const shipment of shipments) {
        await this.processShipmentRefund(shipment, content);
      }

      console.log(`✅ ORDER_REFUND procesado para orden ${content.orderId}`);

    } catch (error: any) {
      console.error(`❌ Error al procesar ORDER_REFUND:`, error);
      throw error; // Re-lanzar para reintentos
    }
  }

  /**
   * Procesa el reembolso para un envío específico
   */
  private async processShipmentRefund(shipment: any, refundData: OrderRefundMessage): Promise<void> {
    console.log(`   Procesando refund para envío ${shipment.id} (status: ${shipment.status})`);

    // Verificar el estado del envío
    const status = shipment.status;

    // Lógica según el estado
    switch (status) {
      case "PENDING":
      case "PREPARED":
        console.log(`   → Envío ${shipment.id} puede ser cancelado directamente`);
        // El envío puede ser cancelado sin problemas
        break;

      case "IN_TRANSIT":
        console.log(`   → Envío ${shipment.id} está en tránsito, se deberá gestionar devolución al llegar`);
        // Marcar para devolución cuando llegue
        break;

      case "DELIVERED":
        console.log(`   → Envío ${shipment.id} fue entregado, se debe iniciar devolución`);
        // Se debe iniciar proceso de devolución
        break;

      case "RETURNING":
        console.log(`   → Envío ${shipment.id} ya está en proceso de devolución`);
        // Ya está en proceso
        break;

      case "RETURNED":
        console.log(`   → Envío ${shipment.id} ya fue devuelto completamente`);
        // Ya completado
        break;

      case "CANCELLED":
        console.log(`   → Envío ${shipment.id} ya estaba cancelado`);
        // Ya cancelado
        break;

      default:
        console.warn(`   ⚠️ Estado desconocido para envío ${shipment.id}: ${status}`);
    }

    // Registrar evento de refund en el tracking
    await this.logRefundEvent(shipment.id, refundData);
  }

  /**
   * Registra el evento de refund en los logs del envío
   */
  private async logRefundEvent(shipmentId: string, refundData: OrderRefundMessage): Promise<void> {
    // Aquí se podría crear un evento especial de "REFUND_CONFIRMED"
    // Por ahora solo lo registramos en logs
    console.log(`   ✅ Refund confirmado para envío ${shipmentId}`);
    
    // TODO: Crear evento REFUND_CONFIRMED y guardarlo en Event Store
    // const event = ShipmentEvent.createRefundConfirmed(shipmentId, refundData.orderId, ...);
    // await this.eventStoreRepository.saveEvents(shipmentId, [event]);
  }

  /**
   * Valida que el mensaje tenga los campos requeridos
   */
  private validateMessage(content: OrderRefundMessage): void {
    if (!content.orderId) {
      throw new Error("Mensaje inválido: falta campo 'orderId'");
    }

    // El resto de campos son opcionales pero los registramos
    if (!content.reason) {
      console.log("   ⚠️ Refund sin razón especificada");
    }

    if (!content.refundAmount) {
      console.log("   ⚠️ Refund sin monto especificado");
    }
  }

  /**
   * Obtiene estadísticas de refunds procesados
   */
  async getRefundStatistics(orderId?: string): Promise<any> {
    try {
      // Obtener eventos de tipo REFUND
      const events = await this.eventStoreRepository.getEventsByType("ORDER_REFUND");

      if (orderId) {
        return events.filter(e => e.orderId === orderId);
      }

      return {
        total: events.length,
        byOrder: this.groupByOrder(events)
      };

    } catch (error: any) {
      console.error(`❌ Error al obtener estadísticas de refunds:`, error);
      return null;
    }
  }

  /**
   * Agrupa eventos por orden
   */
  private groupByOrder(events: any[]): Map<string, number> {
    const grouped = new Map<string, number>();

    events.forEach(event => {
      const count = grouped.get(event.orderId) || 0;
      grouped.set(event.orderId, count + 1);
    });

    return grouped;
  }

  /**
   * Manejo especial de errores para este consumer
   */
  protected async handleFailedMessage(msg: any, error: Error): Promise<void> {
    await super.handleFailedMessage(msg, error);

    console.error(`💀 ORDER_REFUND fallido definitivamente:`, {
      orderId: msg.orderId,
      error: error.message
    });

    // TODO: Notificar al servicio de Orders sobre el fallo
  }
}