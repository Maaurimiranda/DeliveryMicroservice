import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { InvalidShipmentDataError } from "../../../src/domain/errors/domainErrors.js";
import { completeExchangeOfShipment } from "../../../src/domain/services/completeExchangeUseCase.js";
import { startExchangeOfShipment } from "../../../src/domain/services/startExchangeUseCase.js";
import { envioEn, fakePublisher, fakeRepo, type FakeRepo, OWNER, totalEventos } from "./fakes.js";

// Arma el estado de partida real de CU09: un cambio ya iniciado, con los dos envíos vinculados.
async function cambioIniciado(): Promise<{
  repo: FakeRepo;
  originalId: string;
  newId: string;
}> {
  const envio = envioEn(ShipmentStatus.DELIVERED);
  const repo = fakeRepo(envio);
  const { originalShipment, newShipment } = await startExchangeOfShipment(
    {
      shipmentId: envio.id,
      actor: OWNER,
      reason: "talle",
      correlationId: "corr_ini",
      requesterId: OWNER,
    },
    { shipmentRepo: repo, publisher: fakePublisher() }
  );

  repo.saved.length = 0;
  repo.updated.length = 0;
  return { repo, originalId: originalShipment.id, newId: newShipment.id };
}

describe("completeExchangeOfShipment (CU09)", () => {
  for (const condition of ["good", "defective"] as const) {
    it(`con productCondition "${condition}" el cambio procede: original EXCHANGE_PROCESSED, nuevo PREPARED`, async () => {
      const { repo, originalId, newId } = await cambioIniciado();
      const publisher = fakePublisher();

      const { originalShipment, newShipment } = await completeExchangeOfShipment(
        {
          originalShipmentId: originalId,
          newShipmentId: newId,
          actor: "admin_user",
          productCondition: condition,
          correlationId: "corr_8",
        },
        { shipmentRepo: repo, publisher }
      );

      assert.equal(originalShipment.status, ShipmentStatus.EXCHANGE_PROCESSED);
      assert.equal(newShipment.status, ShipmentStatus.PREPARED);
      assert.equal(publisher.events.exchangeFinalized[0]!.productCondition, condition);
      assert.equal(publisher.events.exchangeFinalized[0]!.correlationId, "corr_8");
    });
  }

  it('con "damaged" el cambio se rechaza: original RETURNED, nuevo CANCELLED', async () => {
    const { repo, originalId, newId } = await cambioIniciado();
    const publisher = fakePublisher();

    const { originalShipment, newShipment } = await completeExchangeOfShipment(
      {
        originalShipmentId: originalId,
        newShipmentId: newId,
        actor: "admin_user",
        productCondition: "damaged",
        correlationId: "corr_8",
      },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(originalShipment.status, ShipmentStatus.RETURNED);
    assert.equal(newShipment.status, ShipmentStatus.CANCELLED);
    assert.equal(publisher.events.exchangeFinalized[0]!.productCondition, "damaged");
  });

  it("persiste los dos envíos con update", async () => {
    const { repo, originalId, newId } = await cambioIniciado();

    const { originalShipment, newShipment } = await completeExchangeOfShipment(
      {
        originalShipmentId: originalId,
        newShipmentId: newId,
        actor: "admin_user",
        productCondition: "good",
        correlationId: "corr_8",
      },
      { shipmentRepo: repo, publisher: fakePublisher() }
    );

    assert.deepEqual(repo.updated, [originalShipment, newShipment]);
  });

  it("rechaza dos envíos que no son las puntas del mismo cambio", async () => {
    const { repo, originalId } = await cambioIniciado();
    const ajeno = envioEn(ShipmentStatus.PENDING);
    await repo.save(ajeno);
    repo.saved.length = 0;
    repo.updated.length = 0;
    const publisher = fakePublisher();

    await assert.rejects(
      completeExchangeOfShipment(
        {
          originalShipmentId: originalId,
          newShipmentId: ajeno.id,
          actor: "admin_user",
          productCondition: "good",
          correlationId: "corr_8",
        },
        { shipmentRepo: repo, publisher }
      ),
      InvalidShipmentDataError
    );
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });
});
