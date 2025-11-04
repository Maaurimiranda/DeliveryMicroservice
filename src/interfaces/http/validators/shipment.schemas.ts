// src/interfaces/http/validators/shipment.schemas.ts

import { z } from "zod";

// ==================== SCHEMAS DE VALUE OBJECTS ====================

const customerInfoSchema = z.object({
  customerId: z.string()
    .min(1, "customerId es requerido")
    .trim(),
  name: z.string()
    .min(1, "name es requerido")
    .max(200, "name no puede exceder 200 caracteres")
    .trim(),
  address: z.string()
    .min(1, "address es requerido")
    .max(500, "address no puede exceder 500 caracteres")
    .trim(),
  city: z.string()
    .min(1, "city es requerido")
    .max(100, "city no puede exceder 100 caracteres")
    .trim(),
  zipCode: z.string()
    .min(4, "zipCode debe tener al menos 4 caracteres")
    .max(10, "zipCode no puede exceder 10 caracteres")
    .trim(),
  phone: z.string()
    .min(8, "phone debe tener al menos 8 dígitos")
    .max(20, "phone no puede exceder 20 caracteres")
    .regex(/^[\d\s\-\+\(\)]+$/, "phone contiene caracteres inválidos")
    .trim()
});

const articleSchema = z.object({
  articleId: z.string()
    .min(1, "articleId es requerido")
    .trim(),
  quantity: z.number()
    .int("quantity debe ser un número entero")
    .positive("quantity debe ser mayor a 0"),
  price: z.number()
    .nonnegative("price no puede ser negativo")
});

// ==================== SCHEMAS PARA COMANDOS ====================

// Schema para crear envío
export const createShipmentSchema = z.object({
  body: z.object({
    orderId: z.string()
      .min(1, "orderId es requerido")
      .trim(),
    customerInfo: customerInfoSchema,
    articles: z.array(articleSchema)
      .min(1, "debe haber al menos un artículo")
      .max(50, "no puede haber más de 50 artículos"),
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  })
});

// Schema para transiciones de estado
export const stateTransitionSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, "ID de envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  }),
  body: z.object({
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  }).optional()
});

// Schema para iniciar devolución
export const initiateReturnSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, "ID de envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  }),
  body: z.object({
    reason: z.string()
      .max(500, "reason no puede exceder 500 caracteres")
      .trim()
      .optional(),
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  }).optional()
});

// Schema para completar devolución
export const completeReturnSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, "ID de envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  }),
  body: z.object({
    productCondition: z.enum(["good", "damaged", "defective"])
      .optional(),
    notes: z.string()
      .max(1000, "notes no puede exceder 1000 caracteres")
      .trim()
      .optional(),
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  }).optional()
});

// Schema para iniciar cambio
export const initiateExchangeSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, "ID de envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  }),
  body: z.object({
    newArticles: z.array(articleSchema)
      .min(1, "debe haber al menos un artículo")
      .max(50, "no puede haber más de 50 artículos")
      .optional(),
    reason: z.string()
      .max(500, "reason no puede exceder 500 caracteres")
      .trim()
      .optional(),
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  }).optional()
});

// Schema para completar cambio
export const completeExchangeSchema = z.object({
  params: z.object({
    originalShipmentId: z.string()
      .min(1, "ID de envío original requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      ),
    newShipmentId: z.string()
      .min(1, "ID de nuevo envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  }),
  body: z.object({
    productCondition: z.enum(["good", "damaged", "defective"])
      .optional(),
    notes: z.string()
      .max(1000, "notes no puede exceder 1000 caracteres")
      .trim()
      .optional(),
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  }).optional()
});

// Schema para obtener envío por ID
export const getByIdSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, "ID de envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  })
});

// Schema para obtener envíos por orden
export const getByOrderSchema = z.object({
  params: z.object({
    orderId: z.string()
      .min(1, "orderId requerido")
      .trim()
  })
});

// Schema para paginación
export const paginationSchema = z.object({
  query: z.object({
    limit: z.string()
      .regex(/^\d+$/, "limit debe ser un número")
      .transform(Number)
      .refine((val) => val >= 1 && val <= 100, {
        message: "limit debe estar entre 1 y 100"
      })
      .optional()
      .default(50),
    skip: z.string()
      .regex(/^\d+$/, "skip debe ser un número")
      .transform(Number)
      .refine((val) => val >= 0, {
        message: "skip debe ser mayor o igual a 0"
      })
      .optional()
      .default(0)
  })
});

// Schema para cancelar envío
export const cancelShipmentSchema = z.object({
  params: z.object({
    id: z.string()
      .min(1, "ID de envío requerido")
      .regex(
        /^(ship_\d+_[a-z0-9]+|[0-9a-fA-F]{24})$/,
        "Formato de ID inválido"
      )
  }),
  body: z.object({
    reason: z.string()
      .max(500, "reason no puede exceder 500 caracteres")
      .trim()
      .optional(),
    description: z.string()
      .max(500, "description no puede exceder 500 caracteres")
      .trim()
      .optional()
  }).optional()
});

// ==================== TIPOS INFERIDOS ====================

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>["body"];
export type StateTransitionInput = z.infer<typeof stateTransitionSchema>;
export type InitiateReturnInput = z.infer<typeof initiateReturnSchema>;
export type CompleteReturnInput = z.infer<typeof completeReturnSchema>;
export type InitiateExchangeInput = z.infer<typeof initiateExchangeSchema>;
export type CompleteExchangeInput = z.infer<typeof completeExchangeSchema>;
export type GetByIdInput = z.infer<typeof getByIdSchema>;
export type GetByOrderInput = z.infer<typeof getByOrderSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CancelShipmentInput = z.infer<typeof cancelShipmentSchema>;