import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import {
  InvalidTransitionError,
  ShipmentNotFoundError,
} from "../../../src/domain/errors/domainErrors.js";
import { prepareShipment } from "../../../src/domain/services/prepareShipmentUseCase.js";
import { envioEn, fakePublisher, fakeRepo, nuevoEnvio, totalEventos } from "./fakes.js";

describe("prepareShipment (CU02)", () => {
  it("pasa PENDING → PREPARED, persiste y publica shippingStateChanged", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const preparado = await prepareShipment(
      { shipmentId: envio.id, actor: "admin_user", correlationId: "corr_1" },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(preparado.status, ShipmentStatus.PREPARED);
    assert.deepEqual(repo.updated, [preparado]);
    assert.equal(publisher.events.stateChanged.length, 1);
    assert.equal(publisher.events.stateChanged[0]!.previousStatus, ShipmentStatus.PENDING);
    assert.equal(publisher.events.stateChanged[0]!.correlationId, "corr_1");
  });

  it("usa la description del body en la entrada de tracking", async () => {
    const envio = nuevoEnvio();
    const repo = fakeRepo(envio);

    const preparado = await prepareShipment(
      {
        shipmentId: envio.id,
        actor: "admin_user",
        correlationId: "corr_1",
        description: "Paquete verificado",
      },
      { shipmentRepo: repo, publisher: fakePublisher() }
    );

    assert.equal(preparado.tracking.at(-1)!.description, "Paquete verificado");
  });

  it("envío inexistente lanza ShipmentNotFoundError sin persistir ni publicar", async () => {
    const repo = fakeRepo();
    const publisher = fakePublisher();

    await assert.rejects(
      prepareShipment(
        { shipmentId: "ship_no_existe", actor: "admin_user", correlationId: "corr_1" },
        { shipmentRepo: repo, publisher }
      ),
      ShipmentNotFoundError
    );
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });

  it("desde IN_TRANSIT lanza InvalidTransitionError sin persistir ni publicar", async () => {
    const envio = envioEn(ShipmentStatus.IN_TRANSIT);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      prepareShipment(
        { shipmentId: envio.id, actor: "admin_user", correlationId: "corr_1" },
        { shipmentRepo: repo, publisher }
      ),
      InvalidTransitionError
    );
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });
});
