export interface TrackingEntryDto {
  status: string;
  description: string;
  timestamp: Date;
  actor?: string;
}

export interface ArticleDto {
  articleId: string;
  quantity: number;
  price: number;
}

export interface CustomerInfoDto {
  customerId: string;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
}

export interface ShipmentResponseDto {
  id: string;
  orderId: string;
  status: string;
  type: string;
  customerInfo: CustomerInfoDto;
  articles: ArticleDto[];
  tracking: TrackingEntryDto[];
  relatedShipmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ShipmentResponseMapper {
  static toDto(shipment: any): ShipmentResponseDto {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status.value,
      type: shipment.type.value,
      customerInfo: shipment.customerInfo,
      articles: shipment.articles,
      tracking: shipment.tracking,
      relatedShipmentId: shipment.relatedShipmentId,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt
    };
  }

  static toDtoList(shipments: any[]): ShipmentResponseDto[] {
    return shipments.map(shipment => this.toDto(shipment));
  }
}