import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "../tools/environment.js";
import { addressRoutes } from "./routes/addressRoutes.js";

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

  // /address debe ir antes de futuras rutas /:id (Etapa 5) para no ser capturado como id.
  app.use("/api/shipments", addressRoutes);

  return app;
}
