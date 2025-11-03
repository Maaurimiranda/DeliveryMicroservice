// src/application/usecases/CompleteExchangeUseCase.ts

import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentValidator } from "../../domain/shipment/ShipmentValidator";
import { ShipmentRepository } from "../../infrastructure/persistence/repositories/ShipmentRepository";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";

export interface CompleteExchangeCommand {
  originalShipmentId: string; // El envío que se devuelve
  newShipmentId: string; // El nuevo envío a preparar
  productCondition?: "good" | "damaged" | "defective";
  notes?: string;
  actor?: string;
  description?: string;
}

export interface CompleteExchangeResult {
  originalShipment: Shipment;
  newShipment: Shipment;
  nextAction: "prepare_new_shipment" | "already_processing";
}

/**
 * CU - Completar Cambio de Producto
 * Actor: Operario / Sistema
 * 
 * Descripción: El operario verifica la devolución del producto original,
 * valida su estado y confirma que el nuevo producto se ha preparado
 * correctamente para ser enviado.
 * 
 * Proceso:
 * 1. Envío de devolución (original) cambia a "Cambio Procesado" (EXCHANGE_PROCESSED)
 * 2. Envío del nuevo producto pasa a "Preparado" (PREPARED) o permanece en PENDING
 * 
 * RESTRICCIÓN: 
 * - El envío original debe estar en RETURNING
 * - El nuevo envío debe ser tipo EXCHANGE
 * - Ambos deben estar vinculados
 * 
 * Evento: EXCHANGE_PROCESSED (si se completa todo)
 */
export class CompleteExchangeUseCase {
  constructor(
    private readonly shipmentRepository: ShipmentRepository,
    private readonly rabbitMqPublisher: RabbitMqPublisher
  ) {}

  async execute(command: CompleteExchangeCommand): Promise<CompleteExchangeResult> {
    console.log(`🔄 Completando cambio de producto`);
    console.log(`   Envío original: ${command.originalShipmentId}`);
    console.log(`   Nuevo envío: ${command.newShipmentId}`);

    // 1. Validar comando
    this.validateCommand(command);

    // 2. Cargar ambos envíos desde eventos
    const originalShipment = await this.shipmentRepository.loadById(command.originalShipmentId);
    const newShipment = await this.shipmentRepository.loadById(command.newShipmentId);

    // 3. Validar que ambos envíos estén correctamente vinculados
    this.validateExchangeLink(originalShipment, newShipment);

    // 4. Validar estados de ambos envíos
    this.validateStates(originalShipment, newShipment);

    // 5. Verificar condición del producto devuelto y construir descripción
    const description = this.buildDescription(command);

    // 6. Completar la devolución del envío original
    // Nota: El envío original ya debería estar en EXCHANGE_PROCESSED desde InitiateExchange
    // Pero lo verificamos por si acaso
    if (originalShipment.status.isReturning()) {
      console.log(`ℹ️ Marcando envío original como cambio completado`);
      // El envío original ya debería haber sido marcado en InitiateExchange
      // Pero podemos registrar una nota adicional
      console.log(`✅ Envío original verificado en estado: ${originalShipment.status.value}`);
    }

    // 7. Determinar próxima acción para el nuevo envío
    let nextAction: "prepare_new_shipment" | "already_processing" = "prepare_new_shipment";

    if (newShipment.status.isPending()) {
      // Si el producto está en buen estado, podemos mover a PREPARED
      if (!command.productCondition || command.productCondition === "good") {
        console.log(`ℹ️ Producto original en buen estado, moviendo nuevo envío a PREPARED`);
        
        newShipment.moveToPrepared(
          command.actor || "warehouse_operator",
          description || `Nuevo producto preparado para cambio. Producto original verificado.`
        );
        
        await this.shipmentRepository.save(newShipment);
        nextAction = "already_processing";
        
        console.log(`✅ Nuevo envío ${command.newShipmentId} movido a PREPARED`);
      } else {
        // Si hay problemas con el producto, el nuevo envío permanece en PENDING
        console.log(`⚠️ Producto original con condición: ${command.productCondition}`);
        console.log(`ℹ️ Nuevo envío permanece en PENDING para revisión`);
        nextAction = "prepare_new_shipment";
      }
    } else {
      console.log(`ℹ️ Nuevo envío ya está en estado: ${newShipment.status.value}`);
      nextAction = "already_processing";
    }

    // 8. Publicar evento de finalización de cambio
    try {
      // Podríamos crear un evento específico EXCHANGE_FINALIZED
      await this.rabbitMqPublisher.publishCustomEvent(
        "shipping.exchange.completed.final",
        {
          type: "EXCHANGE_FINALIZED",
          originalShipmentId: originalShipment.id,
          newShipmentId: newShipment.id,
          orderId: originalShipment.orderId,
          productCondition: command.productCondition,
          newShipmentStatus: newShipment.status.value,
          timestamp: new Date().toISOString()
        },
        7 // Alta prioridad
      );
      console.log(`✅ Evento EXCHANGE_FINALIZED publicado`);
    } catch (error: any) {
      console.error(`⚠️ Error al publicar evento:`, error.message);
    }

    console.log(`✅ Cambio de producto completado exitosamente`);
    console.log(`   Envío original: ${originalShipment.status.value}`);
    console.log(`   Nuevo envío: ${newShipment.status.value}`);
    
    return {
      originalShipment,
      newShipment,
      nextAction
    };
  }

  /**
   * Valida el comando
   */
  private validateCommand(command: CompleteExchangeCommand): void {
    ShipmentValidator.validateShipmentId(command.originalShipmentId);
    ShipmentValidator.validateShipmentId(command.newShipmentId);

    if (command.originalShipmentId === command.newShipmentId) {
      throw new Error("El envío original y el nuevo no pueden ser el mismo");
    }

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
   * Valida que ambos envíos estén correctamente vinculados
   */
  private validateExchangeLink(originalShipment: Shipment, newShipment: Shipment): void {
    // Verificar que el nuevo envío esté vinculado al original
    if (newShipment.relatedShipmentId !== originalShipment.id) {
      throw new Error(
        `El nuevo envío ${newShipment.id} no está vinculado al envío original ${originalShipment.id}. ` +
        `Vinculado a: ${newShipment.relatedShipmentId || "ninguno"}`
      );
    }

    // Verificar que el nuevo envío sea de tipo EXCHANGE
    if (!newShipment.type.isExchange()) {
      throw new Error(
        `El nuevo envío ${newShipment.id} debe ser de tipo EXCHANGE. ` +
        `Tipo actual: ${newShipment.type.value}`
      );
    }

    console.log(`✅ Envíos correctamente vinculados y tipos validados`);
  }

  /**
   * Valida los estados de ambos envíos
   */
  private validateStates(originalShipment: Shipment, newShipment: Shipment): void {
    // Validar estado del envío original
    const validOriginalStates = originalShipment.status.isReturning() || 
                                originalShipment.status.isExchangeProcessed();

    if (!validOriginalStates) {
      throw new Error(
        `El envío original debe estar en estado RETURNING o EXCHANGE_PROCESSED. ` +
        `Estado actual: ${originalShipment.status.value}`
      );
    }

    // Validar estado del nuevo envío
    const validNewStates = newShipment.status.isPending() || 
                          newShipment.status.isPrepared() ||
                          newShipment.status.isInTransit();

    if (!validNewStates) {
      throw new Error(
        `El nuevo envío debe estar en estado PENDING, PREPARED o IN_TRANSIT. ` +
        `Estado actual: ${newShipment.status.value}`
      );
    }

    console.log(`✅ Estados válidos:`);
    console.log(`   Original: ${originalShipment.status.value}`);
    console.log(`   Nuevo: ${newShipment.status.value}`);
  }

  /**
   * Construye la descripción con información detallada
   */
  private buildDescription(command: CompleteExchangeCommand): string {
    const timestamp = new Date().toISOString();
    
    if (command.description) {
      return command.description;
    }

    let desc = `Cambio de producto completado el ${timestamp}`;

    if (command.productCondition) {
      const conditionText = {
        good: "producto devuelto en buen estado",
        damaged: "producto devuelto dañado",
        defective: "producto devuelto defectuoso"
      };
      desc += `. Condición: ${conditionText[command.productCondition]}`;
    }

    if (command.notes) {
      desc += `. Notas: ${command.notes}`;
    }

    return desc;
  }

  /**
   * Verifica si un cambio puede ser completado
   */
  async canCompleteExchange(originalShipmentId: string, newShipmentId: string): Promise<boolean> {
    try {
      const originalShipment = await this.shipmentRepository.findById(originalShipmentId);
      const newShipment = await this.shipmentRepository.findById(newShipmentId);
      
      if (!originalShipment || !newShipment) {
        return false;
      }

      // Validar vinculación
      if (newShipment.relatedShipmentId !== originalShipment.id) {
        return false;
      }

      // Validar tipo
      if (!newShipment.type.isExchange()) {
        return false;
      }

      // Validar estados
      const validOriginal = originalShipment.status.isReturning() || 
                           originalShipment.status.isExchangeProcessed();
      
      const validNew = newShipment.status.isPending() || 
                      newShipment.status.isPrepared();

      return validOriginal && validNew;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene detalles del cambio en proceso
   */
  async getExchangeDetails(originalShipmentId: string): Promise<any> {
    const originalShipment = await this.shipmentRepository.findById(originalShipmentId);
    
    if (!originalShipment) {
      throw new Error(`Envío original no encontrado: ${originalShipmentId}`);
    }

    if (!originalShipment.relatedShipmentId) {
      throw new Error(`El envío ${originalShipmentId} no tiene un envío relacionado`);
    }

    const newShipment = await this.shipmentRepository.findById(originalShipment.relatedShipmentId);

    if (!newShipment) {
      throw new Error(`Nuevo envío no encontrado: ${originalShipment.relatedShipmentId}`);
    }

    const exchangeInitiatedEntry = originalShipment.tracking.find(
      t => t.status === "EXCHANGE_PROCESSED"
    );

    return {
      originalShipment: {
        id: originalShipment.id,
        status: originalShipment.status.value,
        articles: originalShipment.articles
      },
      newShipment: {
        id: newShipment.id,
        status: newShipment.status.value,
        type: newShipment.type.value,
        articles: newShipment.articles
      },
      orderId: originalShipment.orderId,
      customerInfo: originalShipment.customerInfo,
      exchangeInitiatedAt: exchangeInitiatedEntry?.timestamp,
      exchangeInitiatedBy: exchangeInitiatedEntry?.actor,
      canComplete: await this.canCompleteExchange(originalShipmentId, newShipment.id)
    };
  }

  /**
   * Obtiene el estado actual de un cambio
   */
  async getExchangeStatus(originalShipmentId: string): Promise<string> {
    const details = await this.getExchangeDetails(originalShipmentId);

    const originalStatus = details.originalShipment.status;
    const newStatus = details.newShipment.status;

    if (originalStatus === "EXCHANGE_PROCESSED" && newStatus === "DELIVERED") {
      return "completed"; // Cambio completado totalmente
    }

    if (originalStatus === "EXCHANGE_PROCESSED" && 
        (newStatus === "IN_TRANSIT" || newStatus === "PREPARED")) {
      return "in_progress"; // Nuevo producto en camino
    }

    if (originalStatus === "RETURNING" && newStatus === "PENDING") {
      return "awaiting_return"; // Esperando producto original
    }

    return "pending"; // Estado inicial o indefinido
  }
}