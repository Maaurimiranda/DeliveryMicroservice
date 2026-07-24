import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { InvalidTransitionError } from "../../../src/domain/errors/domainErrors.js";
import { shipShipment } from "../../../src/domain/services/shipShipmentUseCase.js";
import { envioEn, fakePublisher, fakeRepo, nuevoEnvio, totalEventos } from "./fakes.js";

describe("shipShipment (CU03)", () => {
  it("pasa PREPARED → IN_TRANSIT y publica shippingStateChanged con el estado previo", async () => {
    const envio = envioEn(ShipmentStatus.PREPARED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const enCamino = await shipShipment(
      { shipmentId: envio.id, actor: "admin_user", correlationId: "corr_2" },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(enCamino.status, ShipmentStatus.IN_TRANSIT);
    assert.deepEqual(repo.updated, [enCamino]);
    assert.equal(publisher.events.stateChanged[0]!.previousStatus, ShipmentStatus.PREPARED);
    assert.equal(publisher.events.stateChanged[0]!.correlationId, "corr_2");
  });

  it("desde PENDING no se puede saltear a IN_TRANSIT", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      shipShipment(
        { shipmentId: envio.id, actor: "admin_user", correlationId: "corr_2" },
        { shipmentRepo: repo, publisher }
      ),
      InvalidTransitionError
    );
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });
});
