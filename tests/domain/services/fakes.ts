import type { Article } from "../../../src/domain/entities/article.js";
import {
  cancel,
  completeReturn,
  createShipment,
  deliver,
  prepare,
  ship,
  startReturn,
  type Shipment,
} from "../../../src/domain/entities/shipment.js";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import type { ShippingAddress } from "../../../src/domain/entities/shippingAddress.js";
import type { ShipmentRepository } from "../../../src/domain/repositories/shipmentRepository.js";
import type {
  ProductCondition,
  ShippingErrorInfo,
  ShippingEventPublisher,
} from "../../../src/domain/services/shippingEventPublisher.js";

// Fakes compartidos por los tests de casos de uso (CU02–CU11). No es un *.test.ts: el runner
// solo levanta "tests/**/*.test.ts", así que este módulo se importa pero no se ejecuta como suite.

export const OWNER = "user_456";
export const OTRO_USUARIO = "user_999";

export const shippingAddress: ShippingAddress = {
  customerId: OWNER,
  name: "Juan Pérez",
  address: "Av. Siempreviva 742",
  city: "Springfield",
  zipCode: "5000",
  phone: "+54 351 555-0000",
};

export const articles: readonly Article[] = [{ articleId: "art_001", quantity: 2 }];

export function nuevoEnvio(direccion: ShippingAddress = shippingAddress): Shipment {
  return createShipment({ orderId: "order_123", shippingAddress: direccion, articles });
}

// Lleva un envío recién creado hasta el estado pedido pasando por las transiciones reales.
export function envioEn(
  status: ShipmentStatus,
  direccion: ShippingAddress = shippingAddress
): Shipment {
  let s = nuevoEnvio(direccion);
  if (status === ShipmentStatus.PENDING) return s;
  if (status === ShipmentStatus.CANCELLED) return cancel(s, "admin_user", "sin stock");

  s = prepare(s, "admin_user");
  if (status === ShipmentStatus.PREPARED) return s;

  s = ship(s, "admin_user");
  if (status === ShipmentStatus.IN_TRANSIT) return s;

  s = deliver(s, "admin_user");
  if (status === ShipmentStatus.DELIVERED) return s;

  s = startReturn(s, OWNER, "producto fallado");
  if (status === ShipmentStatus.RETURNING) return s;

  return completeReturn(s, "admin_user");
}

export type FakeRepo = ShipmentRepository & {
  readonly store: Map<string, Shipment>;
  readonly saved: Shipment[];
  readonly updated: Shipment[];
};

function matches(shipment: Shipment, userId?: string): boolean {
  return userId === undefined || shipment.shippingAddress.customerId === userId;
}

export function fakeRepo(...initial: readonly Shipment[]): FakeRepo {
  const store = new Map(initial.map((s) => [s.id, s]));
  const saved: Shipment[] = [];
  const updated: Shipment[] = [];

  return {
    store,
    saved,
    updated,
    async save(shipment) {
      saved.push(shipment);
      store.set(shipment.id, shipment);
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findAll(filter, page) {
      const all = [...store.values()].filter((s) => matches(s, filter.userId));
      return all.slice(page.skip, page.skip + page.limit);
    },
    async count(filter) {
      return [...store.values()].filter((s) => matches(s, filter.userId)).length;
    },
    async update(shipment) {
      updated.push(shipment);
      store.set(shipment.id, shipment);
    },
  };
}

export type RecordedEvents = {
  created: { shipment: Shipment; correlationId: string }[];
  stateChanged: {
    shipment: Shipment;
    previousStatus: ShipmentStatus;
    correlationId: string;
  }[];
  delivered: { shipment: Shipment; correlationId: string }[];
  cancelled: { shipment: Shipment; reason: string; correlationId: string }[];
  returnInitiated: { shipment: Shipment; reason: string; correlationId: string }[];
  returnCompleted: {
    shipment: Shipment;
    productCondition: ProductCondition;
    correlationId: string;
  }[];
  exchangeInitiated: { original: Shipment; newShipment: Shipment; correlationId: string }[];
  exchangeFinalized: {
    original: Shipment;
    newShipment: Shipment;
    productCondition: ProductCondition;
    correlationId: string;
  }[];
  errors: { info: ShippingErrorInfo; correlationId: string }[];
};

export type FakePublisher = ShippingEventPublisher & { readonly events: RecordedEvents };

export function fakePublisher(): FakePublisher {
  const events: RecordedEvents = {
    created: [],
    stateChanged: [],
    delivered: [],
    cancelled: [],
    returnInitiated: [],
    returnCompleted: [],
    exchangeInitiated: [],
    exchangeFinalized: [],
    errors: [],
  };

  return {
    events,
    async shippingCreated(shipment, correlationId) {
      events.created.push({ shipment, correlationId });
    },
    async shippingStateChanged(shipment, previousStatus, correlationId) {
      events.stateChanged.push({ shipment, previousStatus, correlationId });
    },
    async shippingDelivered(shipment, correlationId) {
      events.delivered.push({ shipment, correlationId });
    },
    async shippingCancelled(shipment, reason, correlationId) {
      events.cancelled.push({ shipment, reason, correlationId });
    },
    async returnInitiated(shipment, reason, correlationId) {
      events.returnInitiated.push({ shipment, reason, correlationId });
    },
    async returnCompleted(shipment, productCondition, correlationId) {
      events.returnCompleted.push({ shipment, productCondition, correlationId });
    },
    async exchangeInitiated(original, newShipment, correlationId) {
      events.exchangeInitiated.push({ original, newShipment, correlationId });
    },
    async exchangeFinalized(original, newShipment, productCondition, correlationId) {
      events.exchangeFinalized.push({ original, newShipment, productCondition, correlationId });
    },
    async shippingError(info, correlationId) {
      events.errors.push({ info, correlationId });
    },
  };
}

// Cuenta cuántos eventos se publicaron en total (para afirmar "no se publicó nada").
export function totalEventos(events: RecordedEvents): number {
  return Object.values(events).reduce((acc, list) => acc + list.length, 0);
}
