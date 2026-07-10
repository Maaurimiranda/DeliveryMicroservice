export enum ShipmentStatusEnum {
  PENDING = "PENDING",
  PREPARED = "PREPARED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURNING = "RETURNING",
  RETURNED = "RETURNED",
  EXCHANGE_PROCESSED = "EXCHANGE_PROCESSED"
}

export class ShipmentStatus {
  private readonly _value: ShipmentStatusEnum;

  private constructor(value: ShipmentStatusEnum) {
    this._value = value;
  }

  static create(value: string): ShipmentStatus {
    const upperValue = value.toUpperCase();
    
    if (!Object.values(ShipmentStatusEnum).includes(upperValue as ShipmentStatusEnum)) {
      throw new Error(`Invalid shipment status: ${value}`);
    }

    return new ShipmentStatus(upperValue as ShipmentStatusEnum);
  }

  static pending(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.PENDING);
  }

  static prepared(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.PREPARED);
  }

  static inTransit(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.IN_TRANSIT);
  }

  static delivered(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.DELIVERED);
  }

  static cancelled(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.CANCELLED);
  }

  static returning(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.RETURNING);
  }

  static returned(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.RETURNED);
  }

  static exchangeProcessed(): ShipmentStatus {
    return new ShipmentStatus(ShipmentStatusEnum.EXCHANGE_PROCESSED);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ShipmentStatus): boolean {
    return this._value === other._value;
  }

  isPending(): boolean {
    return this._value === ShipmentStatusEnum.PENDING;
  }

  isPrepared(): boolean {
    return this._value === ShipmentStatusEnum.PREPARED;
  }

  isInTransit(): boolean {
    return this._value === ShipmentStatusEnum.IN_TRANSIT;
  }

  isDelivered(): boolean {
    return this._value === ShipmentStatusEnum.DELIVERED;
  }

  isCancelled(): boolean {
    return this._value === ShipmentStatusEnum.CANCELLED;
  }

  isReturning(): boolean {
    return this._value === ShipmentStatusEnum.RETURNING;
  }

  isReturned(): boolean {
    return this._value === ShipmentStatusEnum.RETURNED;
  }

  isExchangeProcessed(): boolean {
    return this._value === ShipmentStatusEnum.EXCHANGE_PROCESSED;
  }

  canTransitionTo(newStatus: ShipmentStatus): boolean {
    const transitions: Record<ShipmentStatusEnum, ShipmentStatusEnum[]> = {
      [ShipmentStatusEnum.PENDING]: [
        ShipmentStatusEnum.PREPARED,
        ShipmentStatusEnum.CANCELLED
      ],
      [ShipmentStatusEnum.PREPARED]: [
        ShipmentStatusEnum.IN_TRANSIT,
        ShipmentStatusEnum.CANCELLED
      ],
      [ShipmentStatusEnum.IN_TRANSIT]: [
        ShipmentStatusEnum.DELIVERED
      ],
      [ShipmentStatusEnum.DELIVERED]: [
        ShipmentStatusEnum.RETURNING
      ],
      [ShipmentStatusEnum.RETURNING]: [
        ShipmentStatusEnum.RETURNED,
        ShipmentStatusEnum.EXCHANGE_PROCESSED
      ],
      [ShipmentStatusEnum.CANCELLED]: [],
      [ShipmentStatusEnum.RETURNED]: [],
      [ShipmentStatusEnum.EXCHANGE_PROCESSED]: []
    };

    const allowedTransitions = transitions[this._value] || [];
    return allowedTransitions.includes(newStatus._value);
  }

  canBeCancelled(): boolean {
    return this._value === ShipmentStatusEnum.PENDING || 
           this._value === ShipmentStatusEnum.PREPARED;
  }

  isTerminal(): boolean {
    return this._value === ShipmentStatusEnum.DELIVERED ||
           this._value === ShipmentStatusEnum.CANCELLED ||
           this._value === ShipmentStatusEnum.RETURNED ||
           this._value === ShipmentStatusEnum.EXCHANGE_PROCESSED;
  }
}