// src/infrastructure/messaging/rabbitmq/RabbitMqPublisher.ts

import { RabbitMqConnection } from "./RabbitMqConnection";
import { Shipment } from "../../../domain/shipment/Shipment";
import { Channel } from "amqplib";

export interface PublishOptions {
  persistent?: boolean;
  contentType?: string;
  priority?: number;
  expiration?: string;
}

export class RabbitMqPublisher {
  private rabbitMq: RabbitMqConnection;
  private channel: Channel;
  private exchange: string;

  constructor() {
    this.rabbitMq = RabbitMqConnection.getInstance();
    this.channel = this.rabbitMq.getChannel();
    this.exchange = this.rabbitMq.getExchange();
  }

  /**
   * Método genérico para publicar mensajes
   */
  private async publish(
    routingKey: string,
    message: any,
    options: PublishOptions = {}
  ): Promise<void> {
    try {
      const content = Buffer.from(JSON.stringify(message));
      
      const publishOptions = {
        persistent: options.persistent !== false, // true por defecto
        contentType: options.contentType || "application/json",
        priority: options.priority,
        expiration: options.expiration,
        timestamp: Date.now()
      };

      const published = this.channel.publish(
        this.exchange,
        routingKey,
        content,
        publishOptions
      );

      if (!published) {
        throw new Error("El canal de RabbitMQ está lleno");
      }

      console.log(`📤 Evento publicado: ${routingKey}`);

    } catch (error: any) {
      console.error(`❌ Error al publicar mensaje en ${routingKey}:`, error);
      throw new Error(`Error al publicar evento: ${error.message}`);
    }
  }

  /**
   * Publica evento SHIPPING_CREATED
   */
  async publishShippingCreated(shipment: Shipment): Promise<void> {
    const message = {
      type: "SHIPPING_CREATED",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      type_shipment: shipment.type.value,
      customerInfo: shipment.customerInfo,
      articles: shipment.articles,
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.created", message);
  }

  /**
   * Publica evento SHIPPING_STATE_CHANGED
   */
  async publishShippingStateChanged(shipment: Shipment, eventType: string): Promise<void> {
    const message = {
      type: "SHIPPING_STATE_CHANGED",
      eventType,
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      previousStatus: this.getPreviousStatus(eventType),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.state.changed", message);
  }

  /**
   * Publica evento SHIPPING_DELIVERED
   */
  async publishShippingDelivered(shipment: Shipment): Promise<void> {
    const message = {
      type: "SHIPPING_DELIVERED",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      customerInfo: {
        customerId: shipment.customerInfo.customerId,
        name: shipment.customerInfo.name
      },
      deliveredAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.delivered", message, { priority: 5 });
  }

  /**
   * Publica evento SHIPPING_CANCELLED
   */
  async publishShippingCancelled(shipment: Shipment): Promise<void> {
    const message = {
      type: "SHIPPING_CANCELLED",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      cancelledAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.cancelled", message, { priority: 5 });
  }

  /**
   * Publica evento RETURN_INITIATED
   */
  async publishReturnInitiated(shipment: Shipment): Promise<void> {
    const message = {
      type: "RETURN_INITIATED",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      customerInfo: {
        customerId: shipment.customerInfo.customerId,
        name: shipment.customerInfo.name
      },
      articles: shipment.articles,
      initiatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.return.initiated", message, { priority: 6 });
  }

  /**
   * Publica evento RETURN_COMPLETED
   */
  async publishReturnCompleted(shipment: Shipment): Promise<void> {
    const message = {
      type: "RETURN_COMPLETED",
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      customerInfo: {
        customerId: shipment.customerInfo.customerId
      },
      completedAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.return.completed", message, { priority: 7 });
  }

  /**
   * Publica evento EXCHANGE_INITIATED
   */
  async publishExchangeInitiated(shipment: Shipment, newShipmentId: string): Promise<void> {
    const message = {
      type: "EXCHANGE_INITIATED",
      originalShipmentId: shipment.id,
      newShipmentId: newShipmentId,
      orderId: shipment.orderId,
      customerInfo: {
        customerId: shipment.customerInfo.customerId,
        name: shipment.customerInfo.name
      },
      articles: shipment.articles,
      initiatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.exchange.initiated", message, { priority: 6 });
  }

  /**
   * Publica evento EXCHANGE_COMPLETED
   */
  async publishExchangeCompleted(newShipment: Shipment, originalShipmentId: string): Promise<void> {
    const message = {
      type: "EXCHANGE_COMPLETED",
      newShipmentId: newShipment.id,
      originalShipmentId: originalShipmentId,
      orderId: newShipment.orderId,
      status: newShipment.status.value,
      completedAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.exchange.completed", message, { priority: 5 });
  }

  /**
   * Publica evento SHIPPING_ERROR
   */
  async publishShippingError(shipmentId: string, orderId: string, errorMessage: string): Promise<void> {
    const message = {
      type: "SHIPPING_ERROR",
      shipmentId,
      orderId,
      errorMessage,
      occurredAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.publish("shipping.error", message, { priority: 9 });
  }

  /**
   * Publica evento genérico personalizado
   */
  async publishCustomEvent(routingKey: string, eventData: any, priority?: number): Promise<void> {
    const message = {
      ...eventData,
      timestamp: new Date().toISOString()
    };

    await this.publish(routingKey, message, { priority });
  }

  /**
   * Obtiene el estado previo basado en el tipo de evento
   */
  private getPreviousStatus(eventType: string): string | undefined {
    const statusMap: Record<string, string> = {
      "MOVED_TO_PREPARED": "PENDING",
      "MOVED_TO_IN_TRANSIT": "PREPARED",
      "MOVED_TO_DELIVERED": "IN_TRANSIT",
      "RETURN_INITIATED": "DELIVERED",
      "RETURN_COMPLETED": "RETURNING",
      "EXCHANGE_INITIATED": "RETURNING"
    };

    return statusMap[eventType];
  }

  /**
   * Verifica si el canal está disponible
   */
  isChannelReady(): boolean {
    try {
      return this.channel !== null && this.channel !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Publica múltiples eventos en batch
   */
  async publishBatch(events: Array<{ routingKey: string; message: any }>): Promise<void> {
    const results = await Promise.allSettled(
      events.map(event => this.publish(event.routingKey, event.message))
    );

    const failures = results.filter(r => r.status === "rejected");
    
    if (failures.length > 0) {
      console.warn(`⚠️ ${failures.length} eventos fallaron al publicarse en batch`);
    }

    console.log(`✅ ${events.length - failures.length}/${events.length} eventos publicados en batch`);
  }
}