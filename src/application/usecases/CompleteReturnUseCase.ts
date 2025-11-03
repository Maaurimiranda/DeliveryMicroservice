// src/application/usecases/CompleteReturnUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface CompleteReturnCommand {
  shipmentId: string;
  productCondition?: "good" | "damaged" | "defective";
  notes?: string;
  actor?: string;
  description?: string;
}

/**
 * CU - Completar Devolución
 * Actor: Operario / Sistema
 * 
 * Descripción: El operario verifica que el producto devuelto haya llegado
 * al almacén en buen estado. Se registra la devolución como completada
 * y se procesa el reembolso.
 * 
 * RESTRICCIÓN: Solo se puede completar desde estado RETURNING
 * 
 * Estado cambia: RETURNING → RETURNED
 * Evento: RETURN_COMPLETED
 * Se notifica a Orders para procesar reembolso
 */
export class CompleteReturnUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: CompleteReturnCommand): Promise<Shipment> {
    console.log(`✅ Completando devolución para envío ${command.shipmentId}`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar agregado desde eventos
    const shipment = await this.shipmentRepository.loadById(command.shipmentId);

    // 3. Validar que esté en devolución
    this.validateCanCompleteReturn(shipment);

    // 4. Construir descripción con información de condición
    const description = this.buildDescription(command);

    // 5. Ejecutar lógica de dominio
    shipment.completeReturn(
      command.actor || "warehouse_operator",
      description
    );

    // 6. Guardar cambios
    await this.shipmentRepository.save(shipment);

    // 7. Publicar evento RETURN_COMPLETED (muy alta prioridad)
    try {
      await this.rabbitMqPublisher.publishReturnCompleted(shipment);
      console.log(`✅ Evento RETURN_COMPLETED publicado a Orders para procesar reembolso`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
      // Esto es crítico, podríamos querer lanzar el error
    }

    console.log(`✅ Devolución completada para envío ${command.shipmentId}`);
    console.log(`💰 Orders procesará el reembolso correspondiente`);
    
    return shipment;
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: CompleteReturnCommand): void {
    ShipmentValidator.validateShipmentId(command.shipmentId);

    if (command.description) {
      ShipmentValidator.validateDescription(command.description);
    }

    if (command.notes && command.notes.length > 1000) {
      throw new Error("Las notas no pueden exceder 1000 caracteres");
    }

    if (command.productCondition) {
      const validConditions = ["good", "damaged", "defective"];
      if (!validConditions.includes(command.productCondition)) {
        throw new Error(
          `Condición de producto inválida: ${command.productCondition}. ` +
          `Valores válidos: ${validConditions.join(", ")}`
        );
      }
    }
  }

  /**
   * Valida que se pueda completar la devolución
   */
  private validateCanCompleteReturn(shipment: Shipment): void {
    if (!shipment.status.isReturning()) {
      throw new Error(
        `No se puede completar devolución desde estado ${shipment.status.value}. ` +
        `Solo se puede completar cuando el envío está RETURNING. ` +
        `Estado actual: ${shipment.status.value}`
      );
    }

    console.log(`✅ El envío está en devolución y se puede completar`);
  }

  /**
   * Construye la descripción con información detallada
   */
  private buildDescription(command: CompleteReturnCommand): string {
    const timestamp = new Date().toISOString();
    
    if (command.description) {
      return command.description;
    }

    let desc = `Devolución completada el ${timestamp}`;

    if (command.productCondition) {
      const conditionText = {
        good: "producto en buen estado",
        damaged: "producto dañado",
        defective: "producto defectuoso"
      };
      desc += `. Condición: ${conditionText[command.productCondition]}`;
    }

    if (command.notes) {
      desc += `. Notas: ${command.notes}`;
    }

    return desc;
  }

  /**
   * Verifica si un envío puede completar devolución
   */
  async canCompleteReturn(shipmentId: string): Promise<boolean> {
    try {
      const shipment = await this.shipmentRepository.findById(shipmentId);
      
      if (!shipment) {
        return false;
      }

      return shipment.status.isReturning();
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene información del envío en devolución
   */
  async getReturnDetails(shipmentId: string): Promise<any> {
    const shipment = await this.shipmentRepository.findById(shipmentId);
    
    if (!shipment) {
      throw new Error(`Envío no encontrado: ${shipmentId}`);
    }

    const returnInitiatedEntry = shipment.tracking.find(t => t.status === "RETURNING");

    return {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      canComplete: shipment.status.isReturning(),
      customerInfo: shipment.customerInfo,
      articles: shipment.articles,
      returnInitiatedAt: returnInitiatedEntry?.timestamp,
      returnInitiatedBy: returnInitiatedEntry?.actor
    };
  }
}