import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "../tools/environment.js";

// Arma la aplicación Express. Las rutas de /api/shipments se montan más adelante.
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

  return app;
}
