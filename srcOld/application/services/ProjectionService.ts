import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentEvent } from "../../domain/shipment/ShipmentEvent";
import { IShipmentProjectionRepository } from "../usecases/CreateShipmentUseCase";

export class ProjectionService {
  constructor(
    private readonly projectionRepository: IShipmentProjectionRepository
  ) {}

  async updateProjectionFromEvents(events: ShipmentEvent[]): Promise<void> {
    if (events.length === 0) return;

    const shipment = Shipment.fromEvents(events);
    await this.projectionRepository.save(shipment);
  }

  async rebuildProjection(shipmentId: string, events: ShipmentEvent[]): Promise<void> {
    if (events.length === 0) {
      throw new Error(`No se encontraron eventos para el envío: ${shipmentId}`);
    }

    const shipment = Shipment.fromEvents(events);
    await this.projectionRepository.save(shipment);
    
    console.log(`✅ Proyección reconstruida para envío: ${shipmentId}`);
  }

  async rebuildAllProjections(allEvents: ShipmentEvent[]): Promise<void> {
    // Agrupar eventos por shipmentId
    const eventsByShipment = new Map<string, ShipmentEvent[]>();

    allEvents.forEach(event => {
      const shipmentEvents = eventsByShipment.get(event.shipmentId) || [];
      shipmentEvents.push(event);
      eventsByShipment.set(event.shipmentId, shipmentEvents);
    });

    // Reconstruir cada proyección
    let count = 0;
    for (const [shipmentId, events] of eventsByShipment.entries()) {
      await this.rebuildProjection(shipmentId, events);
      count++;
    }

    console.log(`✅ ${count} proyecciones reconstruidas`);
  }

  async validateProjection(shipmentId: string, events: ShipmentEvent[]): Promise<boolean> {
    const shipmentFromEvents = Shipment.fromEvents(events);
    const shipmentFromProjection = await this.projectionRepository.findById(shipmentId);

    if (!shipmentFromProjection) {
      console.warn(`⚠️ Proyección no encontrada para envío: ${shipmentId}`);
      return false;
    }

    // Comparar estados
    const eventsState = shipmentFromEvents.toJSON();
    const projectionState = shipmentFromProjection.toJSON();

    const isValid = 
      eventsState.status === projectionState.status &&
      eventsState.type === projectionState.type &&
      eventsState.orderId === projectionState.orderId;

    if (!isValid) {
      console.warn(`⚠️ Proyección inconsistente para envío: ${shipmentId}`);
      console.warn(`Estado desde eventos:`, eventsState.status);
      console.warn(`Estado en proyección:`, projectionState.status);
    }

    return isValid;
  }
}