import { CustomerInfo, Article } from "./ShipmentEvent";

export class ShipmentValidator {
  static validateCustomerInfo(customerInfo: CustomerInfo): void {
    if (!customerInfo) {
      throw new Error("CustomerInfo es requerido");
    }

    if (!customerInfo.customerId || customerInfo.customerId.trim() === "") {
      throw new Error("customerId es requerido");
    }

    if (!customerInfo.name || customerInfo.name.trim() === "") {
      throw new Error("name es requerido");
    }

    if (!customerInfo.address || customerInfo.address.trim() === "") {
      throw new Error("address es requerido");
    }

    if (!customerInfo.city || customerInfo.city.trim() === "") {
      throw new Error("city es requerido");
    }

    if (!customerInfo.zipCode || customerInfo.zipCode.trim() === "") {
      throw new Error("zipCode es requerido");
    }

    if (!customerInfo.phone || customerInfo.phone.trim() === "") {
      throw new Error("phone es requerido");
    }
  }

  static validateArticles(articles: Article[]): void {
    if (!articles || !Array.isArray(articles)) {
      throw new Error("Articles debe ser un array");
    }

    if (articles.length === 0) {
      throw new Error("Debe haber al menos un artículo");
    }

    articles.forEach((article, index) => {
      if (!article.articleId || article.articleId.trim() === "") {
        throw new Error(`articleId es requerido en el artículo ${index + 1}`);
      }

      if (article.quantity === undefined || article.quantity === null) {
        throw new Error(`quantity es requerido en el artículo ${index + 1}`);
      }

      if (article.quantity <= 0) {
        throw new Error(`quantity debe ser mayor a 0 en el artículo ${index + 1}`);
      }

      if (article.price === undefined || article.price === null) {
        throw new Error(`price es requerido en el artículo ${index + 1}`);
      }

      if (article.price < 0) {
        throw new Error(`price no puede ser negativo en el artículo ${index + 1}`);
      }
    });
  }

  static validateOrderId(orderId: string): void {
    if (!orderId || orderId.trim() === "") {
      throw new Error("orderId es requerido");
    }
  }

  static validateShipmentId(shipmentId: string): void {
    if (!shipmentId || shipmentId.trim() === "") {
      throw new Error("shipmentId es requerido");
    }
  }

  static validateDescription(description: string | undefined): void {
    if (description && description.length > 500) {
      throw new Error("description no puede exceder 500 caracteres");
    }
  }
}