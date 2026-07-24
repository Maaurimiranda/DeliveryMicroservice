// Agregado propio de Delivery: los datos de contacto y dirección de un usuario (relación 1:1).
// Ningún otro microservicio del ecosistema los almacena. Es mutable: el usuario los edita vía
// PUT /api/shipments/customer-info. Al crear un envío se copian como snapshot inmutable
// en el value object ShippingAddress.
export type CustomerInfo = {
  readonly userId: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly zipCode: string;
  readonly phone: string;
  readonly updatedAt: Date;
};

// El dominio (no el repositorio) decide el timestamp, igual que createShipment.
export function createCustomerInfo(input: Omit<CustomerInfo, "updatedAt">): CustomerInfo {
  return { ...input, updatedAt: new Date() };
}
