import { z } from "zod";

// Bodies de los endpoints de ciclo de vida del envío (CU02–CU11). El actor y el dueño salen
// del token, nunca del body. `description` reemplaza el texto de la entrada de tracking.

// CU02 / CU03 / CU04: prepare, ship, deliver.
export const transitionBodySchema = z.object({
  description: z.string().min(1).optional(),
});

// CU05: cancelar. El motivo es requerido.
export const cancelBodySchema = z.object({
  reason: z.string().min(1),
  description: z.string().min(1).optional(),
});

// CU06: iniciar devolución. El motivo es requerido.
export const startReturnBodySchema = z.object({
  reason: z.string().min(1),
  description: z.string().min(1).optional(),
});

// CU08: iniciar cambio. Acá `description` ES el motivo, y por eso es requerido.
export const startExchangeBodySchema = z.object({
  description: z.string().min(1),
});

// CU07 / CU09: la condición del producto original decide el desenlace y viaja en el evento.
export const productConditionSchema = z.enum(["good", "damaged", "defective"]);

export const completeReturnBodySchema = z.object({
  productCondition: productConditionSchema,
  notes: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

export const completeExchangeBodySchema = completeReturnBodySchema;

// CU11: los defaults y el techo (50 / máx 100) los aplica el caso de uso.
export const listQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional(),
});

export type TransitionBody = z.infer<typeof transitionBodySchema>;
export type CancelBody = z.infer<typeof cancelBodySchema>;
export type StartReturnBody = z.infer<typeof startReturnBodySchema>;
export type StartExchangeBody = z.infer<typeof startExchangeBodySchema>;
export type CompleteReturnBody = z.infer<typeof completeReturnBodySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
