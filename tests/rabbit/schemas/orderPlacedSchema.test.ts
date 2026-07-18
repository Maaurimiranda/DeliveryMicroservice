import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderPlacedEnvelopeSchema } from "../../../src/rabbit/schemas/orderPlacedSchema.js";

const validEnvelope = {
  correlation_id: "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  message: {
    orderId: "order_456",
    cartId: "cart_123",
    userId: "user_789",
    articles: [{ articleId: "art_001", quantity: 2 }],
  },
};

describe("orderPlacedEnvelopeSchema", () => {
  it("acepta un envelope válido", () => {
    assert.equal(orderPlacedEnvelopeSchema.safeParse(validEnvelope).success, true);
  });

  it("acepta sin correlation_id (el consumer genera uno)", () => {
    const { correlation_id, ...noCorr } = validEnvelope;
    void correlation_id;
    assert.equal(orderPlacedEnvelopeSchema.safeParse(noCorr).success, true);
  });

  it("rechaza message con orderId vacío", () => {
    const bad = { ...validEnvelope, message: { ...validEnvelope.message, orderId: "" } };
    assert.equal(orderPlacedEnvelopeSchema.safeParse(bad).success, false);
  });

  it("rechaza articles vacío", () => {
    const bad = { ...validEnvelope, message: { ...validEnvelope.message, articles: [] } };
    assert.equal(orderPlacedEnvelopeSchema.safeParse(bad).success, false);
  });

  it("rechaza quantity no positiva", () => {
    const bad = {
      ...validEnvelope,
      message: { ...validEnvelope.message, articles: [{ articleId: "art_001", quantity: 0 }] },
    };
    assert.equal(orderPlacedEnvelopeSchema.safeParse(bad).success, false);
  });
});
