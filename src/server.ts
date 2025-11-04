import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/environment";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { connectRabbitMq, disconnectRabbitMq } from "./config/rabbitmq";

// Repositories
import { EventStoreRepository } from "./infrastructure/persistence/mongodb/EventStoreRepository";
import { ShipmentProjectionRepository } from "./infrastructure/persistence/mongodb/ShipmentProjectionRepository";

// Messaging
import { RabbitMqPublisher } from "./infrastructure/messaging/rabbitmq/RabbitMqPublisher";
import { PaymentApprovedConsumer } from "./infrastructure/messaging/consumers/PaymentApprovedConsumer";
import { OrderRefundConsumer } from "./infrastructure/messaging/consumers/OrderRefundConsumer";
import { LogoutConsumer } from "./infrastructure/messaging/consumers/LogoutConsumer";

// Use Cases
import { CancelShipmentUseCase } from "./application/usecases/CancelShipmentUseCase";
import { CompleteExchangeUseCase } from "./application/usecases/CompleteExchangeUseCase";
import { CompleteReturnUseCase } from "./application/usecases/CompleteReturnUseCase";
import { CreateShipmentUseCase } from "./application/usecases/CreateShipmentUseCase";
import { InitiateExchangeUseCase } from "./application/usecases/InitiateExchangeUseCase";
import { InitiateReturnUseCase } from "./application/usecases/InitiateReturnUseCase";
import { MoveToDeliveredUseCase } from "./application/usecases/MoveToDeliveredUseCase";
import { MoveToInTransitUseCase } from "./application/usecases/MoveToInTransitUseCase";
import { MoveToPreparedUseCase } from "./application/usecases/MoveToPreparedUseCase";

// HTTP Layer
import { ShipmentController } from "./interfaces/http/controllers/ShipmentController";
import { ShipmentRoutes } from "./interfaces/http/routes/shipment.routes";
import { JwtAuthMiddleware } from "./infrastructure/auth/JwtAuthMiddleware";
import { errorHandler, notFoundHandler } from "./interfaces/http/middlewares/errorHandler";

class Server {
  private app: Application;
  private consumers: {
    paymentApproved?: PaymentApprovedConsumer;
    orderRefund?: OrderRefundConsumer;
    logout?: LogoutConsumer;
  } = {};

  constructor() {
    this.app = express();
    this.setupMiddlewares();
  }

  private setupMiddlewares(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        service: "Delivery Service",
        timestamp: new Date().toISOString()
      });
    });

    // Dependency Injection
    const eventStoreRepository = new EventStoreRepository();
    const projectionRepository = new ShipmentProjectionRepository();
    const rabbitMqPublisher = new RabbitMqPublisher();

    // Use Cases
    const createShipmentUseCase = new CreateShipmentUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const moveToPreparedUseCase = new MoveToPreparedUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const moveToInTransitUseCase = new MoveToInTransitUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const moveToDeliveredUseCase = new MoveToDeliveredUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const cancelShipmentUseCase = new CancelShipmentUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const initiateReturnUseCase = new InitiateReturnUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const completeReturnUseCase = new CompleteReturnUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    const initiateExchangeUseCase = new InitiateExchangeUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    // Controller
    const shipmentController = new ShipmentController(
      createShipmentUseCase,
      moveToPreparedUseCase,
      moveToInTransitUseCase,
      moveToDeliveredUseCase,
      cancelShipmentUseCase,
      initiateReturnUseCase,
      completeReturnUseCase,
      initiateExchangeUseCase,
      projectionRepository,
      eventStoreRepository
    );

    // Auth Middleware
    const authMiddleware = new JwtAuthMiddleware(config.jwt.secret);

    // Routes
    const shipmentRoutes = new ShipmentRoutes(shipmentController, authMiddleware);
    this.app.use("/api/shipments", shipmentRoutes.getRouter());

    // Error handlers (deben ir al final)
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private async setupConsumers(): Promise<void> {
    const eventStoreRepository = new EventStoreRepository();
    const projectionRepository = new ShipmentProjectionRepository();
    const rabbitMqPublisher = new RabbitMqPublisher();

    const createShipmentUseCase = new CreateShipmentUseCase(
      eventStoreRepository,
      projectionRepository,
      rabbitMqPublisher
    );

    // Payment Approved Consumer
    this.consumers.paymentApproved = new PaymentApprovedConsumer(
      createShipmentUseCase,
      config.rabbitmq.queues.paymentApproved
    );
    await this.consumers.paymentApproved.start();

    // Order Refund Consumer
    this.consumers.orderRefund = new OrderRefundConsumer(
      config.rabbitmq.queues.orderRefund
    );
    await this.consumers.orderRefund.start();

    // Logout Consumer
    this.consumers.logout = new LogoutConsumer(
      config.rabbitmq.queues.logout
    );
    await this.consumers.logout.start();
  }

  // congigurar y iniciar el servidor
  async start(): Promise<void> {
    try {
      // Conectar a MongoDB
      console.log("🔌 Conectando a MongoDB...");
      await connectDatabase();

      // Conectar a RabbitMQ
      console.log("🔌 Conectando a RabbitMQ...");
      await connectRabbitMq();

      // Setup routes
      this.setupRoutes();

      // Setup consumers
      console.log("🎧 Iniciando consumers...");
      await this.setupConsumers();

      // Start server
      this.app.listen(config.server.port, () => {
        console.log("\n" + "=".repeat(50));
        console.log(`🚀 Delivery Service iniciado`);
        console.log(`📍 Puerto: ${config.server.port}`);
        console.log(`🌍 Entorno: ${config.server.nodeEnv}`);
        console.log(`📊 MongoDB: ${config.mongodb.dbName}`);
        console.log(`🐰 RabbitMQ: ${config.rabbitmq.exchange}`);
        console.log("=".repeat(50) + "\n");
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      console.error("Error al iniciar el servidor:", error);
      process.exit(1);
    }
  }

  // Graceful shutdown - Cerrar conexiones al recibir señales de terminación
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} recibido. Cerrando servidor...`);

      try {
        await disconnectRabbitMq();
        await disconnectDatabase();
        console.log("Servidor cerrado correctamente");
        process.exit(0);
      } catch (error) {
        console.error("Error al cerrar el servidor:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}


// Iniciar servidor
const server = new Server();
server.start();