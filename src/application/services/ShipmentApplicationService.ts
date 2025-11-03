import { Shipment } from "../../domain/shipment/Shipment";
import { ShipmentEvent } from "../../domain/shipment/ShipmentEvent";
import { IEventStoreRepository, IShipmentProjectionRepository } from "../usecases/CreateShipmentUseCase";

export class ShipmentApplicationService {
  constructor(
    private readonly eventStoreRepository: IEventStoreRepository,
    private readonly projectionRepository: IShipmentProjectionRepository
  ) {}

  async getShipmentById(shipmentId: string): Promise<Shipment | null> {
    return await this.projectionRepository.findById(shipmentId);
  }

  async getShipmentByIdFromEvents(shipmentId: string): Promise<Shipment> {
    const events = await this.eventStoreRepository.getEventsByShipmentId(shipmentId);
    
    if (events.length === 0) {
      throw new Error(`Envío no encontrado: ${shipmentId}`);
    }

    return Shipment.fromEvents(events);
  }

  async getShipmentsByOrderId(orderId: string): Promise<Shipment[]> {
    return await this.projectionRepository.findByOrderId(orderId);
  }

  async getShipmentsByCustomerId(customerId: string): Promise<Shipment[]> {
    return await this.projectionRepository.findByCustomerId(customerId);
  }

  async getAllShipments(limit: number = 50, skip: number = 0): Promise<Shipment[]> {
    return await this.projectionRepository.findAll(limit, skip);
  }

  async getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    return await this.eventStoreRepository.getEventsByShipmentId(shipmentId);
  }

  async countShipments(): Promise<number> {
    return await this.projectionRepository.count();
  }

  async countShipmentsByStatus(status: string): Promise<number> {
    return await this.projectionRepository.countByStatus(status);
  }
}