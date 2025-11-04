// src/infrastructure/messaging/consumers/LogoutConsumer.ts

import { RabbitMqConsumer } from "../rabbitmq/RabbitMqConsumer";

export interface LogoutMessage {
  type: string;
  userId: string;
  token?: string;
  timestamp?: string;
}

/**
 * Consumer para eventos de logout desde Auth Service
 * 
 * Cuando un usuario cierra sesión, este consumer puede:
 * - Invalidar tokens en cache
 * - Registrar el evento para auditoría
 * - Limpiar sesiones activas
 */
export class LogoutConsumer extends RabbitMqConsumer {
  constructor(queueName: string = "delivery.logout") {
    super(queueName, "auth.logout");
  }

  protected async processMessage(content: LogoutMessage): Promise<void> {
    console.log("📥 Procesando LOGOUT:", {
      userId: content.userId,
      timestamp: content.timestamp || new Date().toISOString()
    });

    // Validar mensaje
    this.validateMessage(content);

    try {
      // TODO: Implementar invalidación de token en cache si se usa
      // Por ahora solo registramos el evento
      console.log(`ℹ️ Usuario ${content.userId} cerró sesión`);
      
      // Si tuviéramos cache de tokens:
      // await this.tokenCache.invalidate(content.token);
      
      console.log(`✅ Evento LOGOUT procesado para usuario ${content.userId}`);

    } catch (error: any) {
      console.error(`❌ Error al procesar LOGOUT:`, error);
      throw error;
    }
  }

  /**
   * Valida que el mensaje tenga los campos requeridos
   */
  private validateMessage(content: LogoutMessage): void {
    if (!content.userId) {
      throw new Error("Mensaje inválido: falta campo 'userId'");
    }

    if (!content.type || content.type !== "LOGOUT") {
      console.warn(`⚠️ Mensaje con type inesperado: ${content.type}`);
    }
  }

  /**
   * Manejo especial de errores para este consumer
   */
  protected async handleFailedMessage(msg: any, error: Error): Promise<void> {
    await super.handleFailedMessage(msg, error);

    console.error(`💀 LOGOUT fallido definitivamente:`, {
      userId: msg.userId,
      error: error.message
    });
  }
}