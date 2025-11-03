// src/infrastructure/messaging/consumers/PaymentApprovedConsumer.ts

import { RabbitMqConsumer } from "../rabbitmq/RabbitMqConsumer";
import { CreateShipmentUseCase } from "../../../application/usecases/CreateShipmentUseCase";
import { CustomerInfo, Article } from "../../../domain/shipment/ShipmentEvent";

export interface PaymentApprovedMessage {
  type: string;
  orderId: string;
  customerId?: string;
  customerInfo?: CustomerInfo;
  articles: Article[];
  paymentMethod?: string;
  totalAmount?: number;
  timestamp?: string;
  address?: string;
}

export class PaymentApprovedConsumer extends RabbitMqConsumer {
  constructor(
    private readonly createShipmentUseCase: CreateShipmentUseCase,
    queueName: string = "delivery.payment_approved"
  ) {
    super(queueName, "order.payment.approved");
  }

  protected async processMessage(content: any): Promise<void> {
    console.log("📥 Procesando PAYMENT_APPROVED:", {
      orderId: content.orderId,
      customerId: content.customerId || content.customerInfo?.customerId
    });

    // Validar mensaje
    this.validateMessage(content);

    // Mapear customerInfo
    const customerInfo = this.mapCustomerInfo(content);

    // Mapear articles
    const articles = this.mapArticles(content.articles);

    // Crear envío
    try {
      const shipment = await this.createShipmentUseCase.execute({
        orderId: content.orderId,
        customerInfo,
        articles,
        actor: "system",
        description: `Envío creado automáticamente desde pago aprobado el ${new Date().toISOString()}`
      });

      console.log(`✅ Envío ${shipment.id} creado exitosamente desde PAYMENT_APPROVED`);

    } catch (error: any) {
      console.error(`❌ Error al crear envío desde PAYMENT_APPROVED:`, error);
      throw error; // Re-lanzar para que el consumer maneje reintentos
    }
  }

  /**
   * Valida que el mensaje tenga los campos requeridos
   */
  private validateMessage(content: any): void {
    if (!content.orderId) {
      throw new Error("Mensaje inválido: falta campo 'orderId'");
    }

    if (!content.articles || !Array.isArray(content.articles)) {
      throw new Error("Mensaje inválido: falta campo 'articles' o no es un array");
    }

    if (content.articles.length === 0) {
      throw new Error("Mensaje inválido: 'articles' está vacío");
    }

    // Validar que tenga información del cliente
    const hasCustomerInfo = content.customerInfo || 
                           (content.customerId && content.address);

    if (!hasCustomerInfo) {
      throw new Error("Mensaje inválido: falta información del cliente");
    }
  }

  /**
   * Mapea la información del cliente desde diferentes formatos
   */
  private mapCustomerInfo(content: PaymentApprovedMessage): CustomerInfo {
    // Si viene customerInfo completo, usarlo
    if (content.customerInfo) {
      return {
        customerId: content.customerInfo.customerId,
        name: content.customerInfo.name || "Cliente",
        address: content.customerInfo.address,
        city: content.customerInfo.city || "Ciudad",
        zipCode: content.customerInfo.zipCode || "0000",
        phone: content.customerInfo.phone || "Sin teléfono"
      };
    }

    // Si viene en formato legacy
    return {
      customerId: content.customerId || "unknown",
      name: "Cliente", // Se podría obtener del servicio de Auth
      address: content.address || "Dirección no especificada",
      city: "Ciudad", // Se podría parsear de address
      zipCode: "0000",
      phone: "Sin teléfono"
    };
  }

  /**
   * Mapea los artículos asegurando formato correcto
   */
  private mapArticles(articles: any[]): Article[] {
    return articles.map((art, index) => {
      // Validar cada artículo
      if (!art.articleId && !art.id) {
        throw new Error(`Artículo ${index + 1} no tiene ID`);
      }

      if (art.quantity === undefined || art.quantity === null) {
        throw new Error(`Artículo ${index + 1} no tiene quantity`);
      }

      if (art.price === undefined || art.price === null) {
        throw new Error(`Artículo ${index + 1} no tiene price`);
      }

      return {
        articleId: art.articleId || art.id,
        quantity: Number(art.quantity),
        price: Number(art.price)
      };
    });
  }

  /**
   * Manejo especial de errores para este consumer
   */
  protected async handleFailedMessage(msg: any, error: Error): Promise<void> {
    await super.handleFailedMessage(msg, error);

    // Aquí se podría notificar al servicio de Orders sobre el fallo
    console.error(`💀 PAYMENT_APPROVED fallido definitivamente:`, {
      orderId: msg.orderId,
      error: error.message
    });

    // TODO: Publicar evento SHIPPING_ERROR a Orders
  }
}