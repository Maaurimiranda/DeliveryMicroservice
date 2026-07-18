import { randomUUID } from "node:crypto";
import type { ConsumeMessage } from "amqplib";
import {
  createShipmentFromOrder,
  type CreateShipmentFromOrderDeps,
} from "../../domain/services/createShipmentFromOrderUseCase.js";
import { getChannel } from "../connection.js";
import { orderPlacedEnvelopeSchema } from "../schemas/orderPlacedSchema.js";

// Nombres de contrato Go fijos: hardcodeados, no en env.
const EXCHANGE = "order_placed"; // fanout transiente (Go); nunca redeclarar con otro tipo.
const QUEUE = "delivery_order_placed"; // cola propia durable.

// CU01: escucha `order_placed` y crea el envío. Este módulo es sólo transporte
// (parse + ack/nack); la lógica vive en createShipmentFromOrder.
export async function startOrderPlacedConsumer(deps: CreateShipmentFromOrderDeps): Promise<void> {
  const channel = getChannel();

  await channel.assertExchange(EXCHANGE, "fanout", { durable: false });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ""); // routing key vacía

  await channel.consume(QUEUE, (msg) => handleMessage(msg, deps), { noAck: false });
  console.log(`Consumiendo ${EXCHANGE} en cola ${QUEUE}`);
}

async function handleMessage(
  msg: ConsumeMessage | null,
  deps: CreateShipmentFromOrderDeps
): Promise<void> {
  if (!msg) return;
  const channel = getChannel();

  let raw: unknown;
  try {
    raw = JSON.parse(msg.content.toString());
  } catch {
    console.warn("order_placed: JSON inválido, descartado");
    channel.ack(msg); // poison message: ack para no romper el consumer
    return;
  }

  const parsed = orderPlacedEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("order_placed: message inválido (Zod), descartado", parsed.error.issues);
    channel.ack(msg);
    return;
  }

  const { correlation_id, message } = parsed.data;
  const correlationId = correlation_id ?? randomUUID();

  try {
    const outcome = await createShipmentFromOrder(
      { orderId: message.orderId, userId: message.userId, articles: message.articles, correlationId },
      deps
    );
    console.log(`order_placed procesado: ${outcome.kind}`);
    channel.ack(msg); // created / no_address / duplicate → ack
  } catch (err) {
    console.error("order_placed: error inesperado, nack sin requeue", err);
    channel.nack(msg, false, false); // descarta, evita loop de poison-message
  }
}
