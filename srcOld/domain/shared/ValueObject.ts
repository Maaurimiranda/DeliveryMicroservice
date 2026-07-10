// src/domain/shared/ValueObject.ts

/**
 * Clase base abstracta para Value Objects en DDD
 * 
 * Un Value Object es inmutable y se compara por su valor, no por identidad.
 * Ejemplos: ShipmentStatus, ShipmentType, Money, Address, etc.
 */
export abstract class ValueObject<T> {
  protected readonly _value: T;

  protected constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  /**
   * Obtiene el valor del Value Object
   */
  get value(): T {
    return this._value;
  }

  /**
   * Valida el valor antes de asignarlo
   * Las subclases deben implementar sus propias reglas de validación
   */
  protected abstract validate(value: T): void;

  /**
   * Compara dos Value Objects por su valor
   */
  equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (!(other instanceof ValueObject)) {
      return false;
    }

    return this._value === other._value;
  }

  /**
   * Representación en string del Value Object
   */
  toString(): string {
    return String(this._value);
  }

  /**
   * Convierte a primitivo para serialización
   */
  toPrimitives(): T {
    return this._value;
  }

  /**
   * Alias para JSON.stringify
   */
  toJSON(): T {
    return this.toPrimitives();
  }

  /**
   * Compara si el valor es igual a otro
   */
  isEqual(value: T): boolean {
    return this._value === value;
  }

  /**
   * Valida que el valor no sea nulo o undefined
   */
  protected ensureValueIsDefined(value: T): void {
    if (value === null || value === undefined) {
      throw new Error(`El valor no puede ser nulo o undefined`);
    }
  }

  /**
   * Valida que el valor sea de un tipo específico
   */
  protected ensureValueIsOfType(value: T, type: string): void {
    if (typeof value !== type) {
      throw new Error(
        `El valor debe ser de tipo ${type}, pero se recibió ${typeof value}`
      );
    }
  }
}