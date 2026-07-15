import type { ShipmentStatus } from "./shipmentStatus.js";

export type TrackingEntry = {
  readonly status: ShipmentStatus;
  readonly description: string;
  readonly timestamp: Date;
  // El bloque de tipos del README omite `actor`, pero CU02 y las respuestas de
  // GET /tracking/:id lo exigen: "system" si la transición es automática,
  // el usuario admin si la dispara una persona.
  readonly actor: string;
};
