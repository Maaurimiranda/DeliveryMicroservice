// src/interfaces/http/controllers/ShipmentController.ts

import { Response } from "express";
import { AuthRequest } from "../../../infrastructure/auth/JwtAuthMiddleware";

// CASOS DE USO
import { CancelShipmentUseCase } from "../../../application/usecases/CancelShipmentUseCase";
import { CompleteExchangeUseCase } from "../../../application/usecases/CompleteExchangeUseCase";
import { CompleteReturnUseCase } from "../../../application/usecases/CompleteReturnUseCase";
import { CreateShipmentUseCase } from "../../../application/usecases/CreateShipmentUseCase";
import { InitiateExchangeUseCase } from "../../../application/usecases/InitiateExchangeUseCase";
import { InitiateReturnUseCase } from "../../../application/usecases/InitiateReturnUseCase";
import { MoveToDeliveredUseCase } from "../../../application/usecases/MoveToDeliveredUseCase";
import { MoveToInTransitUseCase } from "../../../application/usecases/MoveToInTransitUseCase";
import { MoveToPreparedUseCase } from "../../../application/usecases/MoveToPreparedUseCase";

// REPOSITORIOS
import { ShipmentProjectionRepository } from "../../../infrastructure/persistence/mongodb/ShipmentProjectionRepository";
import { EventStoreRepository } from "../../../infrastructure/persistence/mongodb/EventStoreRepository";

export class ShipmentController {
  constructor(
    private readonly createShipmentUseCase: CreateShipmentUseCase,
    private readonly moveToPreparedUseCase: MoveToPreparedUseCase,
    private readonly moveToInTransitUseCase: MoveToInTransitUseCase,
    private readonly moveToDeliveredUseCase: MoveToDeliveredUseCase,
    private readonly cancelShipmentUseCase: CancelShipmentUseCase,
    private readonly initiateReturnUseCase: InitiateReturnUseCase,
    private readonly completeReturnUseCase: CompleteReturnUseCase,
    private readonly initiateExchangeUseCase: InitiateExchangeUseCase,
    private readonly completeExchangeUseCase: CompleteExchangeUseCase,
    private readonly projectionRepository: ShipmentProjectionRepository,
    private readonly eventStoreRepository: EventStoreRepository
  ) {}

  // ==================== CREAR ENVÍO ====================

  createShipment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { orderId, customerInfo, articles, description } = req.body;
      const actor = req.user?.login || "system";

      const shipment = await this.createShipmentUseCase.execute({
        orderId,
        customerInfo,
        articles,
        actor,
        description
      });

      res.status(201).json({
        success: true,
        message: "Envío creado exitosamente",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al crear envío:", error);
      res.status(500).json({
        error: "Error al crear envío",
        message: error.message
      });
    }
  };

  // ==================== CONSULTAS ====================

  getShipmentById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const shipment = await this.projectionRepository.findById(id);

      if (!shipment) {
        res.status(404).json({
          error: "Envío no encontrado",
          message: `No se encontró envío con ID: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al obtener envío:", error);
      res.status(500).json({
        error: "Error al obtener envío",
        message: error.message
      });
    }
  };

  getShipmentsByOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;

      const shipments = await this.projectionRepository.findByOrderId(orderId);

      res.json({
        success: true,
        data: shipments.map(s => s.toJSON()),
        count: shipments.length
      });
    } catch (error: any) {
      console.error("❌ Error al obtener envíos por orden:", error);
      res.status(500).json({
        error: "Error al obtener envíos",
        message: error.message
      });
    }
  };

  getMyShipments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ 
          error: "No autenticado",
          message: "Se requiere autenticación" 
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;

      const shipments = await this.projectionRepository.findByCustomerId(
        req.user.userId
      );

      // Aplicar paginación manual (ya que findByCustomerId no la soporta)
      const paginatedShipments = shipments.slice(skip, skip + limit);

      res.json({
        success: true,
        data: paginatedShipments.map(s => s.toJSON()),
        pagination: {
          limit,
          skip,
          total: shipments.length
        }
      });
    } catch (error: any) {
      console.error("❌ Error al obtener mis envíos:", error);
      res.status(500).json({
        error: "Error al obtener envíos",
        message: error.message
      });
    }
  };

  getAllShipments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;

      const shipments = await this.projectionRepository.findAll(limit, skip);
      const total = await this.projectionRepository.count();

      res.json({
        success: true,
        data: shipments.map(s => s.toJSON()),
        pagination: {
          limit,
          skip,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      console.error("❌ Error al obtener todos los envíos:", error);
      res.status(500).json({
        error: "Error al obtener envíos",
        message: error.message
      });
    }
  };

  getShipmentTracking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const shipment = await this.projectionRepository.findById(id);

      if (!shipment) {
        res.status(404).json({
          error: "Envío no encontrado",
          message: `No se encontró envío con ID: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        data: {
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          currentStatus: shipment.status.value,
          tracking: shipment.tracking,
          lastUpdate: shipment.updatedAt
        }
      });
    } catch (error: any) {
      console.error("❌ Error al obtener tracking:", error);
      res.status(500).json({
        error: "Error al obtener tracking",
        message: error.message
      });
    }
  };

  getEventHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const events = await this.eventStoreRepository.getEventsByShipmentId(id);

      if (events.length === 0) {
        res.status(404).json({
          error: "Envío no encontrado",
          message: `No se encontraron eventos para el envío: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        data: {
          shipmentId: id,
          eventCount: events.length,
          events: events.map(e => e.toJSON())
        }
      });
    } catch (error: any) {
      console.error("❌ Error al obtener historial de eventos:", error);
      res.status(500).json({
        error: "Error al obtener eventos",
        message: error.message
      });
    }
  };

  // ==================== TRANSICIONES DE ESTADO ====================

  moveToPrepared = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body || {};
      const actor = req.user?.login || "system";

      const shipment = await this.moveToPreparedUseCase.execute({
        shipmentId: id,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Envío movido a PREPARED",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al mover a PREPARED:", error);
      res.status(400).json({
        error: "Error al cambiar estado",
        message: error.message
      });
    }
  };

  moveToInTransit = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body || {};
      const actor = req.user?.login || "system";

      const shipment = await this.moveToInTransitUseCase.execute({
        shipmentId: id,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Envío movido a IN_TRANSIT",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al mover a IN_TRANSIT:", error);
      res.status(400).json({
        error: "Error al cambiar estado",
        message: error.message
      });
    }
  };

  moveToDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body || {};
      const actor = req.user?.login || "system";

      const shipment = await this.moveToDeliveredUseCase.execute({
        shipmentId: id,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Envío movido a DELIVERED",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al mover a DELIVERED:", error);
      res.status(400).json({
        error: "Error al cambiar estado",
        message: error.message
      });
    }
  };

  cancelShipment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, description } = req.body || {};
      const actor = req.user?.login || "system";

      const shipment = await this.cancelShipmentUseCase.execute({
        shipmentId: id,
        reason,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Envío cancelado exitosamente",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al cancelar envío:", error);
      res.status(400).json({
        error: "Error al cancelar envío",
        message: error.message
      });
    }
  };

  // ==================== DEVOLUCIONES ====================

  initiateReturn = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason, description } = req.body || {};
      const actor = req.user?.login || "customer";

      const shipment = await this.initiateReturnUseCase.execute({
        shipmentId: id,
        reason,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Devolución iniciada exitosamente",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al iniciar devolución:", error);
      res.status(400).json({
        error: "Error al iniciar devolución",
        message: error.message
      });
    }
  };

  completeReturn = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { productCondition, notes, description } = req.body || {};
      const actor = req.user?.login || "warehouse_operator";

      const shipment = await this.completeReturnUseCase.execute({
        shipmentId: id,
        productCondition,
        notes,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Devolución completada exitosamente",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("❌ Error al completar devolución:", error);
      res.status(400).json({
        error: "Error al completar devolución",
        message: error.message
      });
    }
  };

  // ==================== CAMBIOS ====================

  initiateExchange = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { newArticles, reason, description } = req.body || {};
      const actor = req.user?.login || "customer";

      const result = await this.initiateExchangeUseCase.execute({
        shipmentId: id,
        newArticles,
        reason,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Cambio iniciado exitosamente",
        data: {
          originalShipment: result.originalShipment.toJSON(),
          newShipment: result.newShipment.toJSON()
        }
      });
    } catch (error: any) {
      console.error("❌ Error al iniciar cambio:", error);
      res.status(400).json({
        error: "Error al iniciar cambio",
        message: error.message
      });
    }
  };

  completeExchange = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { originalShipmentId, newShipmentId } = req.params;
      const { productCondition, notes, description } = req.body || {};
      const actor = req.user?.login || "warehouse_operator";

      const result = await this.completeExchangeUseCase.execute({
        originalShipmentId,
        newShipmentId,
        productCondition,
        notes,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Cambio completado exitosamente",
        data: {
          originalShipment: result.originalShipment.toJSON(),
          newShipment: result.newShipment.toJSON(),
          nextAction: result.nextAction
        }
      });
    } catch (error: any) {
      console.error("❌ Error al completar cambio:", error);
      res.status(400).json({
        error: "Error al completar cambio",
        message: error.message
      });
    }
  };
}