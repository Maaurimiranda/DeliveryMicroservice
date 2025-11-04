import { Router } from "express";
import { ShipmentController } from "../controllers/ShipmentController";
import { JwtAuthMiddleware } from "../../../infrastructure/auth/JwtAuthMiddleware";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createShipmentSchema,
  stateTransitionSchema,
  getByIdSchema,
  getByOrderSchema,
  paginationSchema,
  initiateReturnSchema,
  completeReturnSchema,
  initiateExchangeSchema,
  cancelShipmentSchema
} from "../validators/shipment.schemas";

export class ShipmentRoutes {
  private router: Router;

  constructor(
    private readonly controller: ShipmentController,
    private readonly authMiddleware: JwtAuthMiddleware
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ------------------ RUTAS PUBLICAS - Tacking de envio ------------------
    this.router.get("/tracking/:id", validateRequest(getByIdSchema), this.controller.getShipmentTracking);

    // ------------------ RUTAS AUTENTICADAS Y AUTORIZADAS ------------------

    // Crear un nuevo envío - Requiere: admin
    this.router.post("/", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(createShipmentSchema), this.controller.createShipment);

    // Obtener todos los envíos con paginación - Requiere: admin
    this.router.get("/", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(paginationSchema), this.controller.getAllShipments);

    // Obtener envíos del usuario autenticado - Requiere: autenticación
    this.router.get("/my-shipments", this.authMiddleware.authenticate, validateRequest(paginationSchema), this.controller.getMyShipments);

    // Obtener un envío por ID - Requiere: autenticación
    this.router.get("/:id", this.authMiddleware.authenticate, validateRequest(getByIdSchema), this.controller.getShipmentById);

    // Obtener envíos por ID de orden - Requiere: autenticación
    this.router.get("/order/:orderId", this.authMiddleware.authenticate, validateRequest(getByOrderSchema), this.controller.getShipmentsByOrder);


    // Obtener historial de eventos de un envío - Requiere: admin
    this.router.get("/:id/events", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(getByIdSchema), this.controller.getEventHistory);


    // ==================== TRANSICIONES DE ESTADO (Admin) ====================

    // Mover envío a estado PREPARED - Requiere: admin
    this.router.post("/:id/prepare", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(stateTransitionSchema), this.controller.moveToPrepared);


    // Mover envío a estado IN_TRANSIT - Requiere: admin
    this.router.post("/:id/ship", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(stateTransitionSchema), this.controller.moveToInTransit);

    // Mover envío a estado DELIVERED - Requiere: admin
    this.router.post("/:id/deliver", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(stateTransitionSchema), this.controller.moveToDelivered);

    // Cancelar un envío - Requiere: admin
    this.router.post("/:id/cancel", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(cancelShipmentSchema), this.controller.cancelShipment);


    // ==================== DEVOLUCIONES Y CAMBIOS ====================

    // Iniciar proceso de devolución - Requiere: autenticación (cliente o admin)
    this.router.post("/:id/return", this.authMiddleware.authenticate, validateRequest(initiateReturnSchema), this.controller.initiateReturn);

    // Completar proceso de devolución - Requiere: admin
    this.router.post("/:id/return/complete", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(completeReturnSchema), this.controller.completeReturn);


    // Iniciar proceso de cambio de producto - Requiere: autenticación (cliente o admin)
    this.router.post("/:id/exchange", this.authMiddleware.authenticate, validateRequest(initiateExchangeSchema), this.controller.initiateExchange);


    // Completar proceso de cambio de producto - Requiere: admin
    this.router.post("/:originalShipmentId/exchange/:newShipmentId/complete", this.authMiddleware.authenticate, this.authMiddleware.requireAdmin, validateRequest(completeExchangeSchema), this.controller.completeExchange);
  }

  getRouter(): Router {
    return this.router;
  }
}