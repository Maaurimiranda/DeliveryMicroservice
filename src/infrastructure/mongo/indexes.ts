import type { Db } from "mongodb";

// Índice único parcial (orderId, type=NORMAL): impide dos envíos NORMAL para la misma
// orden. Base de la idempotencia de CU01 — clave duplicada ⇒ el consumer hace ack sin
// recrear. Los envíos EXCHANGE quedan fuera del filtro (pueden repetir orderId).
// createIndex es idempotente; se llama una vez al arrancar.
export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("shipments").createIndex(
    { orderId: 1 },
    { unique: true, partialFilterExpression: { type: "NORMAL" } }
  );
}
