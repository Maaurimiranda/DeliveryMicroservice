import type { Shipment } from "../entities/shipment.js";
import type { ShipmentStatus } from "../entities/shipmentStatus.js";

// Port de salida: los casos de uso publican eventos de integración a través de esta interfaz.
// La implementación concreta (envelope + payload camelCase sobre `shipping_events`) vive en
// `src/rabbit/rabbitShippingEventPublisher.ts`. Métodos por intención: el use case pasa el
// dominio, el impl arma el payload.
export type ShippingErrorInfo = {
  orderId: string;
  userId: string;
  message: string;
};

// Condición del producto devuelto/original (CU07/CU09).
export type ProductCondition = "good" | "damaged" | "defective";

export interface ShippingEventPublisher {
  // CU01
  shippingCreated(shipment: Shipment, correlationId: string): Promise<void>;
  // CU02/CU03: previousStatus para el payload; el eventType lo deriva el impl del estado destino.
  shippingStateChanged(
    shipment: Shipment,
    previousStatus: ShipmentStatus,
    correlationId: string
  ): Promise<void>;
  // CU04
  shippingDelivered(shipment: Shipment, correlationId: string): Promise<void>;
  // CU05
  shippingCancelled(shipment: Shipment, reason: string, correlationId: string): Promise<void>;
  // CU06
  returnInitiated(shipment: Shipment, reason: string, correlationId: string): Promise<void>;
  // CU07
  returnCompleted(
    shipment: Shipment,
    productCondition: ProductCondition,
    correlationId: string
  ): Promise<void>;
  // CU08: ambos envíos vinculados (original + nuevo EXCHANGE).
  exchangeInitiated(
    original: Shipment,
    newShipment: Shipment,
    correlationId: string
  ): Promise<void>;
  // CU09: estados finales de ambos envíos según la condición del producto.
  exchangeFinalized(
    original: Shipment,
    newShipment: Shipment,
    productCondition: ProductCondition,
    correlationId: string
  ): Promise<void>;
  // Fallo de consumer (solo consumers; los errores HTTP se responden por HTTP).
  shippingError(info: ShippingErrorInfo, correlationId: string): Promise<void>;
}
