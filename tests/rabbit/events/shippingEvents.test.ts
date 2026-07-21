import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomerInfo } from "../../../src/domain/entities/customerInfo.js";
import { createShipment } from "../../../src/domain/entities/shipment.js";
import { ShipmentType } from "../../../src/domain/entities/shipmentType.js";
import {
  SHIPPING_CREATED_RK,
  SHIPPING_ERROR_RK,
  buildShippingCreated,
  buildShippingError,
} from "../../../src/rabbit/events/shippingEvents.js";

const customerInfo: CustomerInfo = {
  customerId: "user_789",
  name: "Juan Pérez",
  address: "Calle Falsa 123",
  city: "Buenos Aires",
  zipCode: "1234",
  phone: "+54 11 1234-5678",
};

const articles = [{ articleId: "art_001", quantity: 2 }];

describe("buildShippingCreated", () => {
  it("arma el payload camelCase de SHIPPING_CREATED", () => {
    const shipment = createShipment({ orderId: "order_456", customerInfo, articles });
    const msg = buildShippingCreated(shipment);

    assert.equal(msg.type, "SHIPPING_CREATED");
    assert.equal(msg.shipmentId, shipment.id);
    assert.equal(msg.orderId, "order_456");
    assert.equal(msg.status, "PENDING");
    assert.equal(msg.typeShipment, "NORMAL");
    assert.deepEqual(msg.customerInfo, customerInfo);
    assert.deepEqual(msg.articles, articles);
    assert.equal(msg.timestamp, shipment.createdAt.toISOString());
  });

  it("refleja typeShipment EXCHANGE", () => {
    const shipment = createShipment({
      orderId: "order_456",
      customerInfo,
      articles,
      type: ShipmentType.EXCHANGE,
      relatedShipmentId: "ship_orig",
    });
    assert.equal(buildShippingCreated(shipment).typeShipment, "EXCHANGE");
  });

  it("routing key es shipping.created", () => {
    assert.equal(SHIPPING_CREATED_RK, "shipping.created");
  });
});

describe("buildShippingError", () => {
  it("mapea message->errorMessage y occurredAt === timestamp", () => {
    const msg = buildShippingError({
      orderId: "order_456",
      userId: "user_789",
      message: "El usuario no tiene una dirección de envío registrada",
    });

    assert.equal(msg.type, "SHIPPING_ERROR");
    assert.equal(msg.orderId, "order_456");
    assert.equal(msg.userId, "user_789");
    assert.equal(msg.errorMessage, "El usuario no tiene una dirección de envío registrada");
    assert.equal(msg.occurredAt, msg.timestamp);
  });

  it("routing key es shipping.error", () => {
    assert.equal(SHIPPING_ERROR_RK, "shipping.error");
  });
});
