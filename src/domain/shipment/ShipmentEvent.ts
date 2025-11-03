// src/domain/shipment/ShipmentEvent.ts

import { DomainEvent } from "../shared/DomainEvent";

export enum ShipmentEventType {
  SHIPMENT_CREATED = "SHIPMENT_CREATED",
  MOVED_TO_PREPARED = "MOVED_TO_PREPARED",
  MOVED_TO_IN_TRANSIT = "MOVED_TO_IN_TRANSIT",
  MOVED_TO_DELIVERED = "MOVED_TO_DELIVERED",
  SHIPMENT_CANCELLED = "SHIPMENT_CANCELLED",
  RETURN_INITIATED = "RETURN_INITIATED",
  RETURN_COMPLETED = "RETURN_COMPLETED",
  EXCHANGE_INITIATED = "EXCHANGE_INITIATED",
  EXCHANGE_COMPLETED = "EXCHANGE_COMPLETED",
  SHIPMENT_ERROR = "SHIPMENT_ERROR"
}

export interface Article {
  articleId: string;
  quantity: number;
  price: number;
}

export interface CustomerInfo {
  customerId: string;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
}

export interface ShipmentEventData {
  eventId?: string;
  eventType: ShipmentEventType;
  shipmentId: string;
  orderId: string;
  timestamp?: Date;
  actor?: string;
  description?: string;
  previousStatus?: string;
  newStatus?: string;
  customerInfo?: CustomerInfo;
  articles?: Article[];
  shipmentType?: string;
  relatedShipmentId?: string;
  errorMessage?: string;
}

export class ShipmentEvent extends DomainEvent {
  readonly eventType: ShipmentEventType;
  readonly shipmentId: string;
  readonly orderId: string;
  readonly actor?: string;
  readonly description?: string;
  readonly previousStatus?: string;
  readonly newStatus?: string;
  readonly customerInfo?: CustomerInfo;
  readonly articles?: Article[];
  readonly shipmentType?: string;
  readonly relatedShipmentId?: string;
  readonly errorMessage?: string;

  private constructor(data: ShipmentEventData) {
    super(data.eventId);
    
    this.eventType = data.eventType;
    this.shipmentId = data.shipmentId;
    this.orderId = data.orderId;
    this.actor = data.actor;
    this.description = data.description;
    this.previousStatus = data.previousStatus;
    this.newStatus = data.newStatus;
    this.customerInfo = data.customerInfo;
    this.articles = data.articles;
    this.shipmentType = data.shipmentType;
    this.relatedShipmentId = data.relatedShipmentId;
    this.errorMessage = data.errorMessage;
  }

  // Factory Methods para crear eventos específicos

  static createShipmentCreated(
    shipmentId: string,
    orderId: string,
    customerInfo: CustomerInfo,
    articles: Article[],
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.SHIPMENT_CREATED,
      shipmentId,
      orderId,
      customerInfo,
      articles,
      actor,
      description: description || `Envío creado el ${new Date().toISOString()}`,
      newStatus: "PENDING",
      shipmentType: "NORMAL"
    });
  }

  static createMovedToPrepared(
    shipmentId: string,
    orderId: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.MOVED_TO_PREPARED,
      shipmentId,
      orderId,
      actor,
      description: description || `Envío preparado el ${new Date().toISOString()}`,
      previousStatus: "PENDING",
      newStatus: "PREPARED"
    });
  }

  static createMovedToInTransit(
    shipmentId: string,
    orderId: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.MOVED_TO_IN_TRANSIT,
      shipmentId,
      orderId,
      actor,
      description: description || `Envío en camino el ${new Date().toISOString()}`,
      previousStatus: "PREPARED",
      newStatus: "IN_TRANSIT"
    });
  }

  static createMovedToDelivered(
    shipmentId: string,
    orderId: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.MOVED_TO_DELIVERED,
      shipmentId,
      orderId,
      actor,
      description: description || `Envío entregado el ${new Date().toISOString()}`,
      previousStatus: "IN_TRANSIT",
      newStatus: "DELIVERED"
    });
  }

  static createShipmentCancelled(
    shipmentId: string,
    orderId: string,
    previousStatus: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.SHIPMENT_CANCELLED,
      shipmentId,
      orderId,
      actor,
      description: description || `Envío cancelado el ${new Date().toISOString()}`,
      previousStatus,
      newStatus: "CANCELLED"
    });
  }

  static createReturnInitiated(
    shipmentId: string,
    orderId: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.RETURN_INITIATED,
      shipmentId,
      orderId,
      actor,
      description: description || `Devolución iniciada el ${new Date().toISOString()}`,
      previousStatus: "DELIVERED",
      newStatus: "RETURNING"
    });
  }

  static createReturnCompleted(
    shipmentId: string,
    orderId: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.RETURN_COMPLETED,
      shipmentId,
      orderId,
      actor,
      description: description || `Devolución completada el ${new Date().toISOString()}`,
      previousStatus: "RETURNING",
      newStatus: "RETURNED"
    });
  }

  static createExchangeInitiated(
    shipmentId: string,
    orderId: string,
    newShipmentId: string,
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.EXCHANGE_INITIATED,
      shipmentId,
      orderId,
      actor,
      description: description || `Cambio de producto iniciado el ${new Date().toISOString()}`,
      previousStatus: "RETURNING",
      newStatus: "EXCHANGE_PROCESSED",
      relatedShipmentId: newShipmentId
    });
  }

  static createExchangeCompleted(
    shipmentId: string,
    orderId: string,
    originalShipmentId: string,
    customerInfo: CustomerInfo,
    articles: Article[],
    actor?: string,
    description?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.EXCHANGE_COMPLETED,
      shipmentId,
      orderId,
      actor,
      description: description || `Cambio de producto completado el ${new Date().toISOString()}`,
      newStatus: "PENDING",
      relatedShipmentId: originalShipmentId,
      shipmentType: "EXCHANGE",
      customerInfo,
      articles
    });
  }

  static createShipmentError(
    shipmentId: string,
    orderId: string,
    errorMessage: string,
    actor?: string
  ): ShipmentEvent {
    return new ShipmentEvent({
      eventType: ShipmentEventType.SHIPMENT_ERROR,
      shipmentId,
      orderId,
      actor,
      description: `Error en envío: ${errorMessage}`,
      errorMessage
    });
  }

  // Reconstruir desde primitivos (para leer desde DB)
  static fromPrimitives(data: any): ShipmentEvent {
    return new ShipmentEvent({
      eventId: data.eventId || data._id,
      eventType: data.eventType,
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
      actor: data.actor,
      description: data.description,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      customerInfo: data.customerInfo,
      articles: data.articles,
      shipmentType: data.shipmentType,
      relatedShipmentId: data.relatedShipmentId,
      errorMessage: data.errorMessage
    });
  }

  // Convertir a primitivos (para guardar en DB)
  toPrimitives(): any {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      shipmentId: this.shipmentId,
      orderId: this.orderId,
      timestamp: this.occurredOn,
      actor: this.actor,
      description: this.description,
      previousStatus: this.previousStatus,
      newStatus: this.newStatus,
      customerInfo: this.customerInfo,
      articles: this.articles,
      shipmentType: this.shipmentType,
      relatedShipmentId: this.relatedShipmentId,
      errorMessage: this.errorMessage
    };
  }

  // Alias para compatibilidad
  toJSON(): any {
    return this.toPrimitives();
  }

  // Métodos de utilidad
  isStatusChange(): boolean {
    return this.newStatus !== undefined;
  }

  isError(): boolean {
    return this.eventType === ShipmentEventType.SHIPMENT_ERROR;
  }

  hasCustomerInfo(): boolean {
    return this.customerInfo !== undefined;
  }

  hasArticles(): boolean {
    return this.articles !== undefined && this.articles.length > 0;
  }

  isCreationEvent(): boolean {
    return this.eventType === ShipmentEventType.SHIPMENT_CREATED ||
           this.eventType === ShipmentEventType.EXCHANGE_COMPLETED;
  }

  isTerminalEvent(): boolean {
    return this.newStatus === "DELIVERED" ||
           this.newStatus === "CANCELLED" ||
           this.newStatus === "RETURNED" ||
           this.newStatus === "EXCHANGE_PROCESSED";
  }
}