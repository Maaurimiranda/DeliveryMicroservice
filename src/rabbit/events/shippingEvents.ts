import type { Article } from "../../domain/entities/article.js";
import type { Shipment } from "../../domain/entities/shipment.js";
import { ShipmentStatus } from "../../domain/entities/shipmentStatus.js";
import type { ShipmentType } from "../../domain/entities/shipmentType.js";
import type { ShippingAddress } from "../../domain/entities/shippingAddress.js";
import type {
  ProductCondition,
  ShippingErrorInfo,
} from "../../domain/services/shippingEventPublisher.js";

// Routing keys sobre el topic propio `shipping_events`.
export const SHIPPING_CREATED_RK = "shipping.created";
export const SHIPPING_STATE_CHANGED_RK = "shipping.state.changed";
export const SHIPPING_DELIVERED_RK = "shipping.delivered";
export const SHIPPING_CANCELLED_RK = "shipping.cancelled";
export const RETURN_INITIATED_RK = "shipping.return.initiated";
export const RETURN_COMPLETED_RK = "shipping.return.completed";
export const EXCHANGE_INITIATED_RK = "shipping.exchange.initiated";
export const EXCHANGE_FINALIZED_RK = "shipping.exchange.completed.final";
export const SHIPPING_ERROR_RK = "shipping.error";

// eventType del SHIPPING_STATE_CHANGED: se deriva del estado destino (CU02/CU03).
export type StateChangedEventType = "MOVED_TO_PREPARED" | "MOVED_TO_IN_TRANSIT";

// Payloads camelCase (README "Interfaz RabbitMQ"). Van dentro del sobre { correlation_id, message }.
export type ShippingCreatedMessage = {
  type: "SHIPPING_CREATED";
  shipmentId: string;
  orderId: string;
  status: ShipmentStatus;
  typeShipment: ShipmentType;
  shippingAddress: ShippingAddress;
  articles: readonly Article[];
  timestamp: string;
};

export type ShippingStateChangedMessage = {
  type: "SHIPPING_STATE_CHANGED";
  eventType: StateChangedEventType;
  shipmentId: string;
  orderId: string;
  status: ShipmentStatus;
  previousStatus: ShipmentStatus;
  timestamp: string;
};

export type ShippingDeliveredMessage = {
  type: "SHIPPING_DELIVERED";
  shipmentId: string;
  orderId: string;
  deliveredAt: string;
  timestamp: string;
};

export type ShippingCancelledMessage = {
  type: "SHIPPING_CANCELLED";
  shipmentId: string;
  orderId: string;
  status: ShipmentStatus;
  reason: string;
  cancelledAt: string;
  timestamp: string;
};

export type ReturnInitiatedMessage = {
  type: "RETURN_INITIATED";
  shipmentId: string;
  orderId: string;
  reason: string;
  articles: readonly Article[];
  initiatedAt: string;
  timestamp: string;
};

export type ReturnCompletedMessage = {
  type: "RETURN_COMPLETED";
  shipmentId: string;
  orderId: string;
  productCondition: ProductCondition;
  completedAt: string;
  timestamp: string;
};

export type ExchangeInitiatedMessage = {
  type: "EXCHANGE_INITIATED";
  originalShipmentId: string;
  newShipmentId: string;
  orderId: string;
  articles: readonly Article[];
  initiatedAt: string;
  timestamp: string;
};

export type ExchangeFinalizedMessage = {
  type: "EXCHANGE_FINALIZED";
  originalShipmentId: string;
  newShipmentId: string;
  orderId: string;
  productCondition: ProductCondition;
  originalShipmentStatus: ShipmentStatus;
  newShipmentStatus: ShipmentStatus;
  timestamp: string;
};

export type ShippingErrorMessage = {
  type: "SHIPPING_ERROR";
  orderId: string;
  userId: string;
  errorMessage: string;
  occurredAt: string;
  timestamp: string;
};

function stateChangedEventType(status: ShipmentStatus): StateChangedEventType {
  if (status === ShipmentStatus.PREPARED) return "MOVED_TO_PREPARED";
  if (status === ShipmentStatus.IN_TRANSIT) return "MOVED_TO_IN_TRANSIT";
  throw new Error(`SHIPPING_STATE_CHANGED no aplica al estado ${status}`);
}

// CU01: envío creado. `timestamp` = createdAt del envío (determinista).
export function buildShippingCreated(shipment: Shipment): ShippingCreatedMessage {
  return {
    type: "SHIPPING_CREATED",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    status: shipment.status,
    typeShipment: shipment.type,
    shippingAddress: shipment.shippingAddress,
    articles: shipment.articles,
    timestamp: shipment.createdAt.toISOString(),
  };
}

// CU02/CU03: cambio de estado del ciclo normal. `timestamp` = updatedAt (determinista).
export function buildShippingStateChanged(
  shipment: Shipment,
  previousStatus: ShipmentStatus
): ShippingStateChangedMessage {
  return {
    type: "SHIPPING_STATE_CHANGED",
    eventType: stateChangedEventType(shipment.status),
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    status: shipment.status,
    previousStatus,
    timestamp: shipment.updatedAt.toISOString(),
  };
}

// CU04: entregado.
export function buildShippingDelivered(shipment: Shipment): ShippingDeliveredMessage {
  const at = shipment.updatedAt.toISOString();
  return {
    type: "SHIPPING_DELIVERED",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    deliveredAt: at,
    timestamp: at,
  };
}

// CU05: cancelado. `reason` requerido por contrato.
export function buildShippingCancelled(
  shipment: Shipment,
  reason: string
): ShippingCancelledMessage {
  const at = shipment.updatedAt.toISOString();
  return {
    type: "SHIPPING_CANCELLED",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    status: shipment.status,
    reason,
    cancelledAt: at,
    timestamp: at,
  };
}

// CU06: devolución iniciada. `articles` son los del envío que se devuelve.
export function buildReturnInitiated(
  shipment: Shipment,
  reason: string
): ReturnInitiatedMessage {
  const at = shipment.updatedAt.toISOString();
  return {
    type: "RETURN_INITIATED",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    reason,
    articles: shipment.articles,
    initiatedAt: at,
    timestamp: at,
  };
}

// CU07: devolución completada (evento crítico para el reembolso en Orders).
export function buildReturnCompleted(
  shipment: Shipment,
  productCondition: ProductCondition
): ReturnCompletedMessage {
  const at = shipment.updatedAt.toISOString();
  return {
    type: "RETURN_COMPLETED",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    productCondition,
    completedAt: at,
    timestamp: at,
  };
}

// CU08: cambio iniciado. `articles` = los del envío EXCHANGE (iguales a los del original).
export function buildExchangeInitiated(
  original: Shipment,
  newShipment: Shipment
): ExchangeInitiatedMessage {
  const at = original.updatedAt.toISOString();
  return {
    type: "EXCHANGE_INITIATED",
    originalShipmentId: original.id,
    newShipmentId: newShipment.id,
    orderId: original.orderId,
    articles: newShipment.articles,
    initiatedAt: at,
    timestamp: at,
  };
}

// CU09: cambio finalizado. Lleva los estados finales de ambos envíos.
export function buildExchangeFinalized(
  original: Shipment,
  newShipment: Shipment,
  productCondition: ProductCondition
): ExchangeFinalizedMessage {
  return {
    type: "EXCHANGE_FINALIZED",
    originalShipmentId: original.id,
    newShipmentId: newShipment.id,
    orderId: original.orderId,
    productCondition,
    originalShipmentStatus: original.status,
    newShipmentStatus: newShipment.status,
    timestamp: original.updatedAt.toISOString(),
  };
}

// Fallo de consumer (ej. CU01 sin dirección). `message` del port -> `errorMessage`.
export function buildShippingError(info: ShippingErrorInfo): ShippingErrorMessage {
  const now = new Date().toISOString();
  return {
    type: "SHIPPING_ERROR",
    orderId: info.orderId,
    userId: info.userId,
    errorMessage: info.message,
    occurredAt: now,
    timestamp: now,
  };
}
