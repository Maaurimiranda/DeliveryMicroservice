// src/application/usecases/CancelShipmentUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface CancelShipmentCommand {
  shipmentId: string;
  reason?: string;
  actor?: string;
  description?: string;
}

/**
 * CU - Cancelar Envío
 * Actor: Operario / Sistema (Rol de Admin)
 * 
 * Descripción: Se cancela un envío que aún no ha sido entregado
 * a la empresa logística. Se puede proporcionar un motivo de cancelación.
 * 
 * RESTRICCIÓN: Solo se puede cancelar en estados PENDING o PREPARED.
 * NO se puede cancelar si está IN_TRANSIT o DELIVERED.
 * 
 * Estado cambia: PENDING/PREPARED → CANCELLED
 * Evento: SHIPPING_CANCELLED
 * Se notifica a Orders para que procese reembolso si es necesario
 */
export class CancelShipmentUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: CancelShipmentCommand): Promise<Shipment> {
    console.log(`❌ Cancelando envío ${command.shipmentId}`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar agregado desde eventos
    const shipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar que se pueda cancelar
    this.validateCanBeCancelled(shipment);

    // 4. Construir descripción con razón si existe
    const description = this.buildDescription(command);

    // 5. Ejecutar lógica de dominio
    shipment.cancel(
      command.actor || "admin",
      description
    );

    // 6. Guardar cambios
    await this.shipmentRepository.save(shipment);

    // 7. Publicar evento SHIPPING_CANCELLED (alta prioridad)
    try {
      await this.rabbitMqPublisher.publishShippingCancelled(shipment);
      console.log(`✅ Evento SHIPPING_CANCELLED publicado a Orders para procesar reembolso`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
    }

    console.log(`✅ Envío ${command.shipmentId} cancelado exitosamente`);
    console.log(`ℹ️ Orders procesará el reembolso correspondiente`);
    
    return shipment;
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: CancelShipmentCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }

    if (command.reason && command.reason.length > 500) {
      throw new Error("La razón de cancelación no puede exceder 500 caracteres");
    }
  }

  /**
   * Valida que el envío se pueda cancelar
   */
  private validateCanBeCancelled(shipment: Shipment): void {
    if (!shipment.status.canBeCancelled()) {
      throw new Error(
        `No se puede cancelar el envío en estado ${shipment.status.value}. ` +
        `Solo se puede cancelar en estados PENDING o PREPARED. ` +
        `Si el envío está en tránsito o entregado, debe gestionarse como devolución.`
      );
    }

    console.log(`✅ El envío puede ser cancelado (estado: ${shipment.status.value})`);
  }

  /**
   * Construye la descripción incluyendo la razón si existe
   */
  private buildDescription(command: CancelShipmentCommand): string {
    const timestamp = new Date().toISOString();
    
    if (command.description) {
      return command.description;
    }

    if (command.reason) {
      return `Envío cancelado el ${timestamp}. Razón: ${command.reason}`;
    }

    return `Envío cancelado el ${timestamp}`;
  }

  /**
   * Verifica si un envío puede ser cancelado (sin cargarlo completo)
   */
  async canBeCancelled(shipmentId: string): Promise<boolean> {
    try {
      const shipment = await this.shipmentRepository.findById(shipmentId);
      
      if (!shipment) {
        return false;
      }

      return shipment.status.canBeCancelled();
    } catch (error) {
      return false;
    }
  }
}