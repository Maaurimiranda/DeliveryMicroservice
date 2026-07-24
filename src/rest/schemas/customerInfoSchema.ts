import { z } from "zod";

// Body de PUT /api/shipments/customer-info. El userId no viene en el body: sale del token.
export const customerInfoBodySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  zipCode: z.string().min(1),
  phone: z.string().min(1),
});

export type CustomerInfoBody = z.infer<typeof customerInfoBodySchema>;
