// src/application/usecases/CreateShipmentUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentEvent, CustomerInfo, Article } from "../../domain/shipment/ShipmentEvent";
import { ShipmentStatus } from "../../domain/shipment/ShipmentStatus";
import { ShipmentType } from "../../domain/shipment/ShipmentType";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface CreateShipmentCommand {
  orderId: string;
  customerInfo: CustomerInfo;
  articles: Article[];
  actor?: string;
  description?: string;
}

/**
 * CU - Registrar Envío
 * Actor: Sistema (Orders Microservicio)
 * Disparador: Evento "PAYMENT_APPROVED" de la orden de compra
 * 
 * Descripción: El sistema recibe la notificación de pago aprobado desde Orders.
 * Se extrae la información del cliente, los artículos de la orden y se crea
 * una nueva entidad Envío con estado "Pendiente a Preparación".
 */
export class CreateShipmentUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: CreateShipmentCommand): Promise<Shipment> {
    console.log(`📦 Creando envío para orden ${command.orderId}`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Generar ID único para el envío
    const shipmentId = this.generateShipmentId();

    // 3. Crear agregado Shipment
    const shipment = new Shipment(
      shipmentId,
      command.orderId,
      command.customerInfo,
      command.articles,
      ShipmentStatus.pending(),
      ShipmentType.normal()
    );

    // 4. Crear evento de creación
    const event = ShipmentEvent.createShipmentCreated(
      shipmentId,
      command.orderId,
      command.customerInfo,
      command.articles,
      command.actor || "system",
      command.description || `Envío creado automáticamente el ${new Date().toISOString()}`
    );

    // 5. Agregar tracking inicial al agregado
    shipment['_tracking'].push({
      status: "PENDING",
      description: event.description || "",
      timestamp: event.occurredOn,
      actor: event.actor
    });

    // 6. Agregar evento al agregado para que se persista
    shipment['_events'].push(event);

    // 7. Guardar (eventos + proyección)
    await this.shipmentRepository.save(shipment);

    // 8. Publicar evento SHIPPING_CREATED a RabbitMQ
    try {
      await this.rabbitMqPublisher.publishShippingCreated(shipment);
      console.log(`✅ Evento SHIPPING_CREATED publicado para envío ${shipmentId}`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar SHIPPING_CREATED:`, error.message);
      // No bloqueamos la creación si falla la publicación
    }

    console.log(`✅ Envío ${shipmentId} creado exitosamente`);
    return shipment;
  }

  /**
   * Valida el comando de creación
   */
  private validateCommand(command: CreateShipmentCommand): void {
    // Validar orderId
    ShipmentValidator.validateOrderId(command.orderId);

    // Validar customerInfo
    ShipmentValidator.validateCustomerInfo(command.customerInfo);

    // Validar articles
    ShipmentValidator.validateArticles(command.articles);

    // Validar description si existe
    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }

    console.log(`✅ Comando de creación validado`);
  }

  /**
   * Genera un ID único para el envío
   */
  private generateShipmentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `ship_${timestamp}_${random}`;
  }

  /**
   * Verifica si ya existe un envío para una orden
   */
  async existsForOrder(orderId: string): Promise<boolean> {
    try {
      const shipments = await this.shipmentRepository.findByOrderId(orderId);
      return shipments.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cuenta envíos por orden
   */
  async countByOrder(orderId: string): Promise<number> {
    try {
      const shipments = await this.shipmentRepository.findByOrderId(orderId);
      return shipments.length;
    } catch (error) {
      return 0;
    }
  }
}