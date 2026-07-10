// src/interfaces/http/routes/shipment.routes.ts

import { Router } from "express";
import { ShipmentController } from "../controllers/ShipmentController";
import { JwtAuthMiddleware } from "../../../infrastructure/auth/JwtAuthMiddleware";

// Middleware de validación
import { validate } from "../middlewares/validate";

// Schemas de validación
import * as schemas from "../validators/shipment.schemas";

export class ShipmentRoutes {
  private router: Router;

  constructor(
    private readonly controller: ShipmentController,
    private readonly auth: JwtAuthMiddleware
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ==================== RUTAS PÚBLICAS ====================
    
    /**
     * GET /tracking/:id
     * Obtiene tracking público de un envío
     */
    this.router.get(
      "/tracking/:id",
      validate(schemas.getByIdSchema),
      this.controller.getShipmentTracking
    );

    // ==================== RUTAS AUTENTICADAS ====================

    /**
     * POST /
     * Crea un nuevo envío (Admin only)
     */
    this.router.post(
      "/",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.createShipmentSchema),
      this.controller.createShipment
    );

    /**
     * GET /
     * Lista todos los envíos con paginación (Admin only)
     */
    this.router.get(
      "/",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.paginationSchema),
      this.controller.getAllShipments
    );

    /**
     * GET /my-shipments
     * Obtiene envíos del usuario autenticado
     */
    this.router.get(
      "/my-shipments",
      this.auth.authenticate,
      validate(schemas.paginationSchema),
      this.controller.getMyShipments
    );

    /**
     * GET /:id
     * Obtiene un envío por ID
     */
    this.router.get(
      "/:id",
      this.auth.authenticate,
      validate(schemas.getByIdSchema),
      this.controller.getShipmentById
    );

    /**
     * GET /order/:orderId
     * Obtiene envíos por ID de orden
     */
    this.router.get(
      "/order/:orderId",
      this.auth.authenticate,
      validate(schemas.getByOrderSchema),
      this.controller.getShipmentsByOrder
    );

    /**
     * GET /:id/events
     * Obtiene historial de eventos (Admin only)
     */
    this.router.get(
      "/:id/events",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.getByIdSchema),
      this.controller.getEventHistory
    );

    // ==================== TRANSICIONES DE ESTADO (Admin) ====================

    /**
     * POST /:id/prepare
     * Mueve envío a PREPARED
     */
    this.router.post(
      "/:id/prepare",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.stateTransitionSchema),
      this.controller.moveToPrepared
    );

    /**
     * POST /:id/ship
     * Mueve envío a IN_TRANSIT
     */
    this.router.post(
      "/:id/ship",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.stateTransitionSchema),
      this.controller.moveToInTransit
    );

    /**
     * POST /:id/deliver
     * Mueve envío a DELIVERED
     */
    this.router.post(
      "/:id/deliver",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.stateTransitionSchema),
      this.controller.moveToDelivered
    );

    /**
     * POST /:id/cancel
     * Cancela un envío
     */
    this.router.post(
      "/:id/cancel",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.cancelShipmentSchema),
      this.controller.cancelShipment
    );

    // ==================== DEVOLUCIONES Y CAMBIOS ====================

    /**
     * POST /:id/return
     * Inicia proceso de devolución
     */
    this.router.post(
      "/:id/return",
      this.auth.authenticate,
      validate(schemas.initiateReturnSchema),
      this.controller.initiateReturn
    );

    /**
     * POST /:id/return/complete
     * Completa proceso de devolución (Admin only)
     */
    this.router.post(
      "/:id/return/complete",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.completeReturnSchema),
      this.controller.completeReturn
    );

    /**
     * POST /:id/exchange
     * Inicia proceso de cambio
     */
    this.router.post(
      "/:id/exchange",
      this.auth.authenticate,
      validate(schemas.initiateExchangeSchema),
      this.controller.initiateExchange
    );

    /**
     * POST /:originalShipmentId/exchange/:newShipmentId/complete
     * Completa proceso de cambio (Admin only)
     */
    this.router.post(
      "/:originalShipmentId/exchange/:newShipmentId/complete",
      this.auth.authenticate,
      this.auth.requireAdmin,
      validate(schemas.completeExchangeSchema),
      this.controller.completeExchange
    );
  }

  getRouter(): Router {
    return this.router;
  }
}