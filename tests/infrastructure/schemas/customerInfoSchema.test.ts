import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCustomerInfo,
  type CustomerInfo,
} from "../../../src/domain/entities/customerInfo.js";
import { toDocument, toDomain } from "../../../src/infrastructure/schemas/customerInfoSchema.js";

function makeCustomerInfo(): CustomerInfo {
  return createCustomerInfo({
    userId: "user_456",
    name: "Juan Pérez",
    address: "Av. Siempreviva 742",
    city: "Springfield",
    zipCode: "1234",
    phone: "+54 11 5555-5555",
  });
}

describe("customerInfoSchema mappers", () => {
  it("toDocument usa userId como _id y no deja campo userId", () => {
    const info = makeCustomerInfo();
    const doc = toDocument(info);

    assert.equal(doc._id, info.userId);
    assert.equal("userId" in doc, false);
  });

  it("toDomain(toDocument(x)) reconstruye una CustomerInfo equivalente (round-trip)", () => {
    const info = makeCustomerInfo();
    const back = toDomain(toDocument(info));

    assert.deepEqual(back, info);
  });

  it("updatedAt sobrevive el round-trip como Date", () => {
    const info = makeCustomerInfo();
    const back = toDomain(toDocument(info));

    assert.ok(back.updatedAt instanceof Date);
    assert.equal(back.updatedAt.getTime(), info.updatedAt.getTime());
  });
});
