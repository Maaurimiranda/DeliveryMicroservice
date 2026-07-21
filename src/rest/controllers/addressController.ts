import type { Request, Response } from "express";
import { createShippingAddress } from "../../domain/entities/shippingAddress.js";
import { mongoShippingAddressRepository } from "../../infrastructure/repositories/mongoShippingAddressRepository.js";
import { addressBodySchema } from "../schemas/addressSchema.js";

const repo = mongoShippingAddressRepository;

// GET /api/shipments/address — dirección del usuario autenticado (404 si no registró).
export async function getAddress(req: Request, res: Response): Promise<void> {
  const address = await repo.findByUserId(req.user!.id);
  if (!address) {
    res.status(404).json({ success: false, message: "El usuario no registró dirección" });
    return;
  }
  res.json({ success: true, data: address });
}

// PUT /api/shipments/address — crea/actualiza (upsert) la dirección del usuario autenticado.
export async function putAddress(req: Request, res: Response): Promise<void> {
  const parsed = addressBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Body inválido", data: parsed.error.issues });
    return;
  }

  const address = createShippingAddress({ userId: req.user!.id, ...parsed.data });
  await repo.save(address);
  res.json({ success: true, message: "Dirección guardada exitosamente", data: address });
}
