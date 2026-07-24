import { Router } from "express";
import { authMiddleware } from "../../security/authMiddleware.js";
import { getCustomerInfo, putCustomerInfo } from "../controllers/customerInfoController.js";

// Rutas de datos del cliente. Se montan bajo /api/shipments.
// IMPORTANTE: registrar `/customer-info` antes de cualquier `/:id` para que no lo capture.
// El auth va por ruta, NO con `router.use(authMiddleware)`: un middleware de router sin path
// matchea toda ruta bajo el mount y responde 401 sin llamar next(), tapando las rutas públicas
// del router siguiente (`GET /api/shipments/tracking/:id`).
export const customerInfoRoutes: Router = Router();

customerInfoRoutes.get("/customer-info", authMiddleware, getCustomerInfo);
customerInfoRoutes.put("/customer-info", authMiddleware, putCustomerInfo);
