// src/application/usecases/MoveToDeliveredUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface MoveToDeliveredCommand {
  shipmentId: string;
  actor?: string;
  description?: string;
}

/**
 * CU - Pasar a Entregado
 * Actor: Logística / Sistema (Rol Admin)
 * 
 * Descripción: El paquete llega al domicilio del cliente y es entregado.
 * La empresa logística o el cliente confirman la entrega.
 * Estado cambia: IN_TRANSIT → DELIVERED
 * Evento: SHIPPING_DELIVERED
 * 
 * IMPORTANTE: Este es un estado terminal normal.
 * Desde aquí solo se puede iniciar devolución o cambio.
 */
export class MoveToDeliveredUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: MoveToDeliveredCommand): Promise<Shipment> {
    console.log(`📬 Moviendo envío ${command.shipmentId} a DELIVERED`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar agregado desde eventos
    const shipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar estado actual
    this.validateCurrentState(shipment);

    // 4. Ejecutar lógica de dominio
    shipment.moveToDelivered(
      command.actor || "logistics",
      command.description || `Paquete entregado exitosamente el ${new Date().toISOString()}`
    );

    // 5. Guardar cambios
    await this.shipmentRepository.save(shipment);

    // 6. Publicar evento SHIPPING_DELIVERED (prioritario)
    try {
      await this.rabbitMqPublisher.publishShippingDelivered(shipment);
      console.log(`✅ Evento SHIPPING_DELIVERED publicado a Orders y Stats`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
    }

    console.log(`✅ Envío ${command.shipmentId} entregado exitosamente`);
    console.log(`ℹ️ El cliente puede ahora solicitar devolución o cambio si es necesario`);
    
    return shipment;
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: MoveToDeliveredCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }
  }

  /**
   * Valida que el estado actual permita la transición
   */
  private validateCurrentState(shipment: Shipment): void {
    if (!shipment.status.isInTransit()) {
      throw new Error(
        `No se puede mover a DELIVERED desde estado ${shipment.status.value}. ` +
        `El envío debe estar en estado IN_TRANSIT.`
      );
    }

    console.log(`✅ Estado actual válido para transición: ${shipment.status.value}`);
  }
}