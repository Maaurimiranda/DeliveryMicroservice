// src/domain/shipment/ShipmentType.ts

import { ValueObject } from "../shared/ValueObject";

export enum ShipmentTypeEnum {
  NORMAL = "NORMAL",
  EXCHANGE = "EXCHANGE"
}

export class ShipmentType extends ValueObject<ShipmentTypeEnum> {
  
  private constructor(value: ShipmentTypeEnum) {
    super(value);
  }

  protected validate(value: ShipmentTypeEnum): void {
    if (!Object.values(ShipmentTypeEnum).includes(value)) {
      throw new Error(`Tipo de envío inválido: ${value}`);
    }
  }

  // Factory methods
  static create(value: string): ShipmentType {
    const upperValue = value.toUpperCase();
    
    if (!Object.values(ShipmentTypeEnum).includes(upperValue as ShipmentTypeEnum)) {
      throw new Error(`Tipo de envío inválido: ${value}. Valores permitidos: ${Object.values(ShipmentTypeEnum).join(", ")}`);
    }

    return new ShipmentType(upperValue as ShipmentTypeEnum);
  }

  static normal(): ShipmentType {
    return new ShipmentType(ShipmentTypeEnum.NORMAL);
  }

  static exchange(): ShipmentType {
    return new ShipmentType(ShipmentTypeEnum.EXCHANGE);
  }

  // Métodos de consulta
  isNormal(): boolean {
    return this.value === ShipmentTypeEnum.NORMAL;
  }

  isExchange(): boolean {
    return this.value === ShipmentTypeEnum.EXCHANGE;
  }

  // Sobrescribir equals para comparación específica
  equals(other: ShipmentType): boolean {
    if (!(other instanceof ShipmentType)) {
      return false;
    }
    return this.value === other.value;
  }

  // Para serialización
  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  // Para reconstruir desde DB
  static fromPrimitives(value: string): ShipmentType {
    return ShipmentType.create(value);
  }

  toPrimitives(): string {
    return this.value;
  }
}