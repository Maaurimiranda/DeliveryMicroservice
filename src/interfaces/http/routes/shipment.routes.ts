// src/interfaces/http/routes/shipment.routes.ts

import { Router } from "express";
import { ShipmentController } from "../controllers/ShipmentController";
import { JwtAuthMiddleware } from "../../../infrastructure/auth/JwtAuthMiddleware";
import { body, param } from "express-validator";
import { validateRequest } from "../middlewares/validateRequest";

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
    // ==================== RUTAS PÚBLICAS (con auth opcional) ====================
    
    // Tracking público de envío (cualquiera con el ID puede consultar)
    this.router.get(
      "/tracking/:id",
      [
        param("id").notEmpty().withMessage("ID de envío requerido")
      ],
      validateRequest,
      this.controller.getShipmentTracking
    );

    // ==================== RUTAS AUTENTICADAS ====================

    // Crear envío (solo admin o system)
    this.router.post(
      "/",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        body("orderId").notEmpty().withMessage("orderId es requerido"),
        body("customerInfo").isObject().withMessage("customerInfo debe ser un objeto"),
        body("customerInfo.customerId").notEmpty().withMessage("customerId es requerido"),
        body("customerInfo.address").notEmpty().withMessage("address es requerido"),
        body("articles").isArray({ min: 1 }).withMessage("articles debe ser un array no vacío")
      ],
      validateRequest,
      this.controller.createShipment
    );

    // Obtener todos los envíos (solo admin)
    this.router.get(
      "/",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      this.controller.getAllShipments
    );

    // Obtener mis envíos (cliente autenticado)
    this.router.get(
      "/my-shipments",
      this.authMiddleware.authenticate,
      this.controller.getMyShipments
    );

    // Obtener envío por ID (usuario autenticado)
    this.router.get(
      "/:id",
      this.authMiddleware.authenticate,
      [
        param("id").notEmpty().withMessage("ID de envío requerido")
      ],
      validateRequest,
      this.controller.getShipmentById
    );

    // Obtener envíos por orden (usuario autenticado)
    this.router.get(
      "/order/:orderId",
      this.authMiddleware.authenticate,
      [
        param("orderId").notEmpty().withMessage("orderId requerido")
      ],
      validateRequest,
      this.controller.getShipmentsByOrder
    );

    // Obtener historial de eventos (admin)
    this.router.get(
      "/:id/events",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        param("id").notEmpty().withMessage("ID de envío requerido")
      ],
      validateRequest,
      this.controller.getEventHistory
    );

    // ==================== TRANSICIONES DE ESTADO (solo admin) ====================

    // Mover a PREPARED
    this.router.post(
      "/:id/prepare",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.moveToPrepared
    );

    // Mover a IN_TRANSIT
    this.router.post(
      "/:id/ship",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.moveToInTransit
    );

    // Mover a DELIVERED
    this.router.post(
      "/:id/deliver",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.moveToDelivered
    );

    // Cancelar envío
    this.router.post(
      "/:id/cancel",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.cancelShipment
    );

    // ==================== DEVOLUCIONES Y CAMBIOS ====================

    // Iniciar devolución (cliente o admin)
    this.router.post(
      "/:id/return",
      this.authMiddleware.authenticate,
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.initiateReturn
    );

    // Completar devolución (solo admin)
    this.router.post(
      "/:id/return/complete",
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission("admin"),
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.completeReturn
    );

    // Iniciar cambio de producto (cliente o admin)
    this.router.post(
      "/:id/exchange",
      this.authMiddleware.authenticate,
      [
        param("id").notEmpty().withMessage("ID de envío requerido"),
        body("description").optional().isString()
      ],
      validateRequest,
      this.controller.initiateExchange
    );
  }

  getRouter(): Router {
    return this.router;
  }
}