// src/application/usecases/InitiateExchangeUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { Article } from "../../domain/shipment/ShipmentEvent";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface InitiateExchangeCommand {
  shipmentId: string;
  newArticles?: Article[]; // Artículos del nuevo envío (opcional, por defecto los mismos)
  reason?: string;
  actor?: string;
  description?: string;
}

export interface ExchangeResult {
  originalShipment: Shipment;
  newShipment: Shipment;
}

/**
 * CU - Iniciar Cambio de Producto
 * Actor: Cliente / Sistema
 * 
 * Descripción: El cliente solicita cambiar un producto.
 * Se crea un registro de cambio. El producto original viaja del cliente
 * al almacén, mientras que simultáneamente se prepara un nuevo envío
 * con el producto de cambio.
 * 
 * Se crean DOS procesos paralelos:
 * 1. Envío original: DELIVERED → RETURNING → EXCHANGE_PROCESSED
 * 2. Nuevo envío: Se crea con tipo EXCHANGE en estado PENDING
 * 
 * Ambos envíos están vinculados mediante relatedShipmentId
 * 
 * RESTRICCIÓN: Solo se puede iniciar desde estado DELIVERED o RETURNING
 * 
 * Eventos: EXCHANGE_INITIATED (original), EXCHANGE_COMPLETED (nuevo)
 */
export class InitiateExchangeUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: InitiateExchangeCommand): Promise<ExchangeResult> {
    console.log(`🔄 Iniciando cambio de producto para envío ${command.shipmentId}`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar envío original desde eventos
    const originalShipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar que se pueda iniciar cambio
    this.validateCanInitiateExchange(originalShipment);

    // 4. Si el envío original está DELIVERED, moverlo primero a RETURNING
    if (originalShipment.status.isDelivered()) {
      console.log(`ℹ️ Moviendo envío original a RETURNING antes del cambio`);
      originalShipment.initiateReturn(
        command.actor || "customer",
        `Devolución iniciada para cambio de producto`
      );
      await this.shipmentRepository.save(originalShipment);
    }

    // 5. Generar ID para el nuevo envío
    const newShipmentId = this.generateShipmentId();

    // 6. Determinar artículos del nuevo envío
    const newArticles = command.newArticles || originalShipment.articles;
    
    // Validar los nuevos artículos
    ShipmentValidator.validateArticles(newArticles);

    // 7. Marcar envío original como EXCHANGE_PROCESSED
    const description = this.buildDescription(command, newShipmentId);
    originalShipment.initiateExchange(
      newShipmentId,
      command.actor || "customer",
      description
    );

    // 8. Crear nuevo envío tipo EXCHANGE
    const newShipment = Shipment.createForExchange(
      newShipmentId,
      originalShipment.orderId,
      command.shipmentId,
      originalShipment.customerInfo,
      newArticles,
      command.actor || "system",
      `Nuevo envío de cambio creado desde ${command.shipmentId}`
    );

    // 9. Guardar ambos envíos
    await this.shipmentRepository.save(originalShipment);
    await this.shipmentRepository.save(newShipment);

    // 10. Publicar eventos
    try {
      // Evento del envío original
      await this.rabbitMqPublisher.publishExchangeInitiated(originalShipment, newShipmentId);
      console.log(`✅ Evento EXCHANGE_INITIATED publicado`);

      // Evento del nuevo envío
      await this.rabbitMqPublisher.publishExchangeCompleted(newShipment, command.shipmentId);
      console.log(`✅ Evento EXCHANGE_COMPLETED publicado`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar eventos:`, error.message);
    }

    console.log(`✅ Cambio de producto iniciado exitosamente`);
    console.log(`   Envío original: ${command.shipmentId} → EXCHANGE_PROCESSED`);
    console.log(`   Nuevo envío: ${newShipmentId} → PENDING (tipo EXCHANGE)`);
    console.log(`ℹ️ Ambos envíos están vinculados`);
    
    return {
      originalShipment,
      newShipment
    };
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: InitiateExchangeCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }

    if (command.reason && command.reason.length > 500) {
      throw new Error("La razón del cambio no puede exceder 500 caracteres");
    }

    if (command.newArticles) {
      ShipmentValidator.validateArticles(command.newArticles);
    }
  }

  /**
   * Valida que se pueda iniciar cambio
   */
  private validateCanInitiateExchange(shipment: Shipment): void {
    const canExchange = shipment.status.isDelivered() || shipment.status.isReturning();

    if (!canExchange) {
      throw new Error(
        `No se puede iniciar cambio desde estado ${shipment.status.value}. ` +
        `Solo se puede iniciar cambio cuando el envío está DELIVERED o RETURNING. ` +
        `Estado actual: ${shipment.status.value}`
      );
    }

    console.log(`✅ El envío puede iniciar proceso de cambio (estado: ${shipment.status.value})`);
  }

  /**
   * Construye la descripción del cambio
   */
  private buildDescription(command: InitiateExchangeCommand, newShipmentId: string): string {
    const timestamp = new Date().toISOString();
    
    if (command.description) {
      return command.description;
    }

    let desc = `Cambio de producto iniciado el ${timestamp}. Nuevo envío: ${newShipmentId}`;

    if (command.reason) {
      desc += `. Razón: ${command.reason}`;
    }

    return desc;
  }

  /**
   * Genera un ID único para el nuevo envío
   */
  private generateShipmentId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `ship_${timestamp}_${random}`;
  }

  /**
   * Verifica si un envío puede iniciar cambio
   */
  async canInitiateExchange(shipmentId: string): Promise<boolean> {
    try {
      const shipment = await this.shipmentRepository.findById(shipmentId);
      
      if (!shipment) {
        return false;
      }

      return shipment.status.isDelivered() || shipment.status.isReturning();
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene información del envío para cambio
   */
  async getExchangeInfo(shipmentId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findById(shipmentId);
    
    if (!shipment) {
      throw new Error(`Envío no encontrado: ${shipmentId}`);
    }

    return {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      canExchange: shipment.status.isDelivered() || shipment.status.isReturning(),
      customerInfo: shipment.customerInfo,
      articles: shipment.articles,
      deliveredAt: shipment.tracking.find(t => t.status === "DELIVERED")?.timestamp
    };
  }
}