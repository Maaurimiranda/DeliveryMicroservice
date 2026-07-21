import { Router } from "express";
import { authMiddleware } from "../../security/authMiddleware.js";
import { getAddress, putAddress } from "../controllers/addressController.js";

// Rutas de dirección del usuario. Se montan bajo /api/shipments.
// IMPORTANTE (Etapa 5): registrar `/address` antes de cualquier `/:id` para que no lo capture.
export const addressRoutes: Router = Router();

addressRoutes.use(authMiddleware);
addressRoutes.get("/address", getAddress);
addressRoutes.put("/address", putAddress);
