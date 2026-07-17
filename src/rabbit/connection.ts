import amqp from "amqplib";
import { env } from "../tools/environment.js";

// Tipos inferidos de amqplib para evitar fricción con @types/amqplib 0.10.x.
type RabbitConnection = Awaited<ReturnType<typeof amqp.connect>>;
type RabbitChannel = Awaited<ReturnType<RabbitConnection["createChannel"]>>;

let connection: RabbitConnection | null = null;
let channel: RabbitChannel | null = null;

// Conecta a RabbitMQ y asegura el exchange topic propio de publicación (shipping_events).
export async function connectRabbit(): Promise<void> {
  if (connection) return;

  connection = await amqp.connect(env.rabbitUrl);
  channel = await connection.createChannel();
  await channel.assertExchange(env.rabbitExchange, "topic", { durable: true });
  console.log(`Conectado a RabbitMQ - Exchange: ${env.rabbitExchange}`);
}

// Devuelve el canal conectado. Lanza si aún no se conectó.
export function getChannel(): RabbitChannel {
  if (!channel) {
    throw new Error("RabbitMQ no está conectado. Llamá a connectRabbit() primero.");
  }
  return channel;
}

export async function closeRabbit(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
  console.log("RabbitMQ desconectado");
}
