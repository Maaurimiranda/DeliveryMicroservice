import { MongoClient, Db } from "mongodb";

export class MongoDbConnection {
  private static instance: MongoDbConnection;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private constructor() {}

  // Singleton pattern
  static getInstance(): MongoDbConnection {
    if (!MongoDbConnection.instance) {
      MongoDbConnection.instance = new MongoDbConnection();
    }
    return MongoDbConnection.instance;
  }

  // Conectar a MongoDB
  async connect(uri: string, dbName: string): Promise<void> {
    if (this.client) {
      console.log("MongoDB ya está conectado");
      return;
    }

    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(dbName);
      console.log(`Conectado a MongoDB: ${dbName}`);

      // Crear índices
      await this.createIndexes();
    } catch (error) {
      console.error("Error al conectar a MongoDB:", error);
      throw error;
    }
  }

  // Desconectar de MongoDB
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log("MongoDB desconectado");
    }
  }

  // Obtener la instancia de la base de datos
  getDb(): Db {
    if (!this.db) {
      throw new Error("MongoDB no está conectado. Llama a connect() primero.");
    }
    return this.db;
  }

  // Crear índices necesarios
  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Índices para events (Event Store)
      await this.db.collection("events").createIndex({ shipmentId: 1 });
      await this.db.collection("events").createIndex({ orderId: 1 });
      await this.db.collection("events").createIndex({ eventType: 1 });
      await this.db.collection("events").createIndex({ timestamp: -1 });

      // Índices para shipment_projection
      await this.db.collection("shipment_projection").createIndex({ id: 1 }, { unique: true });
      await this.db.collection("shipment_projection").createIndex({ orderId: 1 });
      await this.db.collection("shipment_projection").createIndex({ status: 1 });
      await this.db.collection("shipment_projection").createIndex({ "customerInfo.customerId": 1 });
      await this.db.collection("shipment_projection").createIndex({ relatedShipmentId: 1 });

      // Índices para status_projection
      await this.db.collection("status_projection").createIndex({ status: 1 });
      await this.db.collection("status_projection").createIndex({ updatedAt: -1 });

      console.log("Índices de MongoDB creados");
    } catch (error) {
      console.error("Error al crear índices:", error);
    }
  }

  // Health check de la conexión - ping
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.db("admin").command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}