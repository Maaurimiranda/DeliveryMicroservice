import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "../tools/environment.js";
import { errorHandler } from "./errorHandler.js";
import { customerInfoRoutes } from "./routes/customerInfoRoutes.js";
import { shipmentRoutes } from "./routes/shipmentRoutes.js";

// Arma la aplicación Express.
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "OK",
      service: "Delivery Service",
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    });
  });

  // /customer-info debe ir antes de las rutas /:id de shipmentRoutes para no ser capturado
  // como id. Ninguno de los dos routers usa `router.use(authMiddleware)`: el auth va por ruta.
  app.use("/api/shipments", customerInfoRoutes);
  app.use("/api/shipments", shipmentRoutes);

  // Último: traduce los errores de dominio a HTTP.
  app.use(errorHandler);

  return app;
}
