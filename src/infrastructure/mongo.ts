import { MongoClient, Db } from "mongodb";
import { env } from "../tools/environment.js";

let client: MongoClient | null = null;
let db: Db | null = null;

// Conecta a MongoDB y guarda la referencia a la base de datos.
export async function connectMongo(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.mongoUri);
  await client.connect();
  db = client.db(env.mongoDbName);
  console.log(`Conectado a MongoDB: ${env.mongoDbName}`);
  return db;
}

// Devuelve la base de datos conectada. Lanza si aún no se conectó.
export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB no está conectado. Llamá a connectMongo() primero.");
  }
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB desconectado");
  }
}
