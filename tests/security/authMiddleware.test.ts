import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { validateToken } from "../../src/security/authMiddleware.js";
import { type AuthUser, clearCache } from "../../src/security/tokenCache.js";

const user: AuthUser = {
  id: "user_789",
  name: "Juan Pérez",
  login: "jperez",
  permissions: ["admin"],
  enabled: true,
};

// Response mínima que consume validateToken (ok + json()).
function okResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}
function errorResponse(): Response {
  return { ok: false, json: async () => ({}) } as unknown as Response;
}

describe("validateToken (auth contra authgo)", () => {
  beforeEach(() => clearCache());

  it("200 de /users/current devuelve el user y lo cachea", async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return okResponse(user);
    }) as unknown as typeof fetch;

    const first = await validateToken("tok", { fetchFn, authServiceUrl: "http://auth" });
    assert.deepEqual(first, user);
    assert.equal(calls, 1);
  });

  it("dentro del TTL no re-consulta authgo (cache hit)", async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return okResponse(user);
    }) as unknown as typeof fetch;
    const explode = (async () => {
      throw new Error("no debería llamarse en cache hit");
    }) as unknown as typeof fetch;

    await validateToken("tok", { fetchFn: counting, authServiceUrl: "http://auth" });
    const second = await validateToken("tok", { fetchFn: explode, authServiceUrl: "http://auth" });

    assert.deepEqual(second, user);
    assert.equal(calls, 1);
  });

  it("respuesta no-ok (401) devuelve null", async () => {
    const fetchFn = (async () => errorResponse()) as unknown as typeof fetch;
    const result = await validateToken("tok", { fetchFn, authServiceUrl: "http://auth" });
    assert.equal(result, null);
  });

  it("fallo de red devuelve null", async () => {
    const fetchFn = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await validateToken("tok", { fetchFn, authServiceUrl: "http://auth" });
    assert.equal(result, null);
  });
});
