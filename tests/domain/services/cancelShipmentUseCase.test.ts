import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { InvalidTransitionError } from "../../../src/domain/errors/domainErrors.js";
import { cancelShipment } from "../../../src/domain/services/cancelShipmentUseCase.js";
import { envioEn, fakePublisher, fakeRepo, nuevoEnvio, totalEventos } from "./fakes.js";

describe("cancelShipment (CU05)", () => {
  it("cancela desde PENDING y publica shippingCancelled con el motivo", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const cancelado = await cancelShipment(
      {
        shipmentId: envio.id,
        actor: "admin_user",
        reason: "sin stock",
        correlationId: "corr_4",
      },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(cancelado.status, ShipmentStatus.CANCELLED);
    assert.deepEqual(repo.updated, [cancelado]);
    assert.equal(publisher.events.cancelled[0]!.reason, "sin stock");
    assert.equal(cancelado.tracking.at(-1)!.description, "Envío cancelado: sin stock");
  });

  it("cancela desde PREPARED", async () => {
    const envio = envioEn(ShipmentStatus.PREPARED);
    const repo = fakeRepo(envio);

    const cancelado = await cancelShipment(
      { shipmentId: envio.id, actor: "admin_user", reason: "cliente arrepentido", correlationId: "c" },
      { shipmentRepo: repo, publisher: fakePublisher() }
    );

    assert.equal(cancelado.status, ShipmentStatus.CANCELLED);
  });

  it("una vez IN_TRANSIT ya no se puede cancelar", async () => {
    const envio = envioEn(ShipmentStatus.IN_TRANSIT);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      cancelShipment(
        { shipmentId: envio.id, actor: "admin_user", reason: "tarde", correlationId: "corr_4" },
        { shipmentRepo: repo, publisher }
      ),
      InvalidTransitionError
    );
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });
});
