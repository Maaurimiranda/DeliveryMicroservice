import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEnvelope } from "../../src/rabbit/publisher.js";

describe("buildEnvelope", () => {
  it("envuelve el message y preserva el correlation_id entrante", () => {
    const message = { type: "SHIPPING_CREATED", orderId: "order_456" };
    const envelope = buildEnvelope(message, "corr-123");

    assert.equal(envelope.correlation_id, "corr-123");
    assert.deepEqual(envelope.message, message);
  });

  it("usa el correlation_id tal cual se le pasa (no genera uno)", () => {
    const envelope = buildEnvelope({ a: 1 }, "fixed-id");
    assert.equal(envelope.correlation_id, "fixed-id");
  });
});
