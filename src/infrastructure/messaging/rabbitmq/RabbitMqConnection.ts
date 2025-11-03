import amqp from "amqplib";
import type { Connection, Channel } from "amqplib";

export class RabbitMqConnection {
  private static instance: RabbitMqConnection;
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;

  private constructor(exchange: string) {
    this.exchange = exchange;
  }

  static getInstance(exchange: string = "ecommerce_events"): RabbitMqConnection {
    if (!RabbitMqConnection.instance) {
      RabbitMqConnection.instance = new RabbitMqConnection(exchange);
    }
    return RabbitMqConnection.instance;
  }

  async connect(url: string): Promise<void> {
    if (this.connection) {
      console.log("RabbitMQ ya está conectado");
      return;
    }

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, "topic", { durable: true });

      console.log(`Conectado a RabbitMQ - Exchange: ${this.exchange}`);

      this.connection.on("error", (err) => {
        console.error("Error en conexión RabbitMQ:", err);
      });

      this.connection.on("close", () => {
        console.log("Conexión RabbitMQ cerrada");
      });
    } catch (error) {
      console.error("Error al conectar a RabbitMQ:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      console.log("RabbitMQ desconectado");
    } catch (error) {
      console.error("Error al desconectar RabbitMQ:", error);
    }
  }

  getChannel(): Channel {
    if (!this.channel) {
      throw new Error("RabbitMQ no está conectado. Llama a connect() primero.");
    }
    return this.channel;
  }

  getExchange(): string {
    return this.exchange;
  }

  async assertQueue(queueName: string, routingKey: string): Promise<void> {
    const channel = this.getChannel();
    
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, this.exchange, routingKey);
    console.log(`Cola ${queueName} vinculada con routing key: ${routingKey}`);
  }

  async publish(routingKey: string, message: any): Promise<void> {
    const channel = this.getChannel();
    
    const content = Buffer.from(JSON.stringify(message));
    channel.publish(this.exchange, routingKey, content, {
      persistent: true,
      contentType: "application/json"
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.connection !== null && this.channel !== null;
    } catch {
      return false;
    }
  }
}