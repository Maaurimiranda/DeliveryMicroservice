import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerInfoBodySchema } from "../../../src/rest/schemas/customerInfoSchema.js";

const validBody = {
  name: "Juan Pérez",
  address: "Calle Falsa 123",
  city: "Buenos Aires",
  zipCode: "1234",
  phone: "+54 11 1234-5678",
};

describe("customerInfoBodySchema (PUT /customer-info)", () => {
  it("acepta un body completo", () => {
    const parsed = customerInfoBodySchema.safeParse(validBody);
    assert.equal(parsed.success, true);
  });

  it("rechaza si falta un campo (no 500, error de validación)", () => {
    const { name, ...sinName } = validBody;
    const parsed = customerInfoBodySchema.safeParse(sinName);
    assert.equal(parsed.success, false);
  });

  it("rechaza strings vacíos", () => {
    const parsed = customerInfoBodySchema.safeParse({ ...validBody, city: "" });
    assert.equal(parsed.success, false);
  });
});
