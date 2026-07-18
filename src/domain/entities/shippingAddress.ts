// Agregado propio de Delivery: la dirección de envío de un usuario (relación 1:1).
// Ningún otro microservicio del ecosistema almacena direcciones. Al crear un envío
// se copia como snapshot inmutable en CustomerInfo.
export type ShippingAddress = {
  readonly userId: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly zipCode: string;
  readonly phone: string;
  readonly updatedAt: Date;
};

// El dominio (no el repositorio) decide el timestamp, igual que createShipment.
export function createShippingAddress(
  input: Omit<ShippingAddress, "updatedAt">
): ShippingAddress {
  return { ...input, updatedAt: new Date() };
}
