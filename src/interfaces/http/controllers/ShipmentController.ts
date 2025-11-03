import { Response } from "express";
import { AuthRequest } from "../../../infrastructure/auth/JwtAuthMiddleware";
import { CreateShipmentUseCase } from "../../../application/usecases/CreateShipmentUseCase";
import {
  MoveToPreparedUseCase,
  MoveToInTransitUseCase,
  MoveToDeliveredUseCase,
  CancelShipmentUseCase,
  InitiateReturnUseCase,
  CompleteReturnUseCase,
  InitiateExchangeUseCase
} from "../../../application/usecases/StateTransitionUseCases";
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
    private readonly projectionRepository: ShipmentProjectionRepository,
    private readonly eventStoreRepository: EventStoreRepository
  ) {}

  createShipment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { orderId, customerInfo, articles, description } = req.body;

      if (!orderId || !customerInfo || !articles) {
        res.status(400).json({
          error: "Campos requeridos faltantes",
          message: "orderId, customerInfo y articles son requeridos"
        });
        return;
      }

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
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("Error al crear envío:", error);
      res.status(500).json({
        error: "Error al crear envío",
        message: error.message
      });
    }
  };

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
      console.error("Error al obtener envío:", error);
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
      console.error("Error al obtener envíos:", error);
      res.status(500).json({
        error: "Error al obtener envíos",
        message: error.message
      });
    }
  };

  getMyShipments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const shipments = await this.projectionRepository.findByCustomerId(req.user.userId);

      res.json({
        success: true,
        data: shipments.map(s => s.toJSON()),
        count: shipments.length
      });
    } catch (error: any) {
      console.error("Error al obtener mis envíos:", error);
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
          total
        }
      });
    } catch (error: any) {
      console.error("Error al obtener envíos:", error);
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
          error: "Envío no encontrado"
        });
        return;
      }

      res.json({
        success: true,
        data: {
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          currentStatus: shipment.status.value,
          tracking: shipment.tracking
        }
      });
    } catch (error: any) {
      console.error("Error al obtener tracking:", error);
      res.status(500).json({
        error: "Error al obtener tracking",
        message: error.message
      });
    }
  };

  moveToPrepared = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body;
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
      console.error("Error al mover a PREPARED:", error);
      res.status(400).json({
        error: "Error al cambiar estado",
        message: error.message
      });
    }
  };

  moveToInTransit = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body;
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
      console.error("Error al mover a IN_TRANSIT:", error);
      res.status(400).json({
        error: "Error al cambiar estado",
        message: error.message
      });
    }
  };

  moveToDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body;
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
      console.error("Error al mover a DELIVERED:", error);
      res.status(400).json({
        error: "Error al cambiar estado",
        message: error.message
      });
    }
  };

  cancelShipment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body;
      const actor = req.user?.login || "system";

      const shipment = await this.cancelShipmentUseCase.execute({
        shipmentId: id,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Envío cancelado",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("Error al cancelar envío:", error);
      res.status(400).json({
        error: "Error al cancelar envío",
        message: error.message
      });
    }
  };

  initiateReturn = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { description } = req.body;
      const actor = req.user?.login || "customer";

      const shipment = await this.initiateReturnUseCase.execute({
        shipmentId: id,
        actor,
        description
      });

      res.json({
        success: true,
        message: "Devolución iniciada",
        data: shipment.toJSON()
      });
    } catch (error: any) {
      console.error("Error al iniciar devolución:", error);
      res.status(400).json({
        error: "Error al iniciar devolución",
        message: error.message
      });
    }
  };
}