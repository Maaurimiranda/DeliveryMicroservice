import { createApp } from "./app.js";
import { env } from "../tools/environment.js";
import { connectMongo, closeMongo } from "../infrastructure/mongo/mongo.js";
import { connectRabbit, closeRabbit } from "../rabbit/connection.js";
import { startOrderPlacedConsumer } from "../rabbit/consumers/orderPlacedConsumer.js";
import { startAuthConsumer } from "../rabbit/consumers/authConsumer.js";
import { mongoShipmentRepository } from "../infrastructure/repositories/mongoShipmentRepository.js";
import { mongoCustomerInfoRepository } from "../infrastructure/repositories/mongoCustomerInfoRepository.js";
import { rabbitShippingEventPublisher } from "../rabbit/rabbitShippingEventPublisher.js";

async function main() {
  await connectMongo();
  await connectRabbit();

  // CU01: consume `order_placed` y publica SHIPPING_CREATED en `shipping_events`.
  await startOrderPlacedConsumer({
    customerInfoRepo: mongoCustomerInfoRepository,
    shipmentRepo: mongoShipmentRepository,
    publisher: rabbitShippingEventPublisher,
  });

  // Logout: consume el fanout `auth` e invalida el cache de tokens.
  await startAuthConsumer();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Delivery Service escuchando en http://localhost:${env.port}`);
  });

  // Cierre ordenado ante señales de terminación.
  const shutdown = async () => {
    console.log("Cerrando Delivery Service...");
    server.close();
    await closeRabbit();
    await closeMongo();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Error al iniciar Delivery Service:", error);
  process.exit(1);
});
