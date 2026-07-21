import type { Shipment } from "../domain/entities/shipment.js";
import type { ShipmentStatus } from "../domain/entities/shipmentStatus.js";
import type {
  ProductCondition,
  ShippingErrorInfo,
  ShippingEventPublisher,
} from "../domain/services/shippingEventPublisher.js";
import {
  EXCHANGE_FINALIZED_RK,
  EXCHANGE_INITIATED_RK,
  RETURN_COMPLETED_RK,
  RETURN_INITIATED_RK,
  SHIPPING_CANCELLED_RK,
  SHIPPING_CREATED_RK,
  SHIPPING_DELIVERED_RK,
  SHIPPING_ERROR_RK,
  SHIPPING_STATE_CHANGED_RK,
  buildExchangeFinalized,
  buildExchangeInitiated,
  buildReturnCompleted,
  buildReturnInitiated,
  buildShippingCancelled,
  buildShippingCreated,
  buildShippingDelivered,
  buildShippingError,
  buildShippingStateChanged,
} from "./events/shippingEvents.js";
import { publishEvent } from "./publisher.js";

// Adapter concreto del port ShippingEventPublisher: arma el payload camelCase y lo publica en
// `shipping_events` preservando el correlation_id. amqplib.publish es síncrono; envolvemos en async
// porque el port devuelve Promise<void>.
export const rabbitShippingEventPublisher: ShippingEventPublisher = {
  async shippingCreated(shipment: Shipment, correlationId: string): Promise<void> {
    publishEvent(SHIPPING_CREATED_RK, buildShippingCreated(shipment), correlationId);
  },

  async shippingStateChanged(
    shipment: Shipment,
    previousStatus: ShipmentStatus,
    correlationId: string
  ): Promise<void> {
    publishEvent(
      SHIPPING_STATE_CHANGED_RK,
      buildShippingStateChanged(shipment, previousStatus),
      correlationId
    );
  },

  async shippingDelivered(shipment: Shipment, correlationId: string): Promise<void> {
    publishEvent(SHIPPING_DELIVERED_RK, buildShippingDelivered(shipment), correlationId);
  },

  async shippingCancelled(
    shipment: Shipment,
    reason: string,
    correlationId: string
  ): Promise<void> {
    publishEvent(SHIPPING_CANCELLED_RK, buildShippingCancelled(shipment, reason), correlationId);
  },

  async returnInitiated(
    shipment: Shipment,
    reason: string,
    correlationId: string
  ): Promise<void> {
    publishEvent(RETURN_INITIATED_RK, buildReturnInitiated(shipment, reason), correlationId);
  },

  async returnCompleted(
    shipment: Shipment,
    productCondition: ProductCondition,
    correlationId: string
  ): Promise<void> {
    publishEvent(
      RETURN_COMPLETED_RK,
      buildReturnCompleted(shipment, productCondition),
      correlationId
    );
  },

  async exchangeInitiated(
    original: Shipment,
    newShipment: Shipment,
    correlationId: string
  ): Promise<void> {
    publishEvent(
      EXCHANGE_INITIATED_RK,
      buildExchangeInitiated(original, newShipment),
      correlationId
    );
  },

  async exchangeFinalized(
    original: Shipment,
    newShipment: Shipment,
    productCondition: ProductCondition,
    correlationId: string
  ): Promise<void> {
    publishEvent(
      EXCHANGE_FINALIZED_RK,
      buildExchangeFinalized(original, newShipment, productCondition),
      correlationId
    );
  },

  async shippingError(info: ShippingErrorInfo, correlationId: string): Promise<void> {
    publishEvent(SHIPPING_ERROR_RK, buildShippingError(info), correlationId);
  },
};
