import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Article } from "../../../src/domain/entities/article.js";
import type { CustomerInfo } from "../../../src/domain/entities/customerInfo.js";
import {
  cancel,
  completeExchange,
  completeReturn,
  createExchangeShipment,
  createShipment,
  deliver,
  linkRelatedShipment,
  prepare,
  ship,
  startExchange,
  startReturn,
  type Shipment,
} from "../../../src/domain/entities/shipment.js";
import { ShipmentStatus } from "../../../src/domain/entities/shipmentStatus.js";
import { ShipmentType } from "../../../src/domain/entities/shipmentType.js";
import {
  InvalidShipmentDataError,
  InvalidTransitionError,
} from "../../../src/domain/errors/domainErrors.js";

const customerInfo: CustomerInfo = {
  customerId: "user_456",
  name: "Juan Pérez",
  address: "Av. Siempreviva 742",
  city: "Springfield",
  zipCode: "5000",
  phone: "+54 351 555-0000",
};

const articles: readonly Article[] = [{ articleId: "art_001", quantity: 2 }];

function nuevoEnvio(): Shipment {
  return createShipment({ orderId: "order_123", customerInfo, articles });
}

function envioEn(status: ShipmentStatus): Shipment {
  let s = nuevoEnvio();
  if (status === ShipmentStatus.PENDING) return s;
  if (status === ShipmentStatus.CANCELLED) return cancel(s, "admin_user", "sin stock");

  s = prepare(s, "admin_user");
  if (status === ShipmentStatus.PREPARED) return s;

  s = ship(s, "admin_user");
  if (status === ShipmentStatus.IN_TRANSIT) return s;

  s = deliver(s, "admin_user");
  if (status === ShipmentStatus.DELIVERED) return s;

  s = startReturn(s, "user_456", "producto fallado");
  if (status === ShipmentStatus.RETURNING) return s;

  if (status === ShipmentStatus.RETURNED) return completeReturn(s, "admin_user");
  return completeExchange(linkRelatedShipment(s, "ship_cambio_test"), "admin_user");
}

describe("createShipment (CU01)", () => {
  it("nace en PENDING, tipo NORMAL y con id prefijado ship_", () => {
    const s = nuevoEnvio();

    assert.equal(s.status, ShipmentStatus.PENDING);
    assert.equal(s.type, ShipmentType.NORMAL);
    assert.match(s.id, /^ship_/);
    assert.equal(s.orderId, "order_123");
    assert.equal(s.relatedShipmentId, undefined);
  });

  it("registra la primera entrada de tracking con actor system", () => {
    const s = nuevoEnvio();

    assert.equal(s.tracking.length, 1);
    assert.equal(s.tracking[0]?.status, ShipmentStatus.PENDING);
    assert.equal(s.tracking[0]?.actor, "system");
    assert.ok(s.tracking[0]?.timestamp instanceof Date);
  });

  it("usa la descripción provista en la primera entrada de tracking (H6)", () => {
    const s = createShipment({
      orderId: "order_123",
      customerInfo,
      articles,
      description: "Envío urgente",
    });

    assert.equal(s.tracking[0]?.description, "Envío urgente");
  });

  it("usa la descripción por defecto si no se provee", () => {
    const s = nuevoEnvio();

    assert.equal(s.tracking[0]?.description, "Envío registrado, pendiente de preparación");
  });

  it("rechaza orderId vacío", () => {
    assert.throws(
      () => createShipment({ orderId: "  ", customerInfo, articles }),
      InvalidShipmentDataError
    );
  });

  it("rechaza un envío sin artículos", () => {
    assert.throws(
      () => createShipment({ orderId: "order_123", customerInfo, articles: [] }),
      InvalidShipmentDataError
    );
  });

  it("rechaza customerInfo sin customerId ni dirección", () => {
    assert.throws(
      () =>
        createShipment({
          orderId: "order_123",
          customerInfo: { ...customerInfo, customerId: "" },
          articles,
        }),
      InvalidShipmentDataError
    );
    assert.throws(
      () =>
        createShipment({
          orderId: "order_123",
          customerInfo: { ...customerInfo, address: "" },
          articles,
        }),
      InvalidShipmentDataError
    );
  });
});

describe("camino feliz PENDING → PREPARED → IN_TRANSIT → DELIVERED", () => {
  it("recorre los cuatro estados y suma un tracking por transición", () => {
    const pendiente = nuevoEnvio();
    const preparado = prepare(pendiente, "admin_user");
    const enTransito = ship(preparado, "admin_user");
    const entregado = deliver(enTransito, "admin_user");

    assert.equal(preparado.status, ShipmentStatus.PREPARED);
    assert.equal(enTransito.status, ShipmentStatus.IN_TRANSIT);
    assert.equal(entregado.status, ShipmentStatus.DELIVERED);
    assert.equal(entregado.tracking.length, 4);
    assert.deepEqual(
      entregado.tracking.map((t) => t.status),
      [
        ShipmentStatus.PENDING,
        ShipmentStatus.PREPARED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.DELIVERED,
      ]
    );
  });

  it("cada transición guarda actor y descripción, y actualiza updatedAt", () => {
    const pendiente = nuevoEnvio();
    const preparado = prepare(pendiente, "admin_user");
    const ultimo = preparado.tracking.at(-1);

    assert.equal(ultimo?.actor, "admin_user");
    assert.ok((ultimo?.description ?? "").length > 0);
    assert.ok(preparado.updatedAt.getTime() >= pendiente.updatedAt.getTime());
    assert.equal(preparado.createdAt.getTime(), pendiente.createdAt.getTime());
  });

  it("no permite saltear estados", () => {
    const pendiente = nuevoEnvio();

    assert.throws(() => ship(pendiente, "admin_user"), InvalidTransitionError);
    assert.throws(() => deliver(pendiente, "admin_user"), InvalidTransitionError);
    assert.throws(
      () => deliver(prepare(pendiente, "admin_user"), "admin_user"),
      InvalidTransitionError
    );
  });

  it("no muta el envío original", () => {
    const pendiente = nuevoEnvio();
    prepare(pendiente, "admin_user");

    assert.equal(pendiente.status, ShipmentStatus.PENDING);
    assert.equal(pendiente.tracking.length, 1);
  });
});

describe("cancelación (CU05)", () => {
  it("permite cancelar desde PENDING y desde PREPARED", () => {
    assert.equal(
      cancel(envioEn(ShipmentStatus.PENDING), "admin_user", "sin stock").status,
      ShipmentStatus.CANCELLED
    );
    assert.equal(
      cancel(envioEn(ShipmentStatus.PREPARED), "admin_user", "sin stock").status,
      ShipmentStatus.CANCELLED
    );
  });

  it("prohíbe cancelar una vez IN_TRANSIT o DELIVERED", () => {
    assert.throws(
      () => cancel(envioEn(ShipmentStatus.IN_TRANSIT), "admin_user", "arrepentido"),
      InvalidTransitionError
    );
    assert.throws(
      () => cancel(envioEn(ShipmentStatus.DELIVERED), "admin_user", "arrepentido"),
      InvalidTransitionError
    );
  });

  it("el error nombra el estado origen y el destino", () => {
    assert.throws(
      () => cancel(envioEn(ShipmentStatus.IN_TRANSIT), "admin_user", "arrepentido"),
      (err: unknown) => {
        assert.ok(err instanceof InvalidTransitionError);
        assert.equal(err.from, ShipmentStatus.IN_TRANSIT);
        assert.equal(err.to, ShipmentStatus.CANCELLED);
        assert.equal(err.code, "INVALID_TRANSITION");
        return true;
      }
    );
  });
});

describe("devolución (CU06 / CU07)", () => {
  it("solo se inicia desde DELIVERED", () => {
    assert.equal(
      startReturn(envioEn(ShipmentStatus.DELIVERED), "user_456", "fallado").status,
      ShipmentStatus.RETURNING
    );

    for (const status of [
      ShipmentStatus.PENDING,
      ShipmentStatus.PREPARED,
      ShipmentStatus.IN_TRANSIT,
    ]) {
      assert.throws(
        () => startReturn(envioEn(status), "user_456", "fallado"),
        InvalidTransitionError
      );
    }
  });

  it("se completa RETURNING → RETURNED", () => {
    assert.equal(
      completeReturn(envioEn(ShipmentStatus.RETURNING), "admin_user").status,
      ShipmentStatus.RETURNED
    );
  });

  it("no se completa si no está en RETURNING", () => {
    assert.throws(
      () => completeReturn(envioEn(ShipmentStatus.DELIVERED), "admin_user"),
      InvalidTransitionError
    );
  });
});

describe("cambio (CU08 / CU09)", () => {
  it("solo se inicia desde DELIVERED y deja el original en RETURNING", () => {
    assert.equal(
      startExchange(envioEn(ShipmentStatus.DELIVERED), "user_456", "talle equivocado").status,
      ShipmentStatus.RETURNING
    );
    assert.throws(
      () => startExchange(envioEn(ShipmentStatus.PENDING), "user_456", "talle equivocado"),
      InvalidTransitionError
    );
  });

  it("se procesa RETURNING → EXCHANGE_PROCESSED cuando el original tiene relatedShipmentId", () => {
    const original = linkRelatedShipment(envioEn(ShipmentStatus.RETURNING), "ship_nuevo");

    assert.equal(
      completeExchange(original, "admin_user").status,
      ShipmentStatus.EXCHANGE_PROCESSED
    );
  });

  it("completeExchange rechaza un envío en RETURNING sin relatedShipmentId (devolución pura)", () => {
    assert.throws(
      () => completeExchange(envioEn(ShipmentStatus.RETURNING), "admin_user"),
      (err: unknown) => {
        assert.ok(err instanceof InvalidShipmentDataError);
        assert.equal(err.field, "relatedShipmentId");
        assert.equal(err.code, "INVALID_SHIPMENT_DATA");
        return true;
      }
    );
  });

  it("completeExchange fuera de RETURNING lanza InvalidTransitionError aunque falte el vínculo", () => {
    assert.throws(
      () => completeExchange(envioEn(ShipmentStatus.DELIVERED), "admin_user"),
      InvalidTransitionError
    );
  });

  it("completeReturn permite RETURNED sobre un original de cambio (producto dañado, CU09)", () => {
    const original = startExchange(envioEn(ShipmentStatus.DELIVERED), "user_456", "talle equivocado");
    const vinculado = linkRelatedShipment(original, "ship_nuevo");

    assert.equal(completeReturn(vinculado, "admin_user").status, ShipmentStatus.RETURNED);
  });

  it("crea un segundo envío EXCHANGE en PENDING vinculado al original", () => {
    const original = envioEn(ShipmentStatus.DELIVERED);
    const cambio = createExchangeShipment(original, articles);

    assert.equal(cambio.type, ShipmentType.EXCHANGE);
    assert.equal(cambio.status, ShipmentStatus.PENDING);
    assert.equal(cambio.relatedShipmentId, original.id);
    assert.equal(cambio.orderId, original.orderId);
    assert.notEqual(cambio.id, original.id);
  });

  it("vincula el original con el envío de cambio", () => {
    const original = envioEn(ShipmentStatus.DELIVERED);
    const cambio = createExchangeShipment(original, articles);
    const vinculado = linkRelatedShipment(original, cambio.id);

    assert.equal(vinculado.relatedShipmentId, cambio.id);
    assert.equal(original.relatedShipmentId, undefined);
  });

  it("el envío de cambio sigue el camino normal desde PENDING", () => {
    const original = envioEn(ShipmentStatus.DELIVERED);
    const cambio = createExchangeShipment(original, articles);

    assert.equal(prepare(cambio, "admin_user").status, ShipmentStatus.PREPARED);
  });
});

describe("estados finales", () => {
  const finales = [
    ShipmentStatus.CANCELLED,
    ShipmentStatus.RETURNED,
    ShipmentStatus.EXCHANGE_PROCESSED,
  ];

  for (const status of finales) {
    it(`${status} no acepta ninguna transición`, () => {
      const s = envioEn(status);

      assert.throws(() => prepare(s, "admin_user"), InvalidTransitionError);
      assert.throws(() => ship(s, "admin_user"), InvalidTransitionError);
      assert.throws(() => deliver(s, "admin_user"), InvalidTransitionError);
      assert.throws(() => cancel(s, "admin_user", "x"), InvalidTransitionError);
      assert.throws(() => startReturn(s, "admin_user", "x"), InvalidTransitionError);
      assert.throws(() => completeReturn(s, "admin_user"), InvalidTransitionError);
      assert.throws(() => completeExchange(s, "admin_user"), InvalidTransitionError);
    });
  }
});
