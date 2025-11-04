import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/environment";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { connectRabbitMq, disconnectRabbitMq } from "./config/rabbitmq";

// Dependency Injection
import { DependencyContainer } from "./infrastructure/di/DependencyContainer";

// Routes
import { ShipmentRoutes } from "./interfaces/http/routes/shipment.routes";

// Middlewares
import { errorHandler, notFoundHandler, requestLogger } from "./interfaces/http/middlewares/errorHandler";

// Consumers
import { PaymentApprovedConsumer } from "./infrastructure/messaging/consumers/PaymentApprovedConsumer";
import { OrderRefundConsumer } from "./infrastructure/messaging/consumers/OrderRefundConsumer";
import { LogoutConsumer } from "./infrastructure/messaging/consumers/LogoutConsumer";

class Server {
  private app: Application;
  private container: DependencyContainer;
  private consumers: {
    paymentApproved?: PaymentApprovedConsumer;
    orderRefund?: OrderRefundConsumer;
    logout?: LogoutConsumer;
  } = {};

  constructor() {
    this.app = express();
    this.container = DependencyContainer.getInstance();
    this.setupMiddlewares();
  }

  /**
   * Configura middlewares globales
   */
  private setupMiddlewares(): void {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging (solo en desarrollo)
    if (config.server.nodeEnv === "development") {
      this.app.use(requestLogger);
    }
  }

  /**
   * Configura todas las rutas de la aplicación
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        service: "Delivery Service",
        timestamp: new Date().toISOString(),
        environment: config.server.nodeEnv
      });
    });

    // API Routes
    const shipmentRoutes = new ShipmentRoutes(
      this.container.shipmentController,
      this.container.authMiddleware
    );
    
    this.app.use("/api/shipments", shipmentRoutes.getRouter());

    // Error handlers (deben ir al final)
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  // Configura e inicia los consumers de RabbitMQ
  private async setupConsumers(): Promise<void> {
    console.log("Iniciando consumers de RabbitMQ...");

    // Payment Approved Consumer
    this.consumers.paymentApproved = new PaymentApprovedConsumer(
      this.container.createShipmentUseCase,
      config.rabbitmq.queues.paymentApproved
    );
    await this.consumers.paymentApproved.start();

    // Order Refund Consumer
    this.consumers.orderRefund = new OrderRefundConsumer(
      this.container.projectionRepository,
      this.container.eventStoreRepository,
      config.rabbitmq.queues.orderRefund
    );
    await this.consumers.orderRefund.start();

    // Logout Consumer
    this.consumers.logout = new LogoutConsumer(
      config.rabbitmq.queues.logout
    );
    await this.consumers.logout.start();

    console.log("Consumers iniciados correctamente");
  }

  // Inicia el servidor
  async start(): Promise<void> {
    try {
      // 1. Conectar a MongoDB
      console.log("Conectando a MongoDB...");
      await connectDatabase();
      console.log("MongoDB conectado");

      // 2. Conectar a RabbitMQ
      console.log("Conectando a RabbitMQ...");
      await connectRabbitMq();
      console.log("RabbitMQ conectado");

      // 3. Setup routes
      console.log("Configurando rutas...");
      this.setupRoutes();
      console.log("Rutas configuradas");

      // 4. Setup consumers
      await this.setupConsumers();

      // 5. Start HTTP server
      this.app.listen(config.server.port, () => {
        this.printServerInfo();
      });

      // 6. Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error("❌ Error al iniciar el servidor:", error);
      process.exit(1);
    }
  }

  /**
   * Imprime información del servidor
   */
  private printServerInfo(): void {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 DELIVERY SERVICE - INICIADO");
    console.log("=".repeat(60));
    console.log(`📍 Puerto:           ${config.server.port}`);
    console.log(`🌍 Entorno:          ${config.server.nodeEnv}`);
    console.log(`🗄️  MongoDB:          ${config.mongodb.dbName}`);
    console.log(`🐰 RabbitMQ:         ${config.rabbitmq.exchange}`);
    console.log(`🔐 JWT Secret:       ${config.jwt.secret ? "✓" : "✗"}`);
    console.log("=".repeat(60));
    console.log(`📡 API disponible en: http://localhost:${config.server.port}`);
    console.log(`💚 Health check:      http://localhost:${config.server.port}/health`);
    console.log("=".repeat(60) + "\n");
  }

  /**
   * Configura el cierre graceful del servidor
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  ${signal} recibido. Cerrando servidor...`);

      try {
        // Cerrar consumers
        console.log("🛑 Cerrando consumers...");
        // Los consumers se cerrarán con RabbitMQ

        // Cerrar RabbitMQ
        console.log("🛑 Cerrando conexión RabbitMQ...");
        await disconnectRabbitMq();

        // Cerrar MongoDB
        console.log("🛑 Cerrando conexión MongoDB...");
        await disconnectDatabase();

        console.log("✅ Servidor cerrado correctamente");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error al cerrar el servidor:", error);
        process.exit(1);
      }
    };

    // Escuchar señales de terminación
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Manejar errores no capturados
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      shutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      shutdown("UNHANDLED_REJECTION");
    });
  }
}

// Iniciar servidor
const server = new Server();
server.start();