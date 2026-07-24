import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { InvalidTransitionError } from "../../../src/domain/errors/domainErrors.js";
import { completeReturnOfShipment } from "../../../src/domain/services/completeReturnUseCase.js";
import { envioEn, fakePublisher, fakeRepo, totalEventos } from "./fakes.js";

describe("completeReturnOfShipment (CU07)", () => {
  it("pasa RETURNING → RETURNED y publica returnCompleted con la condición", async () => {
    const envio = envioEn(ShipmentStatus.RETURNING);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const devuelto = await completeReturnOfShipment(
      {
        shipmentId: envio.id,
        actor: "admin_user",
        productCondition: "good",
        correlationId: "corr_6",
      },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(devuelto.status, ShipmentStatus.RETURNED);
    assert.deepEqual(repo.updated, [devuelto]);
    assert.equal(publisher.events.returnCompleted[0]!.productCondition, "good");
    assert.equal(publisher.events.returnCompleted[0]!.correlationId, "corr_6");
  });

  it("la description recibida reemplaza el texto de tracking por defecto", async () => {
    const envio = envioEn(ShipmentStatus.RETURNING);
    const repo = fakeRepo(envio);

    const devuelto = await completeReturnOfShipment(
      {
        shipmentId: envio.id,
        actor: "admin_user",
        productCondition: "defective",
        correlationId: "corr_6",
        description: "Devolución completada: faltaba el manual",
      },
      { shipmentRepo: repo, publisher: fakePublisher() }
    );

    assert.equal(
      devuelto.tracking.at(-1)!.description,
      "Devolución completada: faltaba el manual"
    );
  });

  it("no se puede completar una devolución que no está en RETURNING", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      completeReturnOfShipment(
        {
          shipmentId: envio.id,
          actor: "admin_user",
          productCondition: "good",
          correlationId: "corr_6",
        },
        { shipmentRepo: repo, publisher }
      ),
      InvalidTransitionError
    );
    assert.equal(totalEventos(publisher.events), 0);
  });
});
