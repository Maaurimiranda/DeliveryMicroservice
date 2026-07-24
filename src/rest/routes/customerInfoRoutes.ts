import { Router } from "express";
import { authMiddleware } from "../../security/authMiddleware.js";
import { getCustomerInfo, putCustomerInfo } from "../controllers/customerInfoController.js";

// Rutas de datos del cliente. Se montan bajo /api/shipments.
// IMPORTANTE (Etapa 5): registrar `/customer-info` antes de cualquier `/:id` para que no lo capture.
export const customerInfoRoutes: Router = Router();

customerInfoRoutes.use(authMiddleware);
customerInfoRoutes.get("/customer-info", getCustomerInfo);
customerInfoRoutes.put("/customer-info", putCustomerInfo);
