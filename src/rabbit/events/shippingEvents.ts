import type { Article } from "../../domain/entities/article.js";
import type { CustomerInfo } from "../../domain/entities/customerInfo.js";
import type { Shipment } from "../../domain/entities/shipment.js";
import type { ShipmentStatus } from "../../domain/entities/shipmentStatus.js";
import type { ShipmentType } from "../../domain/entities/shipmentType.js";
import type { ShippingErrorInfo } from "../../domain/services/shippingEventPublisher.js";

// Routing keys sobre el topic propio `shipping_events`.
export const SHIPPING_CREATED_RK = "shipping.created";
export const SHIPPING_ERROR_RK = "shipping.error";

// Payloads camelCase (README "Interfaz RabbitMQ"). Van dentro del sobre { correlation_id, message }.
export type ShippingCreatedMessage = {
  type: "SHIPPING_CREATED";
  shipmentId: string;
  orderId: string;
  status: ShipmentStatus;
  typeShipment: ShipmentType;
  customerInfo: CustomerInfo;
  articles: readonly Article[];
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

// CU01: envío creado. `timestamp` = createdAt del envío (determinista).
export function buildShippingCreated(shipment: Shipment): ShippingCreatedMessage {
  return {
    type: "SHIPPING_CREATED",
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    status: shipment.status,
    typeShipment: shipment.type,
    customerInfo: shipment.customerInfo,
    articles: shipment.articles,
    timestamp: shipment.createdAt.toISOString(),
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
