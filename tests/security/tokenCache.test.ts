import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  type AuthUser,
  clearCache,
  getCachedUser,
  invalidate,
  setCachedUser,
} from "../../src/security/tokenCache.js";

const user: AuthUser = {
  id: "user_789",
  name: "Juan Pérez",
  login: "jperez",
  permissions: ["user"],
  enabled: true,
};

describe("tokenCache", () => {
  beforeEach(() => clearCache());

  it("hit dentro del TTL devuelve el user", () => {
    setCachedUser("tok", user);
    assert.deepEqual(getCachedUser("tok"), user);
  });

  it("miss cuando la entrada expiró (TTL vencido)", () => {
    setCachedUser("tok", user, -1);
    assert.equal(getCachedUser("tok"), null);
  });

  it("miss cuando el token no está cacheado", () => {
    assert.equal(getCachedUser("desconocido"), null);
  });

  it("invalidate remueve la entrada (simula logout)", () => {
    setCachedUser("tok", user);
    invalidate("tok");
    assert.equal(getCachedUser("tok"), null);
  });
});
