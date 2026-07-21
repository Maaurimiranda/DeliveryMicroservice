import type { Shipment } from "../domain/entities/shipment.js";
import type {
  ShippingErrorInfo,
  ShippingEventPublisher,
} from "../domain/services/shippingEventPublisher.js";
import {
  SHIPPING_CREATED_RK,
  SHIPPING_ERROR_RK,
  buildShippingCreated,
  buildShippingError,
} from "./events/shippingEvents.js";
import { publishEvent } from "./publisher.js";

// Adapter concreto del port ShippingEventPublisher: arma el payload camelCase y lo publica en
// `shipping_events` preservando el correlation_id. amqplib.publish es síncrono; envolvemos en async
// porque el port devuelve Promise<void>.
export const rabbitShippingEventPublisher: ShippingEventPublisher = {
  async shippingCreated(shipment: Shipment, correlationId: string): Promise<void> {
    publishEvent(SHIPPING_CREATED_RK, buildShippingCreated(shipment), correlationId);
  },

  async shippingError(info: ShippingErrorInfo, correlationId: string): Promise<void> {
    publishEvent(SHIPPING_ERROR_RK, buildShippingError(info), correlationId);
  },
};
