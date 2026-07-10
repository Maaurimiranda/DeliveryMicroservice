import { RabbitMqConnection } from "../infrastructure/messaging/rabbitmq/RabbitMqConnection";
import { config } from "./environment";

// Conectar a RabbitMQ
export const connectRabbitMq = async (): Promise<void> => {
  const rabbitMq = RabbitMqConnection.getInstance(config.rabbitmq.exchange);
  await rabbitMq.connect(config.rabbitmq.url);
};

// Desconectar de RabbitMQ
export const disconnectRabbitMq = async (): Promise<void> => {
  const rabbitMq = RabbitMqConnection.getInstance();
  await rabbitMq.disconnect();
};