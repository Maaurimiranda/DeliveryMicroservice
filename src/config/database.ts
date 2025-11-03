import { MongoDbConnection } from "../infrastructure/persistence/mongodb/MongoDbConnection";
import { config } from "./environment";

// Conectar a MongoDB
export const connectDatabase = async (): Promise<void> => {
  const mongoDb = MongoDbConnection.getInstance();
  await mongoDb.connect(config.mongodb.uri, config.mongodb.dbName);
};

// Desconectar de MongoDB
export const disconnectDatabase = async (): Promise<void> => {
  const mongoDb = MongoDbConnection.getInstance();
  await mongoDb.disconnect();
};
