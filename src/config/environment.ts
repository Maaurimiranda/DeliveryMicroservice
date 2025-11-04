import dotenv from "dotenv";

dotenv.config(); // Cargar variables de entorno desde .env

// Configuración de la aplicación
export const config = {
  server: {
    port: parseInt(process.env.PORT || "3005"),
    nodeEnv: process.env.NODE_ENV || "development"
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/delivery_service",
    dbName: process.env.MONGODB_DB_NAME || "delivery_service"
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
    exchange: process.env.RABBITMQ_EXCHANGE || "ecommerce_events",
    queues: {
      paymentApproved: process.env.RABBITMQ_QUEUE_PAYMENT_APPROVED || "delivery.payment_approved",
      orderRefund: process.env.RABBITMQ_QUEUE_ORDER_REFUND || "delivery.order_refund",
      logout: process.env.RABBITMQ_QUEUE_LOGOUT || "delivery.logout"
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET || "ecb6d3479ac3823f1da7f314d871989b"
  },
  services: {
    authUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3000",
    ordersUrl: process.env.ORDERS_SERVICE_URL || "http://localhost:3004"
  }
};





