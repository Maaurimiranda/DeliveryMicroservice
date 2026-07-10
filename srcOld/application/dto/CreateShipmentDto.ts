export interface CreateShipmentDto {
  orderId: string;
  customerInfo: {
    customerId: string;
    name: string;
    address: string;
    city: string;
    zipCode: string;
    phone: string;
  };
  articles: Array<{
    articleId: string;
    quantity: number;
    price: number;
  }>;
  description?: string;
  actor?: string;
}