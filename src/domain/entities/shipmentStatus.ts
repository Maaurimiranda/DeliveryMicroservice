export const ShipmentStatus = {
  PENDING: "PENDING",
  PREPARED: "PREPARED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURNING: "RETURNING",
  RETURNED: "RETURNED",
  EXCHANGE_PROCESSED: "EXCHANGE_PROCESSED",
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

// Máquina de estados: única fuente de verdad de las transiciones permitidas.
// Cancelar solo desde PENDING o PREPARED (una vez IN_TRANSIT ya no se puede).
// Devolución y cambio solo arrancan desde DELIVERED.
const ALLOWED_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  [ShipmentStatus.PENDING]: [ShipmentStatus.PREPARED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PREPARED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [ShipmentStatus.RETURNING],
  [ShipmentStatus.RETURNING]: [ShipmentStatus.RETURNED, ShipmentStatus.EXCHANGE_PROCESSED],
  [ShipmentStatus.CANCELLED]: [],
  [ShipmentStatus.RETURNED]: [],
  [ShipmentStatus.EXCHANGE_PROCESSED]: [],
};

export function allowedTransitions(from: ShipmentStatus): readonly ShipmentStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: ShipmentStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
