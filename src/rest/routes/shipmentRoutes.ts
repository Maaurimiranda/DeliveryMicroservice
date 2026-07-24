import { Router } from "express";
import { authMiddleware, requireAdmin } from "../../security/authMiddleware.js";
import {
  getShipmentById,
  getShipments,
  getTracking,
  postCancel,
  postCompleteExchange,
  postCompleteReturn,
  postDeliver,
  postExchange,
  postPrepare,
  postReturn,
  postShip,
} from "../controllers/shipmentController.js";

// Rutas del ciclo de vida del envío (CU02–CU11). Se montan bajo /api/shipments.
//
// Dos reglas de orden que no se pueden romper:
//   1. `/tracking/:id` va antes que `/:id`, o Express lo captura como un id.
//   2. El auth se declara POR RUTA. Un `router.use(authMiddleware)` matchearía todo el mount
//      y respondería 401 sin llamar next(), tapando la ruta pública de tracking.
//
// No hay POST /api/shipments: un envío solo nace del evento `order_placed` (CU01).
export const shipmentRoutes: Router = Router();

// Público (CU10)
shipmentRoutes.get("/tracking/:id", getTracking);

// Consultas autenticadas: user ve lo propio, admin ve todo (CU10 / CU11)
shipmentRoutes.get("/", authMiddleware, getShipments);
shipmentRoutes.get("/:id", authMiddleware, getShipmentById);

// Acciones del usuario sobre un envío propio (CU06 / CU08)
shipmentRoutes.post("/:id/return", authMiddleware, postReturn);
shipmentRoutes.post("/:id/exchange", authMiddleware, postExchange);

// Acciones de admin (CU02–CU05, CU07, CU09)
shipmentRoutes.post("/:id/prepare", authMiddleware, requireAdmin, postPrepare);
shipmentRoutes.post("/:id/ship", authMiddleware, requireAdmin, postShip);
shipmentRoutes.post("/:id/deliver", authMiddleware, requireAdmin, postDeliver);
shipmentRoutes.post("/:id/cancel", authMiddleware, requireAdmin, postCancel);
shipmentRoutes.post("/:id/return/complete", authMiddleware, requireAdmin, postCompleteReturn);
shipmentRoutes.post(
  "/:originalShipmentId/exchange/:newShipmentId/complete",
  authMiddleware,
  requireAdmin,
  postCompleteExchange
);
