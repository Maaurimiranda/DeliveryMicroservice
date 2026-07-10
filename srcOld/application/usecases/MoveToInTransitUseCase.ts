// src/application/usecases/MoveToInTransitUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface MoveToInTransitCommand {
  shipmentId: string;
  actor?: string;
  description?: string;
}

/**
 * CU - Pasar a En Camino
 * Actor: Empresa Logística / Sistema (Rol Admin)
 * 
 * Descripción: La empresa logística retira el paquete del almacén
 * y comienza el viaje hacia el domicilio del cliente.
 * Estado cambia: PREPARED → IN_TRANSIT
 * Evento: SHIPPING_IN_TRANSIT
 * 
 * IMPORTANTE: Una vez en este estado, NO se puede cancelar
 */
export class MoveToInTransitUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: MoveToInTransitCommand): Promise<Shipment> {
    console.log(`🚚 Moviendo envío ${command.shipmentId} a IN_TRANSIT`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar agregado desde eventos
    const shipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar estado actual
    this.validateCurrentState(shipment);

    // 4. Ejecutar lógica de dominio
    shipment.moveToInTransit(
      command.actor || "logistics",
      command.description || `Paquete retirado por logística y en camino el ${new Date().toISOString()}`
    );

    // 5. Guardar cambios
    await this.shipmentRepository.save(shipment);

    // 6. Publicar evento SHIPPING_STATE_CHANGED
    try {
      await this.rabbitMqPublisher.publishShippingStateChanged(shipment, "MOVED_TO_IN_TRANSIT");
      console.log(`✅ Evento SHIPPING_STATE_CHANGED publicado`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
    }

    console.log(`✅ Envío ${command.shipmentId} movido a IN_TRANSIT exitosamente`);
    console.log(`⚠️ El envío ya NO puede ser cancelado`);
    
    return shipment;
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: MoveToInTransitCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }
  }

  /**
   * Valida que el estado actual permita la transición
   */
  private validateCurrentState(shipment: Shipment): void {
    if (!shipment.status.isPrepared()) {
      throw new Error(
        `No se puede mover a IN_TRANSIT desde estado ${shipment.status.value}. ` +
        `El envío debe estar en estado PREPARED.`
      );
    }

    console.log(`✅ Estado actual válido para transición: ${shipment.status.value}`);
  }
}