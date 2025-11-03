// src/infrastructure/messaging/rabbitmq/RabbitMqConsumer.ts

import { Channel, ConsumeMessage } from "amqplib";
import { RabbitMqConnection } from "./RabbitMqConnection";

export abstract class RabbitMqConsumer {
  protected rabbitMq: RabbitMqConnection;
  protected channel: Channel;
  protected queueName: string;
  protected routingKey: string;

  constructor(queueName: string, routingKey: string) {
    this.rabbitMq = RabbitMqConnection.getInstance();
    this.channel = this.rabbitMq.getChannel();
    this.queueName = queueName;
    this.routingKey = routingKey;
  }

  async start(): Promise<void> {
    await this.rabbitMq.assertQueue(this.queueName, this.routingKey);

    this.channel.consume(
      this.queueName,
      async (msg) => {
        if (msg) {
          await this.handleMessage(msg);
        }
      },
      { noAck: false }
    );

    console.log(`🎧 Consumer escuchando en cola: ${this.queueName}`);
    console.log(`   Routing key: ${this.routingKey}`);
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    try {
      const content = this.parseMessage(msg);
      console.log(`📥 Mensaje recibido en ${this.queueName}:`, content.type || 'unknown');

      await this.processMessage(content);

      this.channel.ack(msg);
      console.log(`✅ Mensaje procesado exitosamente en ${this.queueName}`);
    } catch (error: any) {
      console.error(`❌ Error al procesar mensaje en ${this.queueName}:`, error.message);

      // Estrategia de reintento
      if (this.shouldRetry(msg)) {
        console.log(`🔄 Reintentando mensaje en ${this.queueName}...`);
        this.channel.nack(msg, false, true); // Requeue
      } else {
        console.log(`⛔ Mensaje rechazado en ${this.queueName} (no más reintentos)`);
        this.channel.nack(msg, false, false); // No requeue
        await this.handleFailedMessage(msg, error);
      }
    }
  }

  protected parseMessage(msg: ConsumeMessage): any {
    try {
      return JSON.parse(msg.content.toString());
    } catch (error) {
      throw new Error(`Error al parsear mensaje: ${error}`);
    }
  }

  protected shouldRetry(msg: ConsumeMessage): boolean {
    // Verificar header de reintentos
    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Incrementar contador de reintentos
      msg.properties.headers = msg.properties.headers || {};
      msg.properties.headers['x-retry-count'] = retryCount + 1;
      return true;
    }

    return false;
  }

  protected async handleFailedMessage(msg: ConsumeMessage, error: Error): Promise<void> {
    // Implementar Dead Letter Queue o logging
    console.error(`💀 Mensaje fallido definitivamente:`, {
      queue: this.queueName,
      error: error.message,
      content: msg.content.toString()
    });

    // Aquí podrías enviar a una cola de errores o sistema de alertas
  }

  protected abstract processMessage(content: any): Promise<void>;
}