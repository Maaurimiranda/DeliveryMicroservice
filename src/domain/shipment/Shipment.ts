import { ShipmentStatus } from "./ShipmentStatus";
import { ShipmentType } from "./ShipmentType";
import { ShipmentEvent, Article, CustomerInfo } from "./ShipmentEvent";

export interface TrackingEntry {
  status: string;
  description: string;
  timestamp: Date;
  actor?: string;
}

export class Shipment {
  private _id: string;
  private _orderId: string;
  private _status: ShipmentStatus;
  private _type: ShipmentType;
  private _customerInfo: CustomerInfo;
  private _articles: Article[];
  private _tracking: TrackingEntry[];
  private _relatedShipmentId?: string;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _events: ShipmentEvent[];

  constructor(
    id: string,
    orderId: string,
    customerInfo: CustomerInfo,
    articles: Article[],
    status: ShipmentStatus = ShipmentStatus.pending(),
    type: ShipmentType = ShipmentType.normal()
  ) {
    this._id = id;
    this._orderId = orderId;
    this._status = status;
    this._type = type;
    this._customerInfo = customerInfo;
    this._articles = articles;
    this._tracking = [];
    this._createdAt = new Date();
    this._updatedAt = new Date();
    this._events = [];
  }
 

  // Getters
  get id(): string {
    return this._id;
  }

  get orderId(): string {
    return this._orderId;
  }

  get status(): ShipmentStatus {
    return this._status;
  }

  get type(): ShipmentType {
    return this._type;
  }

  get customerInfo(): CustomerInfo {
    return this._customerInfo;
  }

  get articles(): Article[] {
    return this._articles;
  }

  get tracking(): TrackingEntry[] {
    return [...this._tracking];
  }

  get relatedShipmentId(): string | undefined {
    return this._relatedShipmentId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get events(): ShipmentEvent[] {
    return [...this._events];
  }

  clearEvents(): void {
    this._events = [];
  }

  moveToPrepared(actor?: string, description?: string): void {
    this.validateStateTransition(ShipmentStatus.prepared());
    
    const event = ShipmentEvent.createMovedToPrepared(
      this._id,
      this._orderId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  moveToInTransit(actor?: string, description?: string): void {
    this.validateStateTransition(ShipmentStatus.inTransit());
    
    const event = ShipmentEvent.createMovedToInTransit(
      this._id,
      this._orderId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  moveToDelivered(actor?: string, description?: string): void {
    this.validateStateTransition(ShipmentStatus.delivered());
    
    const event = ShipmentEvent.createMovedToDelivered(
      this._id,
      this._orderId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  cancel(actor?: string, description?: string): void {
    if (!this._status.canBeCancelled()) {
      throw new Error(
        `No se puede cancelar un envío en estado ${this._status.value}. Solo se puede cancelar en estados PENDING o PREPARED.`
      );
    }

    const event = ShipmentEvent.createShipmentCancelled(
      this._id,
      this._orderId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  initiateReturn(actor?: string, description?: string): void {
    if (!this._status.isDelivered()) {
      throw new Error(
        `Solo se puede iniciar una devolución desde el estado DELIVERED. Estado actual: ${this._status.value}`
      );
    }

    const event = ShipmentEvent.createReturnInitiated(
      this._id,
      this._orderId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  completeReturn(actor?: string, description?: string): void {
    if (!this._status.isReturning()) {
      throw new Error(
        `Solo se puede completar una devolución desde el estado RETURNING. Estado actual: ${this._status.value}`
      );
    }

    const event = ShipmentEvent.createReturnCompleted(
      this._id,
      this._orderId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  initiateExchange(newShipmentId: string, actor?: string, description?: string): void {
    if (!this._status.isReturning()) {
      throw new Error(
        `Solo se puede iniciar un cambio desde el estado RETURNING. Estado actual: ${this._status.value}`
      );
    }

    const event = ShipmentEvent.createExchangeInitiated(
      this._id,
      this._orderId,
      newShipmentId,
      actor,
      description
    );

    this.applyEvent(event);
  }

  static createForExchange(
    id: string,
    orderId: string,
    originalShipmentId: string,
    customerInfo: CustomerInfo,
    articles: Article[],
    actor?: string,
    description?: string
  ): Shipment {
    const shipment = new Shipment(
      id,
      orderId,
      customerInfo,
      articles,
      ShipmentStatus.pending(),
      ShipmentType.exchange()
    );

    shipment._relatedShipmentId = originalShipmentId;

    const event = ShipmentEvent.createExchangeCompleted(
      id,
      orderId,
      originalShipmentId,
      actor,
      description
    );

    shipment.applyEvent(event);

    return shipment;
  }

  recordError(errorMessage: string, actor?: string): void {
    const event = ShipmentEvent.createShipmentError(
      this._id,
      this._orderId,
      errorMessage,
      actor
    );

    this._events.push(event);
  }

  private validateStateTransition(newStatus: ShipmentStatus): void {
    if (!this._status.canTransitionTo(newStatus)) {
      throw new Error(
        `Transición de estado inválida: ${this._status.value} -> ${newStatus.value}`
      );
    }
  }

  private applyEvent(event: ShipmentEvent): void {
    if (event.newStatus) {
      this._status = ShipmentStatus.create(event.newStatus);
      
      this._tracking.push({
        status: event.newStatus,
        description: event.description || "",
        timestamp: event.timestamp,
        actor: event.actor
      });
    }

    if (event.relatedShipmentId) {
      this._relatedShipmentId = event.relatedShipmentId;
    }

    this._updatedAt = new Date();
    this._events.push(event);
  }

  static fromEvents(events: ShipmentEvent[]): Shipment {
    if (events.length === 0) {
      throw new Error("No se puede reconstruir un envío sin eventos");
    }

    const firstEvent = events[0];
    
    if (!firstEvent.customerInfo || !firstEvent.articles) {
      throw new Error("El primer evento debe contener customerInfo y articles");
    }

    const shipment = new Shipment(
      firstEvent.shipmentId,
      firstEvent.orderId,
      firstEvent.customerInfo,
      firstEvent.articles
    );

    events.forEach(event => {
      if (event.newStatus) {
        shipment._status = ShipmentStatus.create(event.newStatus);
        
        shipment._tracking.push({
          status: event.newStatus,
          description: event.description || "",
          timestamp: event.timestamp,
          actor: event.actor
        });
      }

      if (event.shipmentType) {
        shipment._type = ShipmentType.create(event.shipmentType);
      }

      if (event.relatedShipmentId) {
        shipment._relatedShipmentId = event.relatedShipmentId;
      }

      shipment._updatedAt = event.timestamp;
    });

    return shipment;
  }

  toJSON() {
    return {
      id: this._id,
      orderId: this._orderId,
      status: this._status.value,
      type: this._type.value,
      customerInfo: this._customerInfo,
      articles: this._articles,
      tracking: this._tracking,
      relatedShipmentId: this._relatedShipmentId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}