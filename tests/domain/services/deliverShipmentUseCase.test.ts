import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { InvalidTransitionError } from "../../../src/domain/errors/domainErrors.js";
import { deliverShipment } from "../../../src/domain/services/deliverShipmentUseCase.js";
import { envioEn, fakePublisher, fakeRepo, totalEventos } from "./fakes.js";

describe("deliverShipment (CU04)", () => {
  it("pasa IN_TRANSIT → DELIVERED y publica shippingDelivered", async () => {
    const envio = envioEn(ShipmentStatus.IN_TRANSIT);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const entregado = await deliverShipment(
      { shipmentId: envio.id, actor: "admin_user", correlationId: "corr_3" },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(entregado.status, ShipmentStatus.DELIVERED);
    assert.deepEqual(repo.updated, [entregado]);
    assert.equal(publisher.events.delivered.length, 1);
    assert.equal(publisher.events.delivered[0]!.correlationId, "corr_3");
    assert.equal(publisher.events.stateChanged.length, 0);
  });

  it("desde PREPARED no se puede entregar", async () => {
    const envio = envioEn(ShipmentStatus.PREPARED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      deliverShipment(
        { shipmentId: envio.id, actor: "admin_user", correlationId: "corr_3" },
        { shipmentRepo: repo, publisher }
      ),
      InvalidTransitionError
    );
    assert.equal(totalEventos(publisher.events), 0);
  });
});
