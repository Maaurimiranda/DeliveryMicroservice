// src/application/usecases/MoveToPreparedUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface MoveToPreparedCommand {
  shipmentId: string;
  actor?: string;
  description?: string;
}

/**
 * CU - Pasar a Preparado
 * Actor: Operario de Almacén / Sistema (Rol Admin)
 * 
 * Descripción: El operario de almacén confirma que todos los artículos
 * de la orden han sido empaquetados correctamente y están listos para
 * ser retirados por la empresa logística.
 * Estado cambia: PENDING → PREPARED
 * Evento: SHIPPING_PREPARED
 */
export class MoveToPreparedUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: MoveToPreparedCommand): Promise<Shipment> {
    console.log(`📦 Moviendo envío ${command.shipmentId} a PREPARED`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar agregado desde eventos (fuente de verdad)
    const shipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar estado actual
    this.validateCurrentState(shipment);

    // 4. Ejecutar lógica de dominio
    shipment.moveToPrepared(
      command.actor || "admin",
      command.description || `Paquete preparado y listo para retiro el ${new Date().toISOString()}`
    );

    // 5. Guardar cambios (eventos + proyección)
    await this.shipmentRepository.save(shipment);

    // 6. Publicar evento SHIPPING_STATE_CHANGED
    try {
      await this.rabbitMqPublisher.publishShippingStateChanged(shipment, "MOVED_TO_PREPARED");
      console.log(`✅ Evento SHIPPING_STATE_CHANGED publicado`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
    }

    console.log(`✅ Envío ${command.shipmentId} movido a PREPARED exitosamente`);
    return shipment;
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: MoveToPreparedCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }
  }

  /**
   * Valida que el estado actual permita la transición
   */
  private validateCurrentState(shipment: Shipment): void {
    if (!shipment.status.isPending()) {
      throw new Error(
        `No se puede mover a PREPARED desde estado ${shipment.status.value}. ` +
        `El envío debe estar en estado PENDING.`
      );
    }

    console.log(`✅ Estado actual válido para transición: ${shipment.status.value}`);
  }
}