import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentNotFoundError } from "../../../src/domain/errors/domainErrors.js";
import { getShipment } from "../../../src/domain/services/getShipmentUseCase.js";
import { fakeRepo, nuevoEnvio, OTRO_USUARIO, OWNER } from "./fakes.js";

describe("getShipment (CU10)", () => {
  it("el dueño obtiene su envío", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);

    const encontrado = await getShipment(
      { shipmentId: envio.id, requesterId: OWNER },
      { shipmentRepo: repo }
    );

    assert.equal(encontrado.id, envio.id);
  });

  it("sin requesterId (admin o tracking público) devuelve cualquier envío", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);

    const encontrado = await getShipment({ shipmentId: envio.id }, { shipmentRepo: repo });

    assert.equal(encontrado.id, envio.id);
  });

  it("un envío ajeno se reporta como inexistente (anti-IDOR: 404, no 403)", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);

    await assert.rejects(
      getShipment({ shipmentId: envio.id, requesterId: OTRO_USUARIO }, { shipmentRepo: repo }),
      ShipmentNotFoundError
    );
  });

  it("un id inexistente lanza el mismo error que un envío ajeno", async () => {
    const repo = fakeRepo();

    await assert.rejects(
      getShipment({ shipmentId: "ship_no_existe", requesterId: OWNER }, { shipmentRepo: repo }),
      ShipmentNotFoundError
    );
  });
});
