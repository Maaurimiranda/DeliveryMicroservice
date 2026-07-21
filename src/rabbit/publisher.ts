import { env } from "../tools/environment.js";
import { getChannel } from "./connection.js";

// Sobre estándar del ecosistema commongo/rbt.
export type Envelope<T> = {
  correlation_id: string;
  message: T;
};

// Helper puro: envuelve el payload preservando el correlation_id ya resuelto por el transporte.
export function buildEnvelope<T>(message: T, correlationId: string): Envelope<T> {
  return { correlation_id: correlationId, message };
}

// Publisher genérico sobre el topic propio `shipping_events`. Reutilizable por todos los eventos.
// El exchange ya se assertea en connectRabbit; acá sólo publicamos con la routing key del evento.
export function publishEvent(routingKey: string, message: unknown, correlationId: string): void {
  const envelope = buildEnvelope(message, correlationId);
  getChannel().publish(env.rabbitExchange, routingKey, Buffer.from(JSON.stringify(envelope)), {
    contentType: "application/json",
    persistent: true,
  });
}
