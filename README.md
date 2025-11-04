# Microservicio de Delivery - E-commerce

Microservicio de gestión de envíos implementado con TypeScript, Express, MongoDB y RabbitMQ siguiendo principios de **Domain-Driven Design (DDD)**, **Event Sourcing** y **CQRS**.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Configuración](#configuración)
- [Ejecución](#ejecución)
- [API Endpoints](#api-endpoints)
- [Event Sourcing](#event-sourcing)
- [Integración con otros servicios](#integración-con-otros-servicios)

## ✨ Características

- **Event Sourcing**: Todos los cambios de estado se almacenan como eventos inmutables
- **CQRS**: Separación entre comandos (escritura) y consultas (lectura)
- **DDD**: Arquitectura en capas siguiendo Domain-Driven Design
- **Máquina de Estados**: Validación estricta de transiciones de estado
- **Mensajería Asíncrona**: Comunicación con otros microservicios vía RabbitMQ
- **JWT Authentication**: Autenticación compartida con AuthGo
- **Tracking Completo**: Historial detallado de cada envío
- **Devoluciones y Cambios**: Soporte para reembolsos y cambios de producto

## 🏗️ Arquitectura

```
src/
  ├── domain/
  │   ├── shipment/
  │   │   ├── Shipment.ts              
  │   │   ├── ShipmentEvent.ts         
  │   │   ├── ShipmentStatus.ts        
  │   │   ├── ShipmentType.ts          
  │   │   └── ShipmentValidator.ts     
  │   └── shared/
  │       ├── DomainEvent.ts 
  │       └── ValueObject.ts 
  ├── application/
  │   ├── usecasesa
  │   │   ├── CreateShipmentUseCase.ts 
  │   │   ├── MoveToPreparingUseCase.ts 
  │   │   ├── MoveToInTransitUseCase.ts 
  │   │   ├── MoveToDeliveredUseCase.ts 
  │   │   ├── CancelShipmentUseCase.ts 
  │   │   ├── InitiateReturnUseCase.ts 
  │   │   ├── CompleteReturnUseCase.ts 
  │   │   ├── InitiateExchangeUseCase.ts 
  │   │   └── CompleteExchangeUseCase.ts 
  │   ├── services/
  │   │   ├── ShipmentApplicationService.ts 
  │   │   └── ProjectionService.ts 
  │   └── dto/
  │       ├── CreateShipmentDto.ts 
  │       ├── ShipmentResponseDto.ts 
  │       └── UpdateStateDto.ts 
  ├── infrastructure/
  │   ├── persistence/
  │   │   ├── mongodb/
  │   │   │   ├── MongoDbConnection.ts 
  │   │   │   ├── EventStoreRepository.ts         
  │   │   │   ├── ShipmentProjectionRepository.ts 
  │   │   │   └── StatusProjectionRepository.ts   
  │   │   └── repositories/
  │   │       └── ShipmentRepository.ts           
  │   ├── messaging/
  │   │   ├── rabbitmq/
  │   │   │   ├── RabbitMqConnection.ts 
  │   │   │   ├── RabbitMqPublisher.ts 
  │   │   │   └── RabbitMqConsumer.ts 
  │   │   └── consumers/
  │   │       ├── PaymentApprovedConsumer.ts 
  │   │       └── OrderRefundConsumer.ts 
  │   └── auth/
  │       ├── JwtAuthMiddleware.ts 
  │       └── AuthService.ts 
  ├── interfaces/
  │   ├── http/
  │   │   ├── routes/
  │   │   │   └── shipment.routes.ts 
  │   │   ├── controllers/
  │   │   │   └── ShipmentController.ts 
  │   │   └── middlewares/
  │   │       ├── errorHandler.ts 
  │   │       └── validateRequest.ts 
  │   └── events/
  │       └── EventHandlers.ts 
  ├── config/
  │   ├── database.ts 
  │   ├── rabbitmq.ts 
  │   └── environment.ts 
  └── server.ts
```

### Estados del Envío

```
PENDING → PREPARED → IN_TRANSIT → DELIVERED
   ↓                                   ↓
CANCELLED                          RETURNING
                                       ↓
                              RETURNED / EXCHANGE_PROCESSED
```

## 🛠️ Tecnologías

- **Node.js** 18+
- **TypeScript** 5.3+
- **Express** 4.18
- **MongoDB** 7.0
- **RabbitMQ** 3.12
- **JWT** para autenticación
- **Docker** & Docker Compose


## ⚙️ Configuración

### Variables de Entorno

Crear archivo `.env`:

```env
# Server
PORT=3003
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/delivery_service
MONGODB_DB_NAME=delivery_service

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=ecommerce_events
RABBITMQ_QUEUE_PAYMENT_APPROVED=delivery.payment_approved
RABBITMQ_QUEUE_ORDER_REFUND=delivery.order_refund
RABBITMQ_QUEUE_LOGOUT=delivery.logout

# JWT (DEBE SER EL MISMO QUE AUTH SERVICE)
JWT_SECRET=your_shared_jwt_secret_with_auth_service

# Services
AUTH_SERVICE_URL=http://localhost:3000
ORDERS_SERVICE_URL=http://localhost:3001
```


## 🚀 Ejecución

### Opción 1: Desarrollo Local

```bash
# Instalar dependencias
npm install

# Modo desarrollo con hot reload
npm run dev

# O compilar y ejecutar
npm run build
npm start
```

**Requisitos previos**:
- MongoDB corriendo en puerto 27017
- RabbitMQ corriendo en puerto 5672

### Opción 2: Docker Compose

```bash
# Construir y levantar servicios
docker-compose up --build

# O en modo detached
docker-compose up -d

# Ver logs
docker-compose logs -f delivery-service

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

### Verificar que el servicio está corriendo

```bash
curl http://localhost:3003/health
```

Respuesta esperada:
```json
{
  "status": "OK",
  "service": "Delivery Service",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📚 API Endpoints

### Autenticación

Todos los endpoints (excepto `/health` y `/tracking/:id`) requieren autenticación JWT:

```
Authorization: Bearer <token>
```

### Endpoints Disponibles

#### 🔓 Públicos

```http
GET /health
GET /api/shipments/tracking/:id
```

#### 🔐 Autenticados (Usuario)

```http
GET /api/shipments/my-shipments
GET /api/shipments/:id
GET /api/shipments/order/:orderId
POST /api/shipments/:id/return
POST /api/shipments/:id/exchange
```

#### 👑 Admin

```http
# Gestión de envíos
POST /api/shipments
GET /api/shipments
GET /api/shipments/:id/events

# Transiciones de estado
POST /api/shipments/:id/prepare
POST /api/shipments/:id/ship
POST /api/shipments/:id/deliver
POST /api/shipments/:id/cancel
POST /api/shipments/:id/return/complete
```

### Ejemplos de Uso

#### Crear Envío (Admin)

```bash
curl -X POST http://localhost:3003/api/shipments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "customerInfo": {
      "customerId": "user_456",
      "name": "Juan Pérez",
      "address": "Calle Falsa 123",
      "city": "Buenos Aires",
      "zipCode": "1234",
      "phone": "+54 11 1234-5678"
    },
    "articles": [
      {
        "articleId": "article_789",
        "quantity": 2,
        "price": 1500
      }
    ],
    "description": "Envío urgente"
  }'
```

#### Obtener Tracking Público

```bash
curl http://localhost:3003/api/shipments/tracking/ship_123456789
```

#### Mover a Preparado (Admin)

```bash
curl -X POST http://localhost:3003/api/shipments/ship_123/prepare \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Paquete preparado y listo para despacho"
  }'
```

#### Iniciar Devolución (Cliente)

```bash
curl -X POST http://localhost:3003/api/shipments/ship_123/return \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Producto defectuoso"
  }'
```

#### Iniciar Cambio (Cliente)

```bash
curl -X POST http://localhost:3003/api/shipments/ship_123/exchange \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Cambio de talla"
  }'
```

## 📊 Event Sourcing

### Colecciones MongoDB

#### 1. `events` (Event Store)

Almacena todos los eventos inmutables:

```javascript
{
  "_id": "event_123",
  "eventId": "event_123",
  "eventType": "SHIPMENT_CREATED",
  "shipmentId": "ship_456",
  "orderId": "order_789",
  "timestamp": ISODate("2024-01-15T10:00:00Z"),
  "actor": "system",
  "description": "Envío creado...",
  "newStatus": "PENDING",
  "customerInfo": { ... },
  "articles": [ ... ]
}
```

#### 2. `shipment_projection` (Proyección)

Vista optimizada para consultas:

```javascript
{
  "id": "ship_456",
  "orderId": "order_789",
  "status": "IN_TRANSIT",
  "type": "NORMAL",
  "customerInfo": { ... },
  "articles": [ ... ],
  "tracking": [
    {
      "status": "PENDING",
      "description": "Envío creado...",
      "timestamp": ISODate("..."),
      "actor": "system"
    },
    {
      "status": "PREPARED",
      "description": "Paquete preparado...",
      "timestamp": ISODate("..."),
      "actor": "admin_user"
    }
  ],
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

### Tipos de Eventos

- `SHIPMENT_CREATED`
- `MOVED_TO_PREPARED`
- `MOVED_TO_IN_TRANSIT`
- `MOVED_TO_DELIVERED`
- `SHIPMENT_CANCELLED`
- `RETURN_INITIATED`
- `RETURN_COMPLETED`
- `EXCHANGE_INITIATED`
- `EXCHANGE_COMPLETED`
- `SHIPMENT_ERROR`

## 🔗 Integración con otros servicios

### Eventos de Entrada (Consumers)

#### `PAYMENT_APPROVED` (desde Orders)

Cuando se aprueba un pago, se crea automáticamente un envío:

```javascript
{
  "type": "PAYMENT_APPROVED",
  "orderId": "order_123",
  "customerId": "user_456",
  "customerInfo": { ... },
  "articles": [ ... ]
}
```

#### `ORDER_REFUND` (desde Orders)

Confirmación de reembolso procesado.

### Eventos de Salida (Publishers)

El servicio publica eventos a RabbitMQ para notificar a otros servicios:

| Evento | Routing Key | Destinos | Descripción |
|--------|-------------|----------|-------------|
| `SHIPPING_CREATED` | `shipping.created` | Stats | Nuevo envío creado |
| `SHIPPING_STATE_CHANGED` | `shipping.state.changed` | Stats, Orders | Cambio de estado |
| `SHIPPING_DELIVERED` | `shipping.delivered` | Stats, Orders | Envío entregado |
| `SHIPPING_CANCELLED` | `shipping.cancelled` | Stats, Orders | Envío cancelado |
| `RETURN_INITIATED` | `shipping.return.initiated` | Stats, Orders | Devolución iniciada |
| `RETURN_COMPLETED` | `shipping.return.completed` | Stats, Orders | Devolución completada |
| `EXCHANGE_INITIATED` | `shipping.exchange.initiated` | Stats, Orders | Cambio iniciado |

## 🧪 Testing

### Probar con curl

```bash
# 1. Obtener token del servicio Auth
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. Crear envío
curl -X POST http://localhost:3003/api/shipments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test_order","customerInfo":{...},"articles":[...]}'

# 3. Ver envíos
curl http://localhost:3003/api/shipments \
  -H "Authorization: Bearer $TOKEN"
```

### Monitorear RabbitMQ

Acceder a la UI de management:
```
http://localhost:15672
Usuario: guest
Password: guest
```

## 📝 Notas Importantes

### Validaciones de Estado

- Solo se puede cancelar en estados `PENDING` o `PREPARED`
- No se puede cancelar en `IN_TRANSIT` o `DELIVERED`
- Las devoluciones solo desde `DELIVERED`
- Los cambios solo desde `RETURNING`

### Idempotencia

El sistema maneja eventos duplicados usando el `eventId` como clave única.

### Consistencia Eventual

Las proyecciones se actualizan asíncronamente. Puede haber un pequeño delay entre el evento y la proyección actualizada.

### JWT Secret Compartido

**CRÍTICO**: El `JWT_SECRET` debe ser el mismo en todos los microservicios para que la autenticación funcione correctamente.

## 🐛 Troubleshooting

### MongoDB no conecta

```bash
# Verificar que MongoDB está corriendo
docker ps | grep mongo

# Ver logs de MongoDB
docker logs delivery-mongodb
```

### RabbitMQ no conecta

```bash
# Verificar que RabbitMQ está corriendo
docker ps | grep rabbitmq

# Ver logs
docker logs ecommerce-rabbitmq

# Acceder a management UI
http://localhost:15672
```

### Token inválido

Verificar que el `JWT_SECRET` es el mismo en Auth y Delivery.

### Los consumers no reciben mensajes

Verificar en RabbitMQ Management UI:
1. Que el exchange `ecommerce_events` existe
2. Que las colas están creadas y bindeadas
3. Que hay mensajes en las colas

// src/infrastructure/messaging/rabbitmq/RabbitMqConsumer.ts

import { Channel, ConsumeMessage } from "amqplib";
import { RabbitMqConnection } from "./RabbitMqConnection";

export abstract class RabbitMqConsumer {
  protected rabbitMq: RabbitMqConnection;
  protected channel: Channel;
  protected queueName: string;
  protected routingKey: string;

  constructor(queueName: string, routingKey: string) {
    this.rabbitMq = RabbitMqConnection.getInstance();
    this.channel = this.rabbitMq.getChannel();
    this.queueName = queueName;
    this.routingKey = routingKey;
  }

  async start(): Promise<void> {
    await this.rabbitMq.assertQueue(this.queueName, this.routingKey);

    this.channel.consume(
      this.queueName,
      async (msg) => {
        if (msg) {
          await this.handleMessage(msg);
        }
      },
      { noAck: false }
    );

    console.log(`🎧 Consumer escuchando en cola: ${this.queueName}`);
    console.log(`   Routing key: ${this.routingKey}`);
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    try {
      const content = this.parseMessage(msg);
      console.log(`📥 Mensaje recibido en ${this.queueName}:`, content.type || 'unknown');

      await this.processMessage(content);

      this.channel.ack(msg);
      console.log(`✅ Mensaje procesado exitosamente en ${this.queueName}`);
    } catch (error: any) {
      console.error(`❌ Error al procesar mensaje en ${this.queueName}:`, error.message);

      // Estrategia de reintento
      if (this.shouldRetry(msg)) {
        console.log(`🔄 Reintentando mensaje en ${this.queueName}...`);
        this.channel.nack(msg, false, true); // Requeue
      } else {
        console.log(`⛔ Mensaje rechazado en ${this.queueName} (no más reintentos)`);
        this.channel.nack(msg, false, false); // No requeue
        await this.handleFailedMessage(msg, error);
      }
    }
  }

  protected parseMessage(msg: ConsumeMessage): any {
    try {
      return JSON.parse(msg.content.toString());
    } catch (error) {
      throw new Error(`Error al parsear mensaje: ${error}`);
    }
  }

  protected shouldRetry(msg: ConsumeMessage): boolean {
    // Verificar header de reintentos
    const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) as number;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Incrementar contador de reintentos
      msg.properties.headers = msg.properties.headers || {};
      msg.properties.headers['x-retry-count'] = retryCount + 1;
      return true;
    }

    return false;
  }

  protected async handleFailedMessage(msg: ConsumeMessage, error: Error): Promise<void> {
    // Implementar Dead Letter Queue o logging
    console.error(`💀 Mensaje fallido definitivamente:`, {
      queue: this.queueName,
      error: error.message,
      content: msg.content.toString()
    });

    // Aquí podrías enviar a una cola de errores o sistema de alertas
  }

  protected abstract processMessage(content: any): Promise<void>;
}