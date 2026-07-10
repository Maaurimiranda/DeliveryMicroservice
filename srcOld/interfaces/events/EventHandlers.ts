import { ShipmentEvent, ShipmentEventType } from "../../domain/shipment/ShipmentEvent";
import { ProjectionService } from "../../application/services/ProjectionService";
import { RabbitMqPublisher } from "../../infrastructure/messaging/rabbitmq/RabbitMqPublisher";
import { StatusProjectionRepository } from "../../infrastructure/persistence/mongodb/StatusProjectionRepository";

export class EventHandlers {
  constructor(
    private readonly projectionService: ProjectionService,
    private readonly rabbitMqPublisher: RabbitMqPublisher,
    private readonly statusProjectionRepository: StatusProjectionRepository
  ) {}

  // Manejador de eventos individual
  async handleShipmentEvent(event: ShipmentEvent): Promise<void> {
    console.log(`Manejando evento: ${event.eventType} para envío ${event.shipmentId}`);

    try {
      // Actualizar proyección principal
      await this.updateProjection(event);

      // Actualizar proyección de estados
      await this.updateStatusProjection(event);

      // Publicar evento a RabbitMQ si corresponde
      await this.publishExternalEvent(event);

      console.log(`Evento procesado exitosamente: ${event.eventType}`);
    } catch (error: any) {
      console.error(`Error al manejar evento ${event.eventType}:`, error.message);
      throw error;
    }
  }

  private async updateProjection(event: ShipmentEvent): Promise<void> {
    // La proyección se actualiza en los Use Cases
    // Este método está disponible para procesamiento asíncrono si es necesario
  }

  private async updateStatusProjection(event: ShipmentEvent): Promise<void> {
    if (!event.newStatus) return;

    if (event.previousStatus && event.previousStatus !== event.newStatus) {
      // Actualizar contadores de estado
      await this.statusProjectionRepository.updateShipmentStatus(
        event.shipmentId,
        event.previousStatus,
        event.newStatus
      );
    } else if (!event.previousStatus) {
      // Nuevo envío
      await this.statusProjectionRepository.incrementStatus(
        event.newStatus,
        event.shipmentId
      );
    }
  }

  private async publishExternalEvent(event: ShipmentEvent): Promise<void> {
    // Los eventos ya se publican en los Use Cases
    // Este método está disponible para lógica adicional de publicación
  }

  async handleBatchEvents(events: ShipmentEvent[]): Promise<void> {
    console.log(`📦 Procesando lote de ${events.length} eventos`);

    for (const event of events) {
      try {
        await this.handleShipmentEvent(event);
      } catch (error) {
        console.error(`Error en evento ${event.eventId}:`, error);
        // Continuar con los demás eventos
      }
    }

    console.log(`Lote de eventos procesado`);
  }

  async replayEvents(shipmentId: string, events: ShipmentEvent[]): Promise<void> {
    console.log(`🔄 Reproduciendo ${events.length} eventos para envío ${shipmentId}`);

    // Reconstruir proyección desde cero
    await this.projectionService.rebuildProjection(shipmentId, events);

    // Reconstruir status projection
    for (const event of events) {
      if (event.newStatus) {
        await this.updateStatusProjection(event);
      }
    }

    console.log(`✅ Eventos reproducidos para envío ${shipmentId}`);
  }
}