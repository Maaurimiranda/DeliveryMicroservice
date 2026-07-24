import type { Article } from "../entities/article.js";
import { createShipment } from "../entities/shipment.js";
import type { ShippingAddress } from "../entities/shippingAddress.js";
import type { CustomerInfoRepository } from "../repositories/customerInfoRepository.js";
import type { ShipmentRepository } from "../repositories/shipmentRepository.js";
import type { ShippingEventPublisher } from "./shippingEventPublisher.js";

// CU01: crear el envío automáticamente al recibir `order_placed`.
// Depende sólo de interfaces (repos + port de publisher): testeable con fakes.

export type CreateShipmentFromOrderCommand = {
  readonly orderId: string;
  readonly userId: string;
  readonly articles: readonly Article[];
  readonly correlationId: string;
};

export type CreateShipmentFromOrderDeps = {
  readonly customerInfoRepo: CustomerInfoRepository;
  readonly shipmentRepo: ShipmentRepository;
  readonly publisher: ShippingEventPublisher;
};

// El consumer usa el outcome sólo para loguear; el ack lo decide él (ack salvo throw).
export type CreateShipmentOutcome =
  | { readonly kind: "created"; readonly shipmentId: string }
  | { readonly kind: "no_address" }
  | { readonly kind: "duplicate" };

// Clave duplicada de MongoDB (índice único parcial (orderId, type=NORMAL)). Se detecta acá
// sin importar `mongodb`, para no acoplar el dominio ni tocar el repo de la Etapa 1.
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

export async function createShipmentFromOrder(
  command: CreateShipmentFromOrderCommand,
  deps: CreateShipmentFromOrderDeps
): Promise<CreateShipmentOutcome> {
  const { orderId, userId, articles, correlationId } = command;
  const { customerInfoRepo, shipmentRepo, publisher } = deps;

  const info = await customerInfoRepo.findByUserId(userId);
  if (!info) {
    await publisher.shippingError(
      { orderId, userId, message: "El usuario no tiene una dirección de envío registrada" },
      correlationId
    );
    return { kind: "no_address" };
  }

  // Snapshot inmutable de los datos del cliente al momento de crear el envío.
  const shippingAddress: ShippingAddress = {
    customerId: info.userId,
    name: info.name,
    address: info.address,
    city: info.city,
    zipCode: info.zipCode,
    phone: info.phone,
  };

  const shipment = createShipment({ orderId, shippingAddress, articles });

  try {
    await shipmentRepo.save(shipment);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Idempotencia CU01: order_placed duplicado → sin segundo envío, sin eventos.
      return { kind: "duplicate" };
    }
    throw err; // Error inesperado: lo maneja el consumer (nack sin requeue).
  }

  await publisher.shippingCreated(shipment, correlationId);
  return { kind: "created", shipmentId: shipment.id };
}
