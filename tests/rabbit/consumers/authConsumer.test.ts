import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLogoutToken } from "../../../src/rabbit/consumers/authConsumer.js";

describe("parseLogoutToken (logout fanout auth)", () => {
  it("sobre { correlation_id, message: 'Bearer ey...' } → token sin prefijo", () => {
    const raw = JSON.stringify({ correlation_id: "c1", message: "Bearer eyABC" });
    assert.equal(parseLogoutToken(raw), "eyABC");
  });

  it("string plano 'Bearer ey...' → token sin prefijo", () => {
    assert.equal(parseLogoutToken("Bearer eyABC"), "eyABC");
  });

  it("string JSON-encodeado '\"Bearer ey...\"' → token sin prefijo", () => {
    assert.equal(parseLogoutToken(JSON.stringify("Bearer eyABC")), "eyABC");
  });

  it("token sin prefijo Bearer se acepta igual", () => {
    assert.equal(parseLogoutToken("eyABC"), "eyABC");
  });

  it("vacío → null", () => {
    assert.equal(parseLogoutToken(""), null);
    assert.equal(parseLogoutToken("Bearer "), null);
  });

  it("message no-string → null", () => {
    const raw = JSON.stringify({ correlation_id: "c1", message: 123 });
    assert.equal(parseLogoutToken(raw), null);
  });
});
