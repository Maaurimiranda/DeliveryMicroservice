import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomerInfo } from "../../../src/domain/entities/customerInfo.js";
import type { Shipment } from "../../../src/domain/entities/shipment.js";
import type { CustomerInfoRepository } from "../../../src/domain/repositories/customerInfoRepository.js";
import type { ShipmentRepository } from "../../../src/domain/repositories/shipmentRepository.js";
import type {
  ShippingErrorInfo,
  ShippingEventPublisher,
} from "../../../src/domain/services/shippingEventPublisher.js";
import {
  createShipmentFromOrder,
  type CreateShipmentFromOrderCommand,
} from "../../../src/domain/services/createShipmentFromOrderUseCase.js";

const customerInfo: CustomerInfo = {
  userId: "user_789",
  name: "Juan Pérez",
  address: "Calle Falsa 123",
  city: "Buenos Aires",
  zipCode: "1234",
  phone: "+54 11 1234-5678",
  updatedAt: new Date(),
};

const command: CreateShipmentFromOrderCommand = {
  orderId: "order_456",
  userId: "user_789",
  articles: [{ articleId: "art_001", quantity: 2 }],
  correlationId: "corr_123",
};

function fakeCustomerInfoRepo(result: CustomerInfo | null): CustomerInfoRepository {
  return {
    async findByUserId() {
      return result;
    },
    async save() {},
  };
}

type SaveBehavior = "ok" | { throw: unknown };

function fakeShipmentRepo(saved: Shipment[], behavior: SaveBehavior = "ok"): ShipmentRepository {
  return {
    async save(shipment) {
      if (behavior !== "ok") throw behavior.throw;
      saved.push(shipment);
    },
    async findById() {
      return null;
    },
    async findAll() {
      return [];
    },
    async count() {
      return saved.length;
    },
    async update() {},
  };
}

type PublisherCalls = {
  created: { shipment: Shipment; correlationId: string }[];
  errors: { info: ShippingErrorInfo; correlationId: string }[];
};

function emptyCalls(): PublisherCalls {
  return { created: [], errors: [] };
}

function fakePublisher(calls: PublisherCalls): ShippingEventPublisher {
  return {
    async shippingCreated(shipment, correlationId) {
      calls.created.push({ shipment, correlationId });
    },
    async shippingError(info, correlationId) {
      calls.errors.push({ info, correlationId });
    },
    // CU01 solo usa shippingCreated/shippingError; el resto son no-ops para el fake.
    async shippingStateChanged() {},
    async shippingDelivered() {},
    async shippingCancelled() {},
    async returnInitiated() {},
    async returnCompleted() {},
    async exchangeInitiated() {},
    async exchangeFinalized() {},
  };
}

describe("createShipmentFromOrder (CU01)", () => {
  it("crea el envío en PENDING con snapshot de dirección y publica shippingCreated", async () => {
    const saved: Shipment[] = [];
    const calls = emptyCalls();

    const outcome = await createShipmentFromOrder(command, {
      customerInfoRepo: fakeCustomerInfoRepo(customerInfo),
      shipmentRepo: fakeShipmentRepo(saved),
      publisher: fakePublisher(calls),
    });

    assert.equal(outcome.kind, "created");
    assert.equal(saved.length, 1);

    const shipment = saved[0];
    assert.equal(shipment.status, "PENDING");
    assert.equal(shipment.tracking.length, 1);
    assert.equal(shipment.orderId, "order_456");
    // Snapshot inmutable copiado de CustomerInfo.
    assert.equal(shipment.shippingAddress.customerId, "user_789");
    assert.equal(shipment.shippingAddress.name, "Juan Pérez");
    assert.equal(shipment.shippingAddress.address, "Calle Falsa 123");

    assert.equal(calls.errors.length, 0);
    assert.equal(calls.created.length, 1);
    assert.equal(calls.created[0].shipment, shipment);
    // correlation_id se preserva punta a punta.
    assert.equal(calls.created[0].correlationId, "corr_123");
    if (outcome.kind === "created") assert.equal(outcome.shipmentId, shipment.id);
  });

  it("usuario sin dirección: publica shippingError, no guarda ni publica created", async () => {
    const saved: Shipment[] = [];
    const calls = emptyCalls();

    const outcome = await createShipmentFromOrder(command, {
      customerInfoRepo: fakeCustomerInfoRepo(null),
      shipmentRepo: fakeShipmentRepo(saved),
      publisher: fakePublisher(calls),
    });

    assert.equal(outcome.kind, "no_address");
    assert.equal(saved.length, 0);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.errors.length, 1);
    assert.deepEqual(calls.errors[0].info, {
      orderId: "order_456",
      userId: "user_789",
      message: "El usuario no tiene una dirección de envío registrada",
    });
    assert.equal(calls.errors[0].correlationId, "corr_123");
  });

  it("duplicado (clave duplicada 11000): outcome duplicate, sin eventos", async () => {
    const calls = emptyCalls();

    const outcome = await createShipmentFromOrder(command, {
      customerInfoRepo: fakeCustomerInfoRepo(customerInfo),
      shipmentRepo: fakeShipmentRepo([], { throw: { code: 11000 } }),
      publisher: fakePublisher(calls),
    });

    assert.equal(outcome.kind, "duplicate");
    assert.equal(calls.created.length, 0);
    assert.equal(calls.errors.length, 0);
  });

  it("error inesperado en save: relanza y no publica eventos", async () => {
    const calls = emptyCalls();

    await assert.rejects(
      createShipmentFromOrder(command, {
        customerInfoRepo: fakeCustomerInfoRepo(customerInfo),
        shipmentRepo: fakeShipmentRepo([], { throw: new Error("mongo caído") }),
        publisher: fakePublisher(calls),
      }),
      /mongo caído/
    );

    assert.equal(calls.created.length, 0);
    assert.equal(calls.errors.length, 0);
  });
});
