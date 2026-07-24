import type { Request, Response } from "express";
import { createCustomerInfo } from "../../domain/entities/customerInfo.js";
import { mongoCustomerInfoRepository } from "../../infrastructure/repositories/mongoCustomerInfoRepository.js";
import { customerInfoBodySchema } from "../schemas/customerInfoSchema.js";

const repo = mongoCustomerInfoRepository;

// GET /api/shipments/customer-info — datos del usuario autenticado (404 si no los registró).
export async function getCustomerInfo(req: Request, res: Response): Promise<void> {
  const info = await repo.findByUserId(req.user!.id);
  if (!info) {
    res.status(404).json({ success: false, message: "El usuario no registró dirección" });
    return;
  }
  res.json({ success: true, data: info });
}

// PUT /api/shipments/customer-info — crea/actualiza (upsert) los datos del usuario autenticado.
export async function putCustomerInfo(req: Request, res: Response): Promise<void> {
  const parsed = customerInfoBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Body inválido", data: parsed.error.issues });
    return;
  }

  const info = createCustomerInfo({ userId: req.user!.id, ...parsed.data });
  await repo.save(info);
  res.json({ success: true, message: "Dirección guardada exitosamente", data: info });
}
