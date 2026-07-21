import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addressBodySchema } from "../../../src/rest/schemas/addressSchema.js";

const validBody = {
  name: "Juan Pérez",
  address: "Calle Falsa 123",
  city: "Buenos Aires",
  zipCode: "1234",
  phone: "+54 11 1234-5678",
};

describe("addressBodySchema (PUT /address)", () => {
  it("acepta un body completo", () => {
    const parsed = addressBodySchema.safeParse(validBody);
    assert.equal(parsed.success, true);
  });

  it("rechaza si falta un campo (no 500, error de validación)", () => {
    const { name, ...sinName } = validBody;
    const parsed = addressBodySchema.safeParse(sinName);
    assert.equal(parsed.success, false);
  });

  it("rechaza strings vacíos", () => {
    const parsed = addressBodySchema.safeParse({ ...validBody, city: "" });
    assert.equal(parsed.success, false);
  });
});
