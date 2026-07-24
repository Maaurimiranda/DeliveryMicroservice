// Value Object: la dirección a la que se despacha un envío concreto. Snapshot inmutable
// copiado desde CustomerInfo al momento de crear el Shipment: cambios posteriores en los
// datos del cliente no afectan envíos ya creados.
export type ShippingAddress = {
  readonly customerId: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly zipCode: string;
  readonly phone: string;
};
