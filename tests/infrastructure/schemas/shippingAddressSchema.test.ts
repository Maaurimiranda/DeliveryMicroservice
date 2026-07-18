import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createShippingAddress,
  type ShippingAddress,
} from "../../../src/domain/entities/shippingAddress.js";
import {
  toDocument,
  toDomain,
} from "../../../src/infrastructure/schemas/shippingAddressSchema.js";

function makeAddress(): ShippingAddress {
  return createShippingAddress({
    userId: "user_456",
    name: "Juan Pérez",
    address: "Av. Siempreviva 742",
    city: "Springfield",
    zipCode: "1234",
    phone: "+54 11 5555-5555",
  });
}

describe("shippingAddressSchema mappers", () => {
  it("toDocument usa userId como _id y no deja campo userId", () => {
    const address = makeAddress();
    const doc = toDocument(address);

    assert.equal(doc._id, address.userId);
    assert.equal("userId" in doc, false);
  });

  it("toDomain(toDocument(x)) reconstruye una ShippingAddress equivalente (round-trip)", () => {
    const address = makeAddress();
    const back = toDomain(toDocument(address));

    assert.deepEqual(back, address);
  });

  it("updatedAt sobrevive el round-trip como Date", () => {
    const address = makeAddress();
    const back = toDomain(toDocument(address));

    assert.ok(back.updatedAt instanceof Date);
    assert.equal(back.updatedAt.getTime(), address.updatedAt.getTime());
  });
});
