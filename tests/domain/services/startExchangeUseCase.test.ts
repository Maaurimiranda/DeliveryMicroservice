import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { ShipmentType } from "../../../src/domain/entities/shipmentType.js";
import { ShipmentNotFoundError } from "../../../src/domain/errors/domainErrors.js";
import { startExchangeOfShipment } from "../../../src/domain/services/startExchangeUseCase.js";
import {
  envioEn,
  fakePublisher,
  fakeRepo,
  OTRO_USUARIO,
  OWNER,
  totalEventos,
} from "./fakes.js";

describe("startExchangeOfShipment (CU08)", () => {
  it("deja el original en RETURNING y crea un segundo envío EXCHANGE en PENDING", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const { originalShipment, newShipment } = await startExchangeOfShipment(
      {
        shipmentId: envio.id,
        actor: OWNER,
        reason: "Cambio de talle: necesito talle 39",
        correlationId: "corr_7",
        requesterId: OWNER,
      },
      { shipmentRepo: repo, publisher }
    );

    assert.equal(originalShipment.status, ShipmentStatus.RETURNING);
    assert.equal(newShipment.status, ShipmentStatus.PENDING);
    assert.equal(newShipment.type, ShipmentType.EXCHANGE);
    assert.equal(
      originalShipment.tracking.at(-1)!.description,
      "Cambio iniciado: Cambio de talle: necesito talle 39"
    );
  });

  it("vincula los dos envíos en ambas direcciones", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);

    const { originalShipment, newShipment } = await startExchangeOfShipment(
      {
        shipmentId: envio.id,
        actor: OWNER,
        reason: "talle",
        correlationId: "corr_7",
        requesterId: OWNER,
      },
      { shipmentRepo: repo, publisher: fakePublisher() }
    );

    assert.equal(originalShipment.relatedShipmentId, newShipment.id);
    assert.equal(newShipment.relatedShipmentId, originalShipment.id);
  });

  it("el envío de cambio reusa artículos y snapshot de dirección del original", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);

    const { newShipment } = await startExchangeOfShipment(
      {
        shipmentId: envio.id,
        actor: OWNER,
        reason: "talle",
        correlationId: "corr_7",
        requesterId: OWNER,
      },
      { shipmentRepo: repo, publisher: fakePublisher() }
    );

    assert.deepEqual(newShipment.articles, envio.articles);
    assert.deepEqual(newShipment.shippingAddress, envio.shippingAddress);
    assert.equal(newShipment.orderId, envio.orderId);
  });

  it("persiste el nuevo con save y el original con update, y publica exchangeInitiated", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    const { originalShipment, newShipment } = await startExchangeOfShipment(
      {
        shipmentId: envio.id,
        actor: OWNER,
        reason: "talle",
        correlationId: "corr_7",
        requesterId: OWNER,
      },
      { shipmentRepo: repo, publisher }
    );

    assert.deepEqual(repo.saved, [newShipment]);
    assert.deepEqual(repo.updated, [originalShipment]);
    assert.equal(publisher.events.exchangeInitiated.length, 1);
    assert.equal(publisher.events.exchangeInitiated[0]!.correlationId, "corr_7");
  });

  it("un envío ajeno se reporta como inexistente y no crea nada", async () => {
    const envio = envioEn(ShipmentStatus.DELIVERED);
    const repo = fakeRepo(envio);
    const publisher = fakePublisher();

    await assert.rejects(
      startExchangeOfShipment(
        {
          shipmentId: envio.id,
          actor: OTRO_USUARIO,
          reason: "talle",
          correlationId: "corr_7",
          requesterId: OTRO_USUARIO,
        },
        { shipmentRepo: repo, publisher }
      ),
      ShipmentNotFoundError
    );
    assert.equal(repo.saved.length, 0);
    assert.equal(repo.updated.length, 0);
    assert.equal(totalEventos(publisher.events), 0);
  });
});
