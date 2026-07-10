import { EventStoreRepository } from "../persistence/mongodb/EventStoreRepository";
import { ShipmentProjectionRepository } from "../persistence/mongodb/ShipmentProjectionRepository";
import { ShipmentRepository } from "../persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../messaging/rabbitmq/RabbitMqPublisher";

// Use Cases
import { CreateShipmentUseCase } from "../../application/usecases/CreateShipmentUseCase";
import { MoveToPreparedUseCase } from "../../application/usecases/MoveToPreparedUseCase";
import { MoveToInTransitUseCase } from "../../application/usecases/MoveToInTransitUseCase";
import { MoveToDeliveredUseCase } from "../../application/usecases/MoveToDeliveredUseCase";
import { CancelShipmentUseCase } from "../../application/usecases/CancelShipmentUseCase";
import { InitiateReturnUseCase } from "../../application/usecases/InitiateReturnUseCase";
import { CompleteReturnUseCase } from "../../application/usecases/CompleteReturnUseCase";
import { InitiateExchangeUseCase } from "../../application/usecases/InitiateExchangeUseCase";
import { CompleteExchangeUseCase } from "../../application/usecases/CompleteExchangeUseCase";

// Controllers
import { ShipmentController } from "../../interfaces/http/controllers/ShipmentController";

// Auth
import { JwtAuthMiddleware } from "../auth/JwtAuthMiddleware";
import { config } from "../../config/environment";

// Implementa el patrón Dependency Injection para centralizar la creación e inyección de dependencias.
export class DependencyContainer {
  private static instance: DependencyContainer;

  // Repositorios
  private _eventStoreRepository?: EventStoreRepository;
  private _projectionRepository?: ShipmentProjectionRepository;
  private _shipmentRepository?: ShipmentRepository;

  // Messaging
  private _rabbitMqPublisher?: RabbitMqPublisher;

  // Middleware
  private _authMiddleware?: JwtAuthMiddleware;

  // Use Cases
  private _createShipmentUseCase?: CreateShipmentUseCase;
  private _moveToPreparedUseCase?: MoveToPreparedUseCase;
  private _moveToInTransitUseCase?: MoveToInTransitUseCase;
  private _moveToDeliveredUseCase?: MoveToDeliveredUseCase;
  private _cancelShipmentUseCase?: CancelShipmentUseCase;
  private _initiateReturnUseCase?: InitiateReturnUseCase;
  private _completeReturnUseCase?: CompleteReturnUseCase;
  private _initiateExchangeUseCase?: InitiateExchangeUseCase;
  private _completeExchangeUseCase?: CompleteExchangeUseCase;

  // Controllers
  private _shipmentController?: ShipmentController;

  private constructor() {}

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  // ==================== REPOSITORIES ====================

  get eventStoreRepository(): EventStoreRepository {
    if (!this._eventStoreRepository) {
      this._eventStoreRepository = new EventStoreRepository();
    }
    return this._eventStoreRepository;
  }

  get projectionRepository(): ShipmentProjectionRepository {
    if (!this._projectionRepository) {
      this._projectionRepository = new ShipmentProjectionRepository();
    }
    return this._projectionRepository;
  }

  get shipmentRepository(): ShipmentRepository {
    if (!this._shipmentRepository) {
      this._shipmentRepository = new ShipmentRepository(
        this.eventStoreRepository,
        this.projectionRepository
      );
    }
    return this._shipmentRepository;
  }

  // ==================== MESSAGING ====================

  get rabbitMqPublisher(): RabbitMqPublisher {
    if (!this._rabbitMqPublisher) {
      this._rabbitMqPublisher = new RabbitMqPublisher();
    }
    return this._rabbitMqPublisher;
  }

  // ==================== MIDDLEWARE ====================

  get authMiddleware(): JwtAuthMiddleware {
    if (!this._authMiddleware) {
      this._authMiddleware = new JwtAuthMiddleware(config.jwt.secret);
    }
    return this._authMiddleware;
  }

  // ==================== USE CASES ====================

  get createShipmentUseCase(): CreateShipmentUseCase {
    if (!this._createShipmentUseCase) {
      this._createShipmentUseCase = new CreateShipmentUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._createShipmentUseCase;
  }

  get moveToPreparedUseCase(): MoveToPreparedUseCase {
    if (!this._moveToPreparedUseCase) {
      this._moveToPreparedUseCase = new MoveToPreparedUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._moveToPreparedUseCase;
  }

  get moveToInTransitUseCase(): MoveToInTransitUseCase {
    if (!this._moveToInTransitUseCase) {
      this._moveToInTransitUseCase = new MoveToInTransitUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._moveToInTransitUseCase;
  }

  get moveToDeliveredUseCase(): MoveToDeliveredUseCase {
    if (!this._moveToDeliveredUseCase) {
      this._moveToDeliveredUseCase = new MoveToDeliveredUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._moveToDeliveredUseCase;
  }

  get cancelShipmentUseCase(): CancelShipmentUseCase {
    if (!this._cancelShipmentUseCase) {
      this._cancelShipmentUseCase = new CancelShipmentUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._cancelShipmentUseCase;
  }

  get initiateReturnUseCase(): InitiateReturnUseCase {
    if (!this._initiateReturnUseCase) {
      this._initiateReturnUseCase = new InitiateReturnUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._initiateReturnUseCase;
  }

  get completeReturnUseCase(): CompleteReturnUseCase {
    if (!this._completeReturnUseCase) {
      this._completeReturnUseCase = new CompleteReturnUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._completeReturnUseCase;
  }

  get initiateExchangeUseCase(): InitiateExchangeUseCase {
    if (!this._initiateExchangeUseCase) {
      this._initiateExchangeUseCase = new InitiateExchangeUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._initiateExchangeUseCase;
  }

  get completeExchangeUseCase(): CompleteExchangeUseCase {
    if (!this._completeExchangeUseCase) {
      this._completeExchangeUseCase = new CompleteExchangeUseCase(
        this.shipmentRepository,
        this.rabbitMqPublisher
      );
    }
    return this._completeExchangeUseCase;
  }

  // ==================== CONTROLLERS ====================

  get shipmentController(): ShipmentController {
    if (!this._shipmentController) {
      this._shipmentController = new ShipmentController(
        this.createShipmentUseCase,
        this.moveToPreparedUseCase,
        this.moveToInTransitUseCase,
        this.moveToDeliveredUseCase,
        this.cancelShipmentUseCase,
        this.initiateReturnUseCase,
        this.completeReturnUseCase,
        this.initiateExchangeUseCase,
        this.completeExchangeUseCase,
        this.projectionRepository,
        this.eventStoreRepository
      );
    }
    return this._shipmentController;
  }

  /**
   * Limpia todas las instancias (útil para testing)
   */
  reset(): void {
    this._eventStoreRepository = undefined;
    this._projectionRepository = undefined;
    this._shipmentRepository = undefined;
    this._rabbitMqPublisher = undefined;
    this._authMiddleware = undefined;
    this._createShipmentUseCase = undefined;
    this._moveToPreparedUseCase = undefined;
    this._moveToInTransitUseCase = undefined;
    this._moveToDeliveredUseCase = undefined;
    this._cancelShipmentUseCase = undefined;
    this._initiateReturnUseCase = undefined;
    this._completeReturnUseCase = undefined;
    this._initiateExchangeUseCase = undefined;
    this._completeExchangeUseCase = undefined;
    this._shipmentController = undefined;
  }
}