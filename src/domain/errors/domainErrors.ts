import { allowedTransitions, type ShipmentStatus } from "../entities/shipmentStatus.js";

export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

function invalidTransitionMessage(
  shipmentId: string,
  from: ShipmentStatus,
  to: ShipmentStatus
): string {
  const permitidas = allowedTransitions(from);
  const detalle = permitidas.length > 0 ? permitidas.join(", ") : "ninguna (estado final)";
  return `Transición inválida en el envío ${shipmentId}: no se puede pasar de ${from} a ${to}. Transiciones permitidas desde ${from}: ${detalle}.`;
}

export class InvalidTransitionError extends DomainError {
  readonly code = "INVALID_TRANSITION";

  constructor(
    readonly shipmentId: string,
    readonly from: ShipmentStatus,
    readonly to: ShipmentStatus
  ) {
    super(invalidTransitionMessage(shipmentId, from, to));
  }
}

export class ShipmentNotFoundError extends DomainError {
  readonly code = "SHIPMENT_NOT_FOUND";

  constructor(readonly shipmentId: string) {
    super(`No se encontró el envío ${shipmentId}.`);
  }
}

export class InvalidShipmentDataError extends DomainError {
  readonly code = "INVALID_SHIPMENT_DATA";

  constructor(
    readonly field: string,
    message: string
  ) {
    super(message);
  }
}
