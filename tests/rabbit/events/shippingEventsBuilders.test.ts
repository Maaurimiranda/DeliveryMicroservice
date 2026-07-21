import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomerInfo } from "../../../src/domain/entities/customerInfo.js";
import {
  cancel,
  completeExchange,
  createExchangeShipment,
  createShipment,
  deliver,
  linkRelatedShipment,
  prepare,
  ship,
  startExchange,
  startReturn,
  type Shipment,
} from "../../../src/domain/entities/shipment.js";
import {
  buildExchangeFinalized,
  buildExchangeInitiated,
  buildReturnCompleted,
  buildReturnInitiated,
  buildShippingCancelled,
  buildShippingDelivered,
  buildShippingStateChanged,
} from "../../../src/rabbit/events/shippingEvents.js";

const customerInfo: CustomerInfo = {
  customerId: "user_789",
  name: "Juan Pérez",
  address: "Calle Falsa 123",
  city: "Buenos Aires",
  zipCode: "1234",
  phone: "+54 11 1234-5678",
};

function pending(): Shipment {
  return createShipment({
    orderId: "order_456",
    customerInfo,
    articles: [{ articleId: "art_001", quantity: 2 }],
  });
}

function delivered(): Shipment {
  return deliver(ship(prepare(pending(), "admin"), "admin"), "admin");
}

describe("buildShippingStateChanged (CU02/CU03)", () => {
  it("PENDING → PREPARED emite eventType MOVED_TO_PREPARED", () => {
    const before = pending();
    const after = prepare(before, "admin");
    const msg = buildShippingStateChanged(after, before.status);

    assert.equal(msg.type, "SHIPPING_STATE_CHANGED");
    assert.equal(msg.eventType, "MOVED_TO_PREPARED");
    assert.equal(msg.status, "PREPARED");
    assert.equal(msg.previousStatus, "PENDING");
    assert.equal(msg.timestamp, after.updatedAt.toISOString());
  });

  it("PREPARED → IN_TRANSIT emite eventType MOVED_TO_IN_TRANSIT", () => {
    const before = prepare(pending(), "admin");
    const after = ship(before, "admin");
    const msg = buildShippingStateChanged(after, before.status);

    assert.equal(msg.eventType, "MOVED_TO_IN_TRANSIT");
    assert.equal(msg.status, "IN_TRANSIT");
    assert.equal(msg.previousStatus, "PREPARED");
  });

  it("lanza si el estado destino no es PREPARED ni IN_TRANSIT", () => {
    const d = delivered();
    assert.throws(() => buildShippingStateChanged(d, "IN_TRANSIT"));
  });
});

describe("buildShippingDelivered (CU04)", () => {
  it("lleva deliveredAt = updatedAt del envío", () => {
    const d = delivered();
    const msg = buildShippingDelivered(d);

    assert.equal(msg.type, "SHIPPING_DELIVERED");
    assert.equal(msg.shipmentId, d.id);
    assert.equal(msg.orderId, "order_456");
    assert.equal(msg.deliveredAt, d.updatedAt.toISOString());
    assert.equal(msg.timestamp, d.updatedAt.toISOString());
  });
});

describe("buildShippingCancelled (CU05)", () => {
  it("incluye el reason y status CANCELLED", () => {
    const c = cancel(pending(), "admin", "Cliente canceló");
    const msg = buildShippingCancelled(c, "Cliente canceló");

    assert.equal(msg.type, "SHIPPING_CANCELLED");
    assert.equal(msg.status, "CANCELLED");
    assert.equal(msg.reason, "Cliente canceló");
    assert.equal(msg.cancelledAt, c.updatedAt.toISOString());
  });
});

describe("buildReturnInitiated (CU06)", () => {
  it("incluye reason y los artículos del envío", () => {
    const r = startReturn(delivered(), "user_789", "Defectuoso");
    const msg = buildReturnInitiated(r, "Defectuoso");

    assert.equal(msg.type, "RETURN_INITIATED");
    assert.equal(msg.reason, "Defectuoso");
    assert.deepEqual(msg.articles, [{ articleId: "art_001", quantity: 2 }]);
    assert.equal(msg.initiatedAt, r.updatedAt.toISOString());
  });
});

describe("buildReturnCompleted (CU07)", () => {
  it("incluye productCondition", () => {
    const r = startReturn(delivered(), "user_789", "Defectuoso");
    const msg = buildReturnCompleted(r, "good");

    assert.equal(msg.type, "RETURN_COMPLETED");
    assert.equal(msg.productCondition, "good");
    assert.equal(msg.completedAt, r.updatedAt.toISOString());
  });
});

describe("buildExchangeInitiated (CU08)", () => {
  it("vincula ambos envíos; articles = los del envío EXCHANGE", () => {
    const original = linkRelatedShipment(
      startExchange(delivered(), "user_789", "Cambio de talle"),
      "ship_new"
    );
    const nuevo = createExchangeShipment(original, original.articles);
    const msg = buildExchangeInitiated(original, nuevo);

    assert.equal(msg.type, "EXCHANGE_INITIATED");
    assert.equal(msg.originalShipmentId, original.id);
    assert.equal(msg.newShipmentId, nuevo.id);
    assert.equal(msg.orderId, "order_456");
    assert.deepEqual(msg.articles, [{ articleId: "art_001", quantity: 2 }]);
  });
});

describe("buildExchangeFinalized (CU09)", () => {
  it("good → original EXCHANGE_PROCESSED, nuevo PREPARED", () => {
    const original = linkRelatedShipment(
      startExchange(delivered(), "user_789", "Cambio de talle"),
      "ship_new"
    );
    const nuevo = createExchangeShipment(original, original.articles);
    const originalFinal = completeExchange(original, "admin");
    const nuevoFinal = prepare(nuevo, "admin");

    const msg = buildExchangeFinalized(originalFinal, nuevoFinal, "good");

    assert.equal(msg.type, "EXCHANGE_FINALIZED");
    assert.equal(msg.productCondition, "good");
    assert.equal(msg.originalShipmentStatus, "EXCHANGE_PROCESSED");
    assert.equal(msg.newShipmentStatus, "PREPARED");
  });
});
