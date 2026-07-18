import type { Shipment } from "../entities/shipment.js";

// Port de salida: el caso de uso publica eventos de integración a través de esta interfaz.
// La implementación concreta (envelope + payload camelCase sobre `shipping_events`) se
// cablea en la Etapa 3. Métodos por intención: el use case pasa el dominio, el impl arma
// el payload.
export type ShippingErrorInfo = {
  orderId: string;
  userId: string;
  message: string;
};

export interface ShippingEventPublisher {
  shippingCreated(shipment: Shipment, correlationId: string): Promise<void>;
  shippingError(info: ShippingErrorInfo, correlationId: string): Promise<void>;
}
