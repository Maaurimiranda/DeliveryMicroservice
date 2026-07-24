import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Shipment } from "../../../src/domain/entities/shipment.js";
import { listShipments } from "../../../src/domain/services/listShipmentsUseCase.js";
import { fakeRepo, nuevoEnvio, OTRO_USUARIO, OWNER, shippingAddress } from "./fakes.js";

function envios(cantidad: number, customerId: string = OWNER): Shipment[] {
  return Array.from({ length: cantidad }, () =>
    nuevoEnvio({ ...shippingAddress, customerId })
  );
}

describe("listShipments (CU11)", () => {
  it("sin límite explícito usa el default de 50", async () => {
    const repo = fakeRepo(...envios(60));

    const { items, pagination } = await listShipments({}, { shipmentRepo: repo });

    assert.equal(pagination.limit, 50);
    assert.equal(pagination.skip, 0);
    assert.equal(items.length, 50);
    assert.equal(pagination.total, repo.store.size);
  });

  it("recorta el límite al máximo de 100", async () => {
    const repo = fakeRepo(...envios(120));

    const { items, pagination } = await listShipments({ limit: 200 }, { shipmentRepo: repo });

    assert.equal(pagination.limit, 100);
    assert.equal(items.length, Math.min(100, repo.store.size));
  });

  it("un límite o skip inválido cae a los valores por defecto", async () => {
    const repo = fakeRepo(...envios(5));

    const { pagination } = await listShipments(
      { limit: Number.NaN, skip: -10 },
      { shipmentRepo: repo }
    );

    assert.equal(pagination.limit, 50);
    assert.equal(pagination.skip, 0);
  });

  it("calcula pages a partir del total y el límite", async () => {
    const repo = fakeRepo(...envios(10));

    const { pagination } = await listShipments({ limit: 3 }, { shipmentRepo: repo });

    assert.equal(pagination.total, repo.store.size);
    assert.equal(pagination.pages, Math.ceil(repo.store.size / 3));
  });

  it("skip avanza la ventana sin cambiar el total", async () => {
    const repo = fakeRepo(...envios(10));

    const { items, pagination } = await listShipments(
      { limit: 4, skip: 8 },
      { shipmentRepo: repo }
    );

    assert.equal(pagination.skip, 8);
    assert.equal(pagination.total, repo.store.size);
    assert.equal(items.length, repo.store.size - 8);
  });

  it("con userId devuelve solo los envíos de ese usuario; sin userId (admin), todos", async () => {
    const repo = fakeRepo(...envios(3, OWNER), ...envios(2, OTRO_USUARIO));

    const propios = await listShipments({ userId: OWNER }, { shipmentRepo: repo });
    const todos = await listShipments({}, { shipmentRepo: repo });

    assert.equal(propios.pagination.total, 3);
    assert.ok(propios.items.every((s) => s.shippingAddress.customerId === OWNER));
    assert.equal(todos.pagination.total, repo.store.size);
  });
});
