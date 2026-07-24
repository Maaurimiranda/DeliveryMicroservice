import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import {
  InvalidTransitionError,
  ShipmentNotFoundError,
} from "../../../src/domain/errors/domainErrors.js";
import { startReturnOfShipment } from "../../../src/domain/services/startReturnUseCase.js";
import {
  envioEn,
  fakePublisher,
  fakeRepo,
  OTRO_USUARIO,
  OWNER,
  totalEventos,
} from "./fakes.js";

describe("startReturnOfShipment (CU06)", () => {
  it("pasa DELIVERED → RETURNING y publica returnInitiated con el motivo", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const devolviendo = await startReturnOfShipment(
      {
        shipmentId: envio.id,
        actor: OWNER,
        reason: "producto defectuoso",
        correlationId: "corr_5",
        requesterId: OWNER,
      },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(devolviendo.status, ShipmentStatus.RETURNING);
    assert.deepEqual(repo.updated, [devolviendo]);
    assert.equal(publisher.events.returnInitiated[0]!.reason, "producto defectuoso");
    assert.equal(publisher.events.returnInitiated[0]!.correlationId, "corr_5");
  });

  it("un envío ajeno se reporta como inexistente (404, no 403)", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      startReturnOfShipment(
        {
          shipmentId: envio.id,
          actor: OTRO_USUARIO,
          reason: "no es mío",
          correlationId: "corr_5",
          requesterId: OTRO_USUARIO,
        },
        { shipmentRepo: repo, publisher }
      ),
      ShipmentNotFoundError
    );
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });

  it("no se puede devolver un envío que todavía no fue entregado", async () => {
    const envio = envioEn(ShipmentStatus.IN_TRANSIT);
    const repo = fakeRepo(envio);

    await assert.rejects(
      startReturnOfShipment(
        {
          shipmentId: envio.id,
          actor: OWNER,
          reason: "me arrepentí",
          correlationId: "corr_5",
          requesterId: OWNER,
        },
        { shipmentRepo: repo, publisher: fakePublisher() }
      ),
      InvalidTransitionError
    );
  });
});
