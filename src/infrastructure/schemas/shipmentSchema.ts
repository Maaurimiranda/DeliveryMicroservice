import type { Article } from "../../domain/entities/article.js";
import type { Shipment } from "../../domain/entities/shipment.js";
import type { ShipmentStatus } from "../../domain/entities/shipmentStatus.js";
import type { ShipmentType } from "../../domain/entities/shipmentType.js";
import type { ShippingAddress } from "../../domain/entities/shippingAddress.js";
import type { TrackingEntry } from "../../domain/entities/trackingEntry.js";

// Forma del documento Mongo: igual que Shipment pero el id de dominio (ship_*) es el _id.
// Sin campo `id`. Fechas quedan como Date (el driver hace Date <-> BSON Date).
export type ShipmentDocument = {
  _id: string;
  orderId: string;
  status: ShipmentStatus;
  type: ShipmentType;
  shippingAddress: ShippingAddress;
  articles: Article[];
  tracking: TrackingEntry[];
  relatedShipmentId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toDocument(shipment: Shipment): ShipmentDocument {
  const { id, articles, tracking, ...rest } = shipment;
  return { _id: id, ...rest, articles: [...articles], tracking: [...tracking] };
}

export function toDomain(doc: ShipmentDocument): Shipment {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}
