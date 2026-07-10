// src/application/usecases/InitiateReturnUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface InitiateReturnCommand {
  shipmentId: string;
  reason?: string;
  actor?: string;
  description?: string;
}

/**
 * CU - Iniciar Devolución - Reembolso
 * Actor: Cliente / Sistema
 * 
 * Descripción: El cliente solicita devolver el producto para obtener un reembolso.
 * Se crea un registro de devolución con estado "En Devolución".
 * El producto está en tránsito del cliente al almacén del ecommerce.
 * 
 * RESTRICCIÓN: Solo se puede iniciar desde estado DELIVERED
 * 
 * Estado cambia: DELIVERED → RETURNING
 * Evento: RETURN_INITIATED
 * Se notifica a Orders y Stats
 */
export class InitiateReturnUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: InitiateReturnCommand): Promise<Shipment> {
    console.log(`↩️ Iniciando devolución para envío ${command.shipmentId}`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar agregado desde eventos
    const shipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar que esté entregado
    this.validateCanInitiateReturn(shipment);

    // 4. Construir descripción con razón
    const description = this.buildDescription(command);

    // 5. Ejecutar lógica de dominio
    shipment.initiateReturn(
      command.actor || "customer",
      description
    );

    // 6. Guardar cambios
    await this.shipmentRepository.save(shipment);

    // 7. Publicar evento RETURN_INITIATED (alta prioridad)
    try {
      await this.rabbitMqPublisher.publishReturnInitiated(shipment);
      console.log(`✅ Evento RETURN_INITIATED publicado a Orders y Stats`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
    }

    console.log(`✅ Devolución iniciada para envío ${command.shipmentId}`);
    console.log(`ℹ️ El producto está en tránsito del cliente al almacén`);
    console.log(`ℹ️ Una vez recibido y verificado, se completará la devolución`);
    
    return shipment;
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: InitiateReturnCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }

    if (command.reason && command.reason.length > 500) {
      throw new Error("La razón de devolución no puede exceder 500 caracteres");
    }
  }

  /**
   * Valida que se pueda iniciar devolución
   */
  private validateCanInitiateReturn(shipment: Shipment): void {
    if (!shipment.status.isDelivered()) {
      throw new Error(
        `No se puede iniciar devolución desde estado ${shipment.status.value}. ` +
        `Solo se puede iniciar devolución cuando el envío está DELIVERED. ` +
        `Estado actual: ${shipment.status.value}`
      );
    }

    console.log(`✅ El envío está entregado y se puede iniciar devolución`);
  }

  /**
   * Construye la descripción incluyendo la razón
   */
  private buildDescription(command: InitiateReturnCommand): string {
    const timestamp = new Date().toISOString();
    
    if (command.description) {
      return command.description;
    }

    if (command.reason) {
      return `Devolución iniciada el ${timestamp}. Razón: ${command.reason}`;
    }

    return `Devolución para reembolso iniciada el ${timestamp}`;
  }

  /**
   * Verifica si un envío puede iniciar devolución
   */
  async canInitiateReturn(shipmentId: string): Promise<boolean> {
    try {
      const shipment = await this.shipmentRepository.findById(shipmentId);
      
      if (!shipment) {
        return false;
      }

      return shipment.status.isDelivered();
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene información del envío para validación antes de iniciar devolución
   */
  async getReturnInfo(shipmentId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findById(shipmentId);
    
    if (!shipment) {
      throw new Error(`Envío no encontrado: ${shipmentId}`);
    }

    return {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      canReturn: shipment.status.isDelivered(),
      customerInfo: shipment.customerInfo,
      articles: shipment.articles,
      deliveredAt: shipment.tracking.find(t => t.status === "DELIVERED")?.timestamp
    };
  }
}