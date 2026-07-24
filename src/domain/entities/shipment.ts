import { randomBytes } from "node:crypto";
import { InvalidShipmentDataError, InvalidTransitionError } from "../errors/domainErrors.js";
import type { Article } from "./article.js";
import { ShipmentStatus, canTransition } from "./shipmentStatus.js";
import { ShipmentType } from "./shipmentType.js";
import type { ShippingAddress } from "./shippingAddress.js";
import type { TrackingEntry } from "./trackingEntry.js";

export type Shipment = {
  readonly id: string;
  readonly orderId: string;
  readonly status: ShipmentStatus;
  readonly type: ShipmentType;
  readonly shippingAddress: ShippingAddress; // Snapshot inmutable copiado de CustomerInfo
  readonly articles: readonly Article[];
  readonly tracking: readonly TrackingEntry[]; // Historial de seguimiento del envío
  readonly relatedShipmentId?: string; // ID del envío relacionado (por ejemplo, un envío de cambio o devolución)
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateShipmentInput = { // CU01: datos necesarios para crear un envío
  readonly orderId: string;
  readonly shippingAddress: ShippingAddress;
  readonly articles: readonly Article[];
  readonly type?: ShipmentType;
  readonly relatedShipmentId?: string;
  readonly actor?: string;
  readonly description?: string; // Descripción del primer tracking entry (H6)
};

export function generateShipmentId(): string {
  return `ship_${Date.now()}_${randomBytes(3).toString("hex")}`;
}

// El snapshot se copia entero (y CU08 lo reusa tal cual en el envío de cambio): si algún campo
// llega vacío, el defecto se propaga. Por eso se validan los seis, no solo los identificatorios.
const REQUIRED_ADDRESS_FIELDS = [
  ["customerId", "El customerId es requerido y no puede estar vacío."],
  ["name", "El nombre del destinatario es requerido y no puede estar vacío."],
  ["address", "La dirección de envío es requerida y no puede estar vacía."],
  ["city", "La ciudad es requerida y no puede estar vacía."],
  ["zipCode", "El código postal es requerido y no puede estar vacío."],
  ["phone", "El teléfono es requerido y no puede estar vacío."],
] as const;

function validateCreateInput(input: CreateShipmentInput): void {
  if (input.orderId.trim() === "") {
    throw new InvalidShipmentDataError("orderId", "El orderId es requerido y no puede estar vacío.");
  }
  if (input.articles.length === 0) {
    throw new InvalidShipmentDataError("articles", "El envío requiere al menos un artículo.");
  }
  for (const [field, message] of REQUIRED_ADDRESS_FIELDS) {
    if (input.shippingAddress[field].trim() === "") {
      throw new InvalidShipmentDataError(`shippingAddress.${field}`, message);
    }
  }
}

// CU01: todo envío nace en PENDING con su primera entrada de tracking.
export function createShipment(input: CreateShipmentInput): Shipment {
  validateCreateInput(input);

  const now = new Date();
  const actor = input.actor ?? "system";

  return {
    id: generateShipmentId(),
    orderId: input.orderId,
    status: ShipmentStatus.PENDING,
    type: input.type ?? ShipmentType.NORMAL,
    shippingAddress: input.shippingAddress,
    articles: [...input.articles],
    tracking: [
      {
        status: ShipmentStatus.PENDING,
        description: input.description ?? "Envío registrado, pendiente de preparación",
        timestamp: now,
        actor,
      },
    ],
    relatedShipmentId: input.relatedShipmentId,
    createdAt: now,
    updatedAt: now,
  };
}

function transition(
  shipment: Shipment,
  to: ShipmentStatus,
  actor: string,
  description: string
): Shipment {
  if (!canTransition(shipment.status, to)) {
    throw new InvalidTransitionError(shipment.id, shipment.status, to);
  }

  const now = new Date();

  return {
    ...shipment,
    status: to,
    tracking: [...shipment.tracking, { status: to, description, timestamp: now, actor }],
    updatedAt: now,
  };
}

// Cada transición acepta una `description` opcional que reemplaza el texto por defecto de la
// entrada de tracking (el body HTTP la deja pasar). Sin ella vale el texto fijo del dominio.

// CU02
export function prepare(shipment: Shipment, actor: string, description?: string): Shipment {
  return transition(
    shipment,
    ShipmentStatus.PREPARED,
    actor,
    description ?? "Envío preparado para entrega"
  );
}

// CU03
export function ship(shipment: Shipment, actor: string, description?: string): Shipment {
  return transition(shipment, ShipmentStatus.IN_TRANSIT, actor, description ?? "Envío en camino");
}

// CU04
export function deliver(shipment: Shipment, actor: string, description?: string): Shipment {
  return transition(
    shipment,
    ShipmentStatus.DELIVERED,
    actor,
    description ?? "Envío entregado al cliente"
  );
}

// CU05
export function cancel(
  shipment: Shipment,
  actor: string,
  reason: string,
  description?: string
): Shipment {
  return transition(
    shipment,
    ShipmentStatus.CANCELLED,
    actor,
    description ?? `Envío cancelado: ${reason}`
  );
}

// CU06
export function startReturn(
  shipment: Shipment,
  actor: string,
  reason: string,
  description?: string
): Shipment {
  return transition(
    shipment,
    ShipmentStatus.RETURNING,
    actor,
    description ?? `Devolución iniciada: ${reason}`
  );
}

// CU07
export function completeReturn(
  shipment: Shipment,
  actor: string,
  description?: string
): Shipment {
  return transition(
    shipment,
    ShipmentStatus.RETURNED,
    actor,
    description ?? "Devolución completada"
  );
}

// CU08: el original vuelve al almacén por el mismo camino que una devolución.
export function startExchange(
  shipment: Shipment,
  actor: string,
  reason: string,
  description?: string
): Shipment {
  return transition(
    shipment,
    ShipmentStatus.RETURNING,
    actor,
    description ?? `Cambio iniciado: ${reason}`
  );
}

// CU09: solo un original con cambio iniciado (relatedShipmentId) puede terminar en
// EXCHANGE_PROCESSED; una devolución pura solo puede completarse como RETURNED.
export function completeExchange(
  shipment: Shipment,
  actor: string,
  description?: string
): Shipment {
  if (!canTransition(shipment.status, ShipmentStatus.EXCHANGE_PROCESSED)) {
    throw new InvalidTransitionError(shipment.id, shipment.status, ShipmentStatus.EXCHANGE_PROCESSED);
  }
  if (shipment.relatedShipmentId === undefined) {
    throw new InvalidShipmentDataError(
      "relatedShipmentId",
      `El envío ${shipment.id} no tiene un envío de cambio vinculado: una devolución no puede completarse como cambio.`
    );
  }
  return transition(
    shipment,
    ShipmentStatus.EXCHANGE_PROCESSED,
    actor,
    description ?? "Cambio procesado"
  );
}

// CU08: el cambio genera un segundo envío tipo EXCHANGE vinculado al original.
export function createExchangeShipment(
  original: Shipment,
  articles: readonly Article[],
  actor = "system"
): Shipment {
  return createShipment({
    orderId: original.orderId,
    shippingAddress: original.shippingAddress,
    articles,
    type: ShipmentType.EXCHANGE,
    relatedShipmentId: original.id,
    actor,
  });
}

// Cierra el vínculo en sentido inverso: original -> envío de cambio.
export function linkRelatedShipment(shipment: Shipment, relatedShipmentId: string): Shipment {
  return { ...shipment, relatedShipmentId, updatedAt: new Date() };
}
