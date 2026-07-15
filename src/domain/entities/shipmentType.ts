export const ShipmentType = {
  NORMAL: "NORMAL",
  EXCHANGE: "EXCHANGE",
} as const;

export type ShipmentType = (typeof ShipmentType)[keyof typeof ShipmentType];
