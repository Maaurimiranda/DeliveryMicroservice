import dotenv from "dotenv";

dotenv.config();

// Configuración leída de variables de entorno, con defaults para desarrollo local.
export const env = {
  port: parseInt(process.env.PORT ?? "3005", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/delivery_service",
  mongoDbName: process.env.MONGODB_DB_NAME ?? "delivery_service",
  rabbitUrl: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
  rabbitExchange: process.env.RABBITMQ_EXCHANGE ?? "ecommerce_events",
  jwtSecret: process.env.JWT_SECRET,
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? "http://localhost:3000",
  ordersServiceUrl: process.env.ORDERS_SERVICE_URL ?? "http://localhost:3004",
};
