import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomerInfo } from "../../../src/domain/entities/customerInfo.js";
import { createShipment, type Shipment } from "../../../src/domain/entities/shipment.js";
import { ShipmentType } from "../../../src/domain/entities/shipmentType.js";
import { toDocument, toDomain } from "../../../src/infrastructure/schemas/shipmentSchema.js";

const customerInfo: CustomerInfo = {
  customerId: "user_456",
  name: "Juan Pérez",
  address: "Av. Siempreviva 742",
  city: "Springfield",
  zipCode: "1234",
  phone: "+54 11 5555-5555",
};

function makeShipment(overrides: Partial<Parameters<typeof createShipment>[0]> = {}): Shipment {
  return createShipment({
    orderId: "order_123",
    customerInfo,
    articles: [{ articleId: "art_1", quantity: 2 }],
    ...overrides,
  });
}

describe("shipmentSchema mappers", () => {
  it("toDocument usa el id de dominio como _id y no deja campo id", () => {
    const shipment = makeShipment();
    const doc = toDocument(shipment);

    assert.equal(doc._id, shipment.id);
    assert.equal(shipment.id.startsWith("ship_"), true);
    assert.equal("id" in doc, false);
  });

  it("toDomain(toDocument(x)) reconstruye un Shipment equivalente (round-trip)", () => {
    const shipment = makeShipment();
    const back = toDomain(toDocument(shipment));

    assert.deepEqual(back, shipment);
  });

  it("las fechas sobreviven el round-trip como Date (incluye tracking[].timestamp)", () => {
    const shipment = makeShipment();
    const back = toDomain(toDocument(shipment));

    assert.ok(back.createdAt instanceof Date);
    assert.ok(back.updatedAt instanceof Date);
    assert.ok(back.tracking[0].timestamp instanceof Date);
    assert.equal(back.createdAt.getTime(), shipment.createdAt.getTime());
  });

  it("relatedShipmentId ausente: el mapper no inventa la clave (spread puro)", () => {
    // createShipment siempre setea la clave (undefined si falta), así que la quitamos
    // para probar el camino de ausencia real a través de los mappers.
    const { relatedShipmentId, ...withoutKey } = makeShipment();
    void relatedShipmentId;
    const shipment = withoutKey as Shipment;
    assert.equal("relatedShipmentId" in shipment, false);

    const doc = toDocument(shipment);
    assert.equal("relatedShipmentId" in doc, false);

    const back = toDomain(doc);
    assert.equal("relatedShipmentId" in back, false);
  });

  it("relatedShipmentId presente se preserva en el round-trip", () => {
    const shipment = makeShipment({
      type: ShipmentType.EXCHANGE,
      relatedShipmentId: "ship_original_1",
    });
    const back = toDomain(toDocument(shipment));

    assert.equal(back.relatedShipmentId, "ship_original_1");
    assert.equal(back.type, ShipmentType.EXCHANGE);
  });
});
