import type { ConsumeMessage } from "amqplib";
import { invalidate } from "../../security/tokenCache.js";
import { getChannel } from "../connection.js";

// Nombre de contrato Go fijo: hardcodeado, no en env.
const EXCHANGE = "auth"; // fanout transiente (Go); nunca redeclarar con otro tipo.

// Logout: authgo publica en el fanout `auth` el token del usuario que cerró sesión.
// Cola anónima, exclusiva y auto-delete (cada instancia limpia su propio cache).
export async function startAuthConsumer(): Promise<void> {
  const channel = getChannel();

  await channel.assertExchange(EXCHANGE, "fanout", { durable: false });
  const { queue } = await channel.assertQueue("", { exclusive: true, autoDelete: true });
  await channel.bindQueue(queue, EXCHANGE, ""); // routing key vacía

  await channel.consume(queue, (msg) => handleMessage(msg), { noAck: false });
  console.log(`Consumiendo ${EXCHANGE} en cola ${queue}`);
}

function handleMessage(msg: ConsumeMessage | null): void {
  if (!msg) return;
  const channel = getChannel();
  const token = parseLogoutToken(msg.content.toString());
  if (token) invalidate(token);
  channel.ack(msg);
}

// El mensaje puede venir como sobre { correlation_id, message: "Bearer ey..." } (README) o
// como string plano "Bearer ey..." (doc authgo). Soportamos ambos y quitamos el prefijo `Bearer `.
export function parseLogoutToken(raw: string): string | null {
  let value: unknown = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      value = (parsed as { message: unknown }).message;
    } else {
      value = parsed;
    }
  } catch {
    value = raw; // no era JSON: string plano
  }

  if (typeof value !== "string") return null;
  const token = value.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : value.trim();
  return token === "" ? null : token;
}
