import dotenv from "dotenv";

dotenv.config(); // Cargar variables de entorno desde .env

// Configuración de la aplicación
export const config = {
  server: {
    port: parseInt(process.env.PORT || "3003"),
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
    secret: process.env.JWT_SECRET || "dajhdauhuawdJFHAJoinJUHDOjhdUHDauohd"
  },
  services: {
    authUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3000",
    ordersUrl: process.env.ORDERS_SERVICE_URL || "http://localhost:3001"
  }
};

// Validar variables críticas
export const validateConfig = (): void => {
  const requiredEnvVars = [
    "JWT_SECRET",
    "MONGODB_URI",
    "RABBITMQ_URL"
  ];

  // Verificar si faltan variables de entorno
  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName as keyof NodeJS.ProcessEnv]
  );

  // Mostrar aviso si faltan variables de entorno
  if (missingVars.length > 0) {
    console.warn(
      `Variables de entorno faltantes: ${missingVars.join(", ")}`
    );
    console.warn("Usando valores por defecto (no recomendado para producción)");
  }

  // Validar variables de entorno críticas - la clave JWT no debe ser la predeterminada en producción
  if (config.server.nodeEnv === "production" && config.jwt.secret === "your_jwt_secret_change_this") {
    throw new Error("JWT_SECRET debe configurarse en producción");
  }
};




