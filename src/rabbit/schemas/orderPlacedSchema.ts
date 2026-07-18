import { z } from "zod";

// Contrato commongo/rbt: el mensaje viaja en el sobre { correlation_id, message }.
// Se valida el `message`, no la raíz. Payload de `order_placed` publicado por Orders.

const articleSchema = z.object({
  articleId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const orderPlacedMessageSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  // `cartId` viene en el contrato pero Delivery no lo usa; se acepta opcional.
  cartId: z.string().optional(),
  articles: z.array(articleSchema).min(1),
});

export const orderPlacedEnvelopeSchema = z.object({
  // Opcional: el ecosistema siempre lo trae, pero si falta el consumer genera uno.
  correlation_id: z.string().optional(),
  message: orderPlacedMessageSchema,
});

export type OrderPlacedMessage = z.infer<typeof orderPlacedMessageSchema>;
export type OrderPlacedEnvelope = z.infer<typeof orderPlacedEnvelopeSchema>;
