# Microservicio de Envíos (Delivery Service)

Microservicio de gestión de envíos implementado con TypeScript, Express, MongoDB y RabbitMQ siguiendo principios de **Domain-Driven Design (DDD)**, **Event Sourcing** y **CQRS**.

## Indice 

- [Descripción del Microservicio](#-descripción-del-microservicio)
- [Casos de Uso](#-casos-de-uso)
- [Entidades del Dominio](#entidades-del-dominio)
- [Endpoints por Rol](#endpoints-por-rol)
- [Interfaz RabbitMQ](#interfaz-rabbitmq)
- [Diagrama de Flujo de Eventos](#diagrama-de-flujo-de-eventos)
- [Tabla de Resumen de Eventos](#tabla-de-resumen-de-eventos)

## 📦 Descripción del Microservicio
El Microservicio de Envíos es responsable de gestionar todo el ciclo de vida del envío de órdenes de compra, desde que se aprueba el pago hasta la entrega final o devolución del pedido.

---

## 🎯 Casos de Uso

#### **CU01 - Registrar Envío**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Disparador**    | Evento `PAYMENT_APPROVED` desde el microservicio de Orders |
| **Descripción**   | Cuando se aprueba el pago de una orden, el sistema crea automáticamente un nuevo envío con estado `PENDING`. Se extraen los datos del cliente y los artículos de la orden. |
| **Evento emitido**| `SHIPPING_CREATED` → Routing key: `shipping.created` |
| **Estado inicial**| `PENDING` |

Flujo:

1. Escucha evento `PAYMENT_APPROVED` en cola `delivery.payment_approved`
2. Valida información del cliente y artículos
3. Crea agregado Shipment con estado PENDING
4. Registra evento `SHIPMENT_CREATED` en Event Store
5. Actualiza proyección de lectura
6. Publica evento `SHIPPING_CREATED` a exchange

**Evento que emite**: `SHIPPING_CREATED` (routing key: `shipping.created`)

---
#### **CU02 - Pasar a Preparado**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | El operario confirma que todos los artículos han sido empaquetados correctamente y están listos para ser retirados por la empresa logística. |
| **Evento emitido**| `SHIPPING_STATE_CHANGED` → Routing key: `shipping.state.changed` |
| **Transición de estado**| `PENDING` → `PREPARED` |

Flujo:

1. Admin solicita transición de estado mediante endpoint
2. Valida que el envío esté en estado PENDING
3. Registra evento `MOVED_TO_PREPARED`
4. Actualiza estado a PREPARED
5. Registra tracking entry con actor y descripción

**Transición de estado**: `PENDING` → `PREPARED`
**Evento que emite**: `SHIPPING_CREATED` (routing key: `shipping.created`)

---

#### **CU03 - Pasar a En Camino**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin  |
| **Descripción**   | La empresa logística retira el paquete del almacén y comienza el trayecto hacia el domicilio del cliente. |
| **Evento emitido**| `SHIPPING_STATE_CHANGED` → Routing key: `shipping.state.changed` |
| **Transición de estado**| `PREPARED` → `IN_TRANSIT` |

Flujo:

1. Admin solicita transición de estado mediante endpoint
2. Valida que el envío esté en estado PREPARED
3. Registra evento `MOVED_TO_IN_TRANSIT`
4. Actualiza estado a IN_TRANSIT
5. A partir de este punto, el envío NO puede ser cancelado

**Transición de estado**: `PREPARED` → `IN_TRANSIT`
**Evento que emite**: `SHIPPING_STATE_CHANGED` (routing key: `shipping.state.changed`)
**Restricción importante**: Una vez en tránsito, NO se puede cancelar el envío.

---

#### **CU04 - Pasar a Entregado**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | El paquete llega al domicilio del cliente y es entregado. La empresa logística o el cliente confirma la entrega. |
| **Evento emitido**| `SHIPPING_DELIVERED` → Routing key: `shipping.delivered` |
| **Transición de estado**| `IN_TRANSIT` → `DELIVERED` |

Flujo:

1. Admin confirma entrega mediante endpoint
2. Valida que el envío esté en estado IN_TRANSIT
3. Registra evento `MOVED_TO_DELIVERED`
4. Actualiza estado a DELIVERED
5. Notifica a Orders y Stats sobre entrega exitosa

**Transición de estado**: `IN_TRANSIT` → `DELIVERED`
**Evento que emite**: `SHIPPING_DELIVERED` (routing key: `shipping.delivered`, prioridad: 5)

---

#### **CU05 - Cancelar Envío**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | Se cancela un envío que aún no ha sido entregado a la empresa logística.
| **Evento emitido**| `SHIPPING_CANCELLED` → Routing key: `shipping.cancelled` |
| **Transición de estado**| `PENDING` o `PREPARED` → `CANCELLED` |

Flujo:

1. Admin solicita cancelación mediante endpoint
2. Valida que el envío esté en estado PENDING o PREPARED
3. Registra evento `SHIPMENT_CANCELLED` con motivo
4. Actualiza estado a CANCELLED
5. Notifica a Orders para procesar reembolso automático

**Transición de estado**: `PENDING` → `CANCELLED`
**Evento que emite**: `SHIPPING_CANCELLED` (routing key: `shipping.cancelled`, prioridad: 5)
**Restricción**: Solo se puede cancelar en estados PENDING o PREPARED. NO se puede cancelar si está IN_TRANSIT o DELIVERED.

---

#### **CU06 - Iniciar Devolución - Reembolso**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Disparador**    | Evento `ORDER_REFUND` desde Orders (opcional) o solicitud del cliente |
| **Descripción**   | El cliente solicita devolver el producto para obtener un reembolso. Se crea un registro de devolución con estado `IN_TRANSIT`. El producto está en tránsito del cliente al almacén del ecommerce. |
| **Evento emitido**| `RETURN_INITIATED` → Routing key: `shipping.return.initiated` |
| **Transición de estado**| `DELIVERED` → `RETURNING` |

Flujo:

1. Cliente solicita devolución mediante endpoint
2. Valida que el envío esté en estado DELIVERED
3. Registra evento `RETURN_INITIATED`
4. Actualiza estado a RETURNING
5. Notifica a Orders sobre inicio de devolución

**Transición de estado**: `DELIVERED` → `RETURNING`
**Evento que emite**: `RETURN_INITIATED` (routing key: `shipping.return.initiated`, prioridad: 6)
**Nota**: El producto viaja de regreso del cliente al almacén.

---

#### **CU07 - Completar Devolución**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | El operario verifica que el producto devuelto haya llegado al almacén y evalúa su estado (bueno, dañado, defectuoso). Se registra la devolución como completada y se notifica a Orders para procesar el reembolso definitivo.
| **Evento emitido**| `RETURN_COMPLETED` → Routing key: `shipping.return.completed` |
| **Transición de estado**| `RETURNING` → `RETURNED` |

Flujo:

1. Operario recibe producto devuelto en almacén
2. Evalúa condición del producto (good/damaged/defective)
3. Registra evento `RETURN_COMPLETED` con condición del producto
4. Actualiza estado a RETURNED
5. Notifica a Orders para ejecutar reembolso

**Transición de estado**: `RETURNING` → `RETURNED`
**Evento que emite**: `RETURN_COMPLETED` (routing key: `shipping.return.completed`, prioridad: 7)
**Importante**: Este evento es crítico para que Orders procese el reembolso al cliente.

---

#### **CU08 - Iniciar Cambio de Producto**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Disparador**    | Evento `ORDER_CHANGE_REQUESTED` desde Orders |
| **Descripción**   | El cliente solicita cambiar un producto. Se crean DOS procesos paralelos:
1. Envío original: El producto viaja del cliente al almacén (devolución)
2. Nuevo envío: Se prepara un nuevo envío con el producto de cambio
Ambos envíos quedan vinculados mediante `relatedShipmentId`. |
| **Evento emitido**| `EXCHANGE_INITIATED` → Routing key: `shipping.exchange.initiated` |
| **Transición de estado**| `DELIVERED` o `RETURNING` → `EXCHANGE_PROCESSED`. Se crea un tipo `EXCHANGE` con estado `PENDING`|

Flujo:

1. Cliente solicita cambio mediante endpoint
2. Valida que el envío original esté DELIVERED o RETURNING
3. Si está DELIVERED, mueve a RETURNING primero
4. Crea nuevo envío tipo EXCHANGE vinculado al original
5. Marca envío original como EXCHANGE_PROCESSED     
6. Nuevo envío queda en estado PENDING

**Nota**: Ambos envíos están vinculados y pueden rastrearse entre sí.

---

#### **CU09 - Completar Cambio de Producto**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | El operario verifica que el producto original haya llegado al almacén, valida su estado y confirma que el nuevo producto se ha preparado correctamente.
| **Evento emitido**| `EXCHANGE_FINALIZED` → Routing key: `shipping.exchange.completed.final` |
| **Transición de estado**| Envío original: Permanece en `EXCHANGE_PROCESSED`. Nuevo envío: `PENDING` → ``PREPARED` (si producto original en buenas condiciones)|

Flujo:

1. Operario recibe producto original en almacén
2. Valida condición del producto (good/damaged/defective)
3. Si es bueno, envío original se marca como `EXCHANGE_PROCESSED`
4. Si es dañado, envío original se marca como `CANCELLED`
5. Si es defectuoso, envío original se marca como `RETURNED` y 

**Transición de estado**: `EXCHANGE_PROCESSED` → `PREPARED`
**Evento que emite**: `EXCHANGE_FINALIZED` (routing key: `shipping.exchange.completed.final`, prioridad: 7)
**Importante**: Este evento es crítico para que Orders procese el reembolso al cliente.

---

## Entidades del Dominio

### Shipment

Entidad principal que representa un envío.

```typescript
{
  id: string;                    // ID único del envío (ship_*)
  orderId: string;                // ID de la orden asociada
  status: ShipmentStatus;         // Estado actual del envío
  type: ShipmentType;             // Tipo: NORMAL | EXCHANGE
  customerInfo: CustomerInfo;     // Información del cliente
  articles: Article[];            // Artículos a enviar
  tracking: TrackingEntry[];      // Historial de estados
  relatedShipmentId?: string;     // ID de envío relacionado (cambios)
  createdAt: Date;                // Fecha de creación
  updatedAt: Date;                // Última actualización
}
```

### ShipmentStatus

Estado del envío.

```typescript
enum ShipmentStatus {
  PENDING = 'PENDING',                  // Pendiente de preparación
  PREPARED = 'PREPARED',                // Preparado para entrega
  IN_TRANSIT = 'IN_TRANSIT',            // En tránsito
  DELIVERED = 'DELIVERED',              // Entregado
  CANCELLED = 'CANCELLED',              // Cancelado
  RETURNING = 'RETURNING',              // Devolución en tránsito
  RETURNED = 'RETURNED',                // Devolución completada
  EXCHANGE_PROCESSED = 'EXCHANGE_PROCESSED' // Cambio procesado
}
```

### Maquina de Estados

Validación estricta de transiciones de estado.

```typescript
PENDING → PREPARED → IN_TRANSIT → DELIVERED
   ↓                                   ↓
CANCELLED                          RETURNING
                                       ↓
                              RETURNED / EXCHANGE_PROCESSED
```

### ShipmentType

Tipo de envío.
`NORMAL`: Envío normal
`EXCHANGE`: Cambio de producto

```typescript
enum ShipmentType {
  NORMAL = 'NORMAL',
  EXCHANGE = 'EXCHANGE'
}
```

### CustomerInfo (Value Object)

Información del cliente.

```typescript
{
  customerId: string;                // ID del cliente
  name: string;                      // Nombre del cliente
  address: string;                   // Dirección del cliente
  city: string;                      // Ciudad del cliente
  zipCode: string;                   // Código postal del cliente
  phone: string;                     // Teléfono del cliente
}
```
### Article
Representa un artículo a enviar.

```typescript
{
  articleId: string;      // ID del artículo
  quantity: number;       // Cantidad
  price: number;          // Precio unitario
}
```

### ShipmentEvent

Representa un evento inmutable que registra un cambio en el envío. Base del Event Sourcing.

```typescript
{
  eventId: string;                // ID único del evento
  eventType: ShipmentEventType;   // Tipo de evento
  shipmentId: string;             // ID del envío afectado
  orderId: string;                // ID de la orden
  timestamp: Date;                // Cuándo ocurrió
  actor?: string;                 // Quién ejecutó la acción
  description?: string;           // Descripción del evento
  previousStatus?: string;        // Estado anterior
  newStatus?: string;             // Nuevo estado
  customerInfo?: CustomerInfo;    // Info del cliente (eventos de creación)
  articles?: Article[];           // Artículos (eventos de creación)
  relatedShipmentId?: string;     // Envío relacionado (cambios)
  errorMessage?: string;          // Mensaje de error (si aplica)
}
```
### ShipmentEventType 

Tipos de eventos:

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

### TrackingEntry

Representa un registro de estado del envío.

```typescript
{
  status: string;         // Estado en ese momento
  description: string;    // Descripción del cambio
  timestamp: Date;        // Cuándo ocurrió
  actor?: string;         // Quién lo ejecutó
}  
```
---
## Endpoints por Rol

### 🔓 Públicos (Sin autenticación)

```http
GET /health
```
**Descripción**: Verificar que el servicio está corriendo
**Entradas**: Sin datos
**Salidas**: JSON con el estado del servicio. Ejemplo:

```json
{
  "status": "OK",
  "service": "Delivery Service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```
---
```http
GET /api/shipments/tracking/:id
```
**Descripción**: Obtener el estado de un envío
**Entradas**: 
- id: ID del envío
**Salidas**: JSON con el estado del envío.
```json
{
  "success": true,
  "data": {
    "shipmentId": "ship_1234567890_abc123",
    "orderId": "order_123",
    "currentStatus": "IN_TRANSIT",
    "tracking": [
      {
        "status": "PENDING",
        "description": "Envío creado",
        "timestamp": "2024-01-15T10:00:00.000Z",
        "actor": "system"
      },
      {
        "status": "PREPARED",
        "description": "Paquete preparado",
        "timestamp": "2024-01-15T11:00:00.000Z",
        "actor": "admin_user"
      }
    ],
    "lastUpdate": "2024-01-15T11:00:00.000Z"
  }
}
```
---

### Endpoints de Usuario (Requier Autenticacion)

**Header requerido:**
```http
 Authorization: Bearer <token>
```
---
`GET /api/shipments/my-shipments`

**Descripción**: Obtener los envíos creados por el usuario actual

**Entradas**: Sin datos (query params opcionales):
- `limit`: Número de resultados (default: 50, max: 100)
- `skip`: Número de resultados a saltar (default: 0)

**Salidas**: JSON con los envíos creados por el usuario actual.

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "shipmentId": "ship_1234567890_abc123",
      "orderId": "order_123",
      "currentStatus": "IN_TRANSIT",
      "tracking": [
        {
          "status": "PENDING",
          "description": "Envío creado",
          "timestamp": "2024-01-15T10:00:00.000Z",
          "actor": "system"
        },
        {
          "status": "PREPARED",
          "description": "Paquete preparado",
          "timestamp": "2024-01-15T11:00:00.000Z",
          "actor": "admin_user"
        }
      ],
      "lastUpdate": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```
---
`GET /api/shipments/:id`

**Descripción**: Obtiene un envío específico
**Rol requerido**: `user`

**Entradas**: 
- `id`: ID del envío

**Salidas**: JSON con el envío creado por el usuario actual.
```json
{
  "success": true,
  "data": {
    "id": "ship_123",
    "orderId": "order_456",
    "status": "DELIVERED",
    "type": "NORMAL",
    "customerInfo": {
      "customerId": "user_789",
      "name": "Juan Pérez",
      "address": "Calle Falsa 123",
      "city": "Buenos Aires",
      "zipCode": "1234",
      "phone": "+54 11 1234-5678"
    },
    "articles": [
      {
        "articleId": "art_001",
        "quantity": 2,
        "price": 1500
      }
    ],
    "tracking": [ ... ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-16T18:00:00Z"
  }
}
```
---
`GET /api/shipments/order/:orderId`

**Descripción**: Obtiene todos los envíos de una orden
**Rol requerido**: `user`

**Entradas**: 
- `orderId`: ID de la orden

**Salidas**: JSON con los envíos de la orden.
```json
{
  "success": true,
  "data": [
    { /* envío 1 */ },
    { /* envío 2 */ }
  ],
  "count": 2
}
```
---
`POST /api/shipments/:id/return`

**Descripción**: Inicia proceso de devolución (CU06)
**Rol requerido**: `user`

**Entradas** (Params): 
- `id`: ID del envío

**Entradas** (body opcional):
```json
{
  "reason": "Producto defectuoso",  // Opcional
  "description": "El producto llegó dañado"  // Opcional
}
```

**Salidas**: JSON con el envío devuelto.
```json
{
  "success": true,
  "message": "Devolución iniciada exitosamente",
  "data": {
    "id": "ship_123",
    "status": "RETURNING",
    /* ... resto del envío */
  }
}
```
**Errores posibles**:
- `400`: El envío no está en estado `DELIVERED`
- `404`: Envío no encontrado
- `401`: Autenticación fallida

---

`POST /api/shipments/:id/exchange`

**Descripción**: Inicia proceso de cambio de producto (CU08)
**Rol requerido**: `user`

**Entradas** (Params): 
- `id`: ID del envío

**Entradas** (body opcional):
```json
{
  "newArticles": [
    {
      "articleId": "article_999",
      "quantity": 2,
      "price": 1500
    }
  ],
  "reason": "Cambio de talla",
  "description": "Quiero cambiar por talla M"
}
```

**Salidas**: JSON con el envío devuelto.
```json
{
  "success": true,
  "message": "Cambio iniciado exitosamente",
  "data": {
    "originalShipment": {
      "id": "ship_1234567890_abc123",
      "status": "EXCHANGE_PROCESSED",
      /* ... */
    },
    "newShipment": {
      "id": "ship_9876543210_xyz789",
      "status": "PENDING",
      "type": "EXCHANGE",
      "relatedShipmentId": "ship_1234567890_abc123",
      /* ... */
    }
  }
}
```

---
### Endpoints de Admin (Requieren Rol Admin)

**Headers requeridos:**
```
Authorization: Bearer <JWT_TOKEN>
```
El token debe contener `permissions: [admin]`.

--- 
`POST /api/shipments`

**Descripción**: Crea un nuevo envío manualmente
**Rol requerido**: `admin`

**Entradas** (body):
```json
{
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
      "articleId": "art_001",
      "quantity": 2,
      "price": 1500
    }
  ],
  "description": "Envío urgente"  // Opcional
}
```
**Salidas**: JSON con el envío creado (201).
```json
{
  "success": true,
  "message": "Envío creado exitosamente",
  "data": {
    "id": "ship_123",
    "orderId": "order_456",
    "status": "PENDING",
    "type": "NORMAL",
    "customerInfo": {
      "customerId": "user_789",
      "name": "Juan Pérez",
      "address": "Calle Falsa 123",
      "city": "Buenos Aires",
      "zipCode": "1234",
      "phone": "+54 11 1234-5678"
    },
    "articles": [
      {
        "articleId": "art_001",
        "quantity": 2,
        "price": 1500
      }
    ],
    "tracking": [ /* ... */ ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```
---
`GET /api/shipments`

**Descripción**: Obtiene todos los envíos creados
**Rol requerido**: `admin`

**Entradas**: Sin datos (query params opcionales):
- `limit`: Número de resultados (default: 50, max: 100)
- `skip`: Número de resultados a saltar (default: 0)

**Salidas**: JSON con los envíos creados.
```json
{
  "success": true,
  "data": [ /* array de envíos */ ],
  "pagination": {
    "limit": 50,
    "skip": 0,
    "total": 150,
    "pages": 3
  }
}
```
---
`GET /api/shipments/:id/events`

**Descripción**: Obtiene el historial completo de eventos de un envío desde el Event Store (Admin).
**Rol requerido**: `admin`

**Entradas**: 
- `id`: ID del envío

**Salidas**: JSON con el envío creado (200)
```json
{
  "success": true,
  "data": {
    "shipmentId": "ship_1234567890_abc123",
    "eventCount": 5,
    "events": [
      {
        "eventId": "evt_123",
        "eventType": "SHIPMENT_CREATED",
        "shipmentId": "ship_1234567890_abc123",
        "orderId": "order_123",
        "timestamp": "2024-01-15T10:00:00.000Z",
        "actor": "system",
        "newStatus": "PENDING",
        "customerInfo": { /* ... */ },
        "articles": [ /* ... */ ]
      },
      {
        "eventId": "evt_124",
        "eventType": "MOVED_TO_PREPARED",
        "shipmentId": "ship_1234567890_abc123",
        "timestamp": "2024-01-15T11:00:00.000Z",
        "actor": "admin_user",
        "previousStatus": "PENDING",
        "newStatus": "PREPARED"
      }
      /* ... más eventos ... */
    ]
  }
}
```
--- 
`POST /api/shipments/:id/prepare`

**Descripción**: Mueve envío a estado PREPARED (CU02)
**Rol requerido**: `admin`

**Entradas** (Params): 
- `id`: ID del envío

**Entradas** (body opcional):
```json
{
  "description": "Paquete preparado y verificado"  // Opcional
}
```

**Salidas**: JSON con el envío preparado (200).
```json
{
  "success": true,
  "message": "Envío movido a PREPARED",
  "data": {
    "id": "ship_123",
    "status": "PREPARED",
    /* ... resto del envío */
  }
}
```

**Errores posibles**:
- `400`: El envío no está en estado `PENDING`

---
`POST /api/shipments/:id/ship`

**Descripción**: Mueve envío a estado `IN_TRANSIT` (CU03)
**Rol requerido**: `admin`

**Entrada** (Params): 
- `id`: ID del envío

**Entrada** (body):
```json
{
  "description": "Paquete retirado por logística"  // Opcional
}
```

**Salidas**: JSON con el envío preparado (200).
```json
{
  "success": true,
  "message": "Envío movido a IN_TRANSIT",
  "data": {
    "id": "ship_123",
    "status": "IN_TRANSIT",
    /* ... */
  }
}
```
--- 
`POST /api/shipments/:id/deliver`

**Descripción**: Mueve envío a estado `DELIVERED` (CU04)
**Rol requerido**: `admin`

**Entrada** (Params): 
- `id`: ID del envío

**Entrada** (body):
```json
{
  "description": "Paquete entregado"  // Opcional
}
```

**Salidas**: JSON con el envío preparado (200).
```json
{
  "success": true,
  "message": "Envío movido a DELIVERED",
  "data": {
    "id": "ship_123",
    "status": "DELIVERED",
    /* ... */
  }
}
```
---
`POST /api/shipments/:id/cancel`

**Descripción**: Mueve envío a estado `CANCELLED` (CU05)
**Rol requerido**: `admin`
**Restricción**: Solo se puede cancelar en estados `PENDING` o `PREPARED`.

**Entrada** (Params): 
- `id`: ID del envío

**Entrada** (body):
```json
{
  "reason": "Cliente canceló la orden",  // Opcional
  "description": "Cancelación solicitada por cliente"  // Opcional
}
```

**Salidas**: JSON con el envío preparado (200).
```json
{
  "success": true,
  "message": "Envío cancelado exitosamente",
  "data": {
    "id": "ship_1234567890_abc123",
    "status": "CANCELLED",
    /* ... */
  }
}
```
**Errores posibles**:
- `400`: El envío no está en estado `PENDING` o `PREPARED`

---
`POST /api/shipments/:id/return/complete`

**Descripción**: Completa proceso de devolución (CU07)
**Rol requerido**: `admin`

**Entrada** (Params): 
- `id`: ID del envío

**Entrada** (body):
```json
{
  "productCondition": "good",  // "good" | "damaged" | "defective" (opcional)
  "notes": "Producto recibido en buen estado",  // Opcional
  "description": "Devolución procesada"  // Opcional
}
```

**Salidas**: JSON con el envío preparado (200).
```json
{
  "success": true,
  "message": "Devolución completada exitosamente",
  "data": {
    "id": "ship_1234567890_abc123",
    "status": "RETURNED",
    /* ... */
  }
}
```

**Errores posibles**:
- `400`: El envío no está en estado `RETURNING`

---
`POST /api/shipments/:originalShipmentId/exchange/:newShipmentId/complete`

**Descripción**: Completa proceso de cambio (CU09)
**Rol requerido**: `admin`

**Entrada** (Params):
- `originalShipmentId`: ID del envío original
- `newShipmentId`: ID del envío nuevo

**Entrada** (body):
```json
{
  "productCondition": "good",  // "good" | "damaged" | "defective" (opcional)
  "notes": "Producto recibido en buen estado",  // Opcional
  "description": "Devolución procesada"  // Opcional
}
```

**Salidas**: JSON con el envío preparado (200).
```json
{
  "success": true,
  "message": "Cambio completado exitosamente",
  "data": {
    "originalShipment": {
      "id": "ship_1234567890_abc123",
      "status": "EXCHANGE_PROCESSED",
      /* ... */
    },
    "newShipment": {
      "id": "ship_9876543210_xyz789",
      "status": "PREPARED",
      /* ... */
    },
    "nextAction": "already_processing"
  }
}
```

**Errores posibles**:
- `400`: El envío no está en estado `EXCHANGE_PROCESSED`

---

## Interfaz RabbitMQ

### 1. Topología de Mensajería 

**Exchanges utilizados:**
|Propiedad | Valor |
|----------|-------|
|Nombre      | `ecommerce_events`  |
|Tipo   | `Topic`  |
|Durable   | True  |
|Auto-Delete | False |

Este exchange centraliza toda la comunicacion entre micriservicios del sistema e-commerce.

---

### 2. Queues

Cola 1: `delivery.payment_approved`

**Vinculada a:** `ecommerce_events`
**Routing key**: `order.payment.approved`
**Durable**: True
**Consumer**: `PaymentApprovedConsumer`
**Proposito**: Recibe una notificación de que el pago de una orden ha sido aprobado para crear envíos automaticamente.

---
Cola 2: `delivery.order_refund`

**Vinculada a:** `ecommerce_events`
**Routing key**: `order.refund.processed`
**Durable**: True
**Consumer**: `OrderRefundConsumer`
**Proposito**: Recibe confirmaciones de reembolsos de ordenes y crea envíos de devoluciones.

---
Cola 3: `delivery.logout`

**Vinculada a:** `ecommerce_events`
**Routing key**: `auth.logout`
**Durable**: True
**Consumer**: `LogoutConsumer`
**Proposito**: Recibe notificaciones de logout para invalidar sesiones/tokens.

---

### 3. Eventos que consume (Escucha)

#### 1. Evento 1: `PAYMENT_APPROVED`

**Origen**: Microservicio Orders.
**Exchange**: `ecommerce_events`
**Routing key**: `order.payment.approved`
**Cola que escucha**: `delivery.payment_approved`
**Consumer**: `PaymentApprovedConsumer`

**Estructura esperada del mensaje**:
```json
{
  "type": "PAYMENT_APPROVED",
  "orderId": "order_456",
  "customerId": "user_789",
  "customerInfo": {
    "customerId": "user_789",
    "name": "Juan Pérez",
    "address": "Calle Falsa 123",
    "city": "Buenos Aires",
    "zipCode": "1234",
    "phone": "+54 11 1234-5678"
  },
  "articles": [
    {
      "articleId": "art_001",
      "quantity": 2,
      "price": 1500
    }
  ],
  "paymentMethod": "credit_card",
  "totalAmount": 3000,
  "timestamp": "2024-01-15T09:55:00.000Z"
}
```

**Validaciones**:
- El `orderId` Requerido, string no vacío.
- El `articles` Requerido, array con al menos 1 elemento.
- El `customerInfo` o `customerId + address` Requerido.

**Acciones al recibir mensaje**:
1. Valida el mensaje
2. Mapea la información del cliente y artículos
3. Ejecuta el CUO1 - Registrar envío
4. Crear un nuevo envio con estado `PENDING`
5. Guardar el evento en el Event Store
6. Actualiza proyección de lectura en MongoDB
7. Emite evento `SHIPPING_CREATED` a Exchange

---
#### 2. Evento 2: `ORDER_REFUND`

**Origen**: Microservicio Orders.
**Exchange**: `ecommerce_events`
**Routing key**: `order.refund.processed`
**Cola que escucha**: `delivery.order_refund`
**Consumer**: `OrderRefundConsumer`

**Estructura esperada del mensaje**:
```json
{
  "type": "ORDER_REFUND",
  "orderId": "order_456",
  "customerId": "user_789",
  "refundAmount": 3000,
  "reason": "Cancelación de orden",
  "timestamp": "2024-01-15T11:00:00.000Z"
}
```

**Validaciones**:
- El `orderId` Requerido, string no vacío.
**Errores posibles**:
- `400`: `Mensaje inválido: falta campo 'orderId'`

**Acciones al recibir mensaje**:
1. Valida el mensaje
2. Busca envios relacionados con el `orderId`
3. Evalua el estado de cada envío
  * `PENDING/PREPARED`: Puede ser cancelado directamente
  * `IN_TRANSIT`: Se gestionará devolución al llegar
  * `DELIVERED`: Se debe iniciar devolución
  * `RETURNING/RETURNED`: Ya en proceso o completado
  * `CANCELLED`: Ya cancelado
4. Registra evento de refund en tracking
5. NO realiza acciones automaticas, solo registra para auditoria, tampoco emite eventos.

---
#### 3. Evento 3: `LOGOUT`

**Origen**: Microservicio Auth.
**Exchange**: `ecommerce_events`
**Routing key**: `auth.logout`
**Cola que escucha**: `delivery.logout`
**Consumer**: `LogoutConsumer`

**Estructura esperada del mensaje**:
```json
{
  "type": "LOGOUT",
  "userId": "user_789",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "timestamp": "2024-01-15T18:00:00.000Z"
}
```

**Validaciones**:
- El `userId` Requerido, string no vacío.
- El `token` Requerido, string no vacío.

**Errores posibles**:
- `400`: `Mensaje inválido: falta campo 'userId'`

**Acciones al recibir mensaje**:
1. Valida estructura del mensaje
2. Registra evento de logout en logs
3. Invalidar tokens en cache.

---
### 4. Eventos que produce (Publica)

#### 1. Evento 1: `SHIPPING_CREATED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.created`
**Descripcion**: Se emite cuando se crea un nuevo envío, ya sea automáticamente por pago aprobado o manualmente por admin.

**Estructura esperada del mensaje**:
```json
{
  "type": "SHIPPING_CREATED",
  "shipmentId": "ship_1234567890_abc123",
  "orderId": "order_456",
  "status": "PENDING",
  "type_shipment": "NORMAL",
  "customerInfo": {
    "customerId": "user_789",
    "name": "Juan Pérez",
    "address": "Calle Falsa 123",
    "city": "Buenos Aires",
    "zipCode": "1234",
    "phone": "+54 11 1234-5678"
  },
  "articles": [
    {
      "articleId": "art_001",
      "quantity": 2,
      "price": 1500
    }
  ],
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Consumidores**: Stats, orders (opcional)

---

#### 2. Evento 2: `SHIPPING_STATE_CHANGED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.state.changed`
**Descripcion**: Notifica cambios de estado del envío durante su ciclo de vida normal. Lo dispara:
CU02 - Pasar a Preparado, 
CU03 - Pasar a En Camino, 


**Estructura esperada del mensaje**:
```json
{
  "type": "SHIPPING_STATE_CHANGED",
  "eventType": "MOVED_TO_PREPARED",  // O "MOVED_TO_IN_TRANSIT"
  "shipmentId": "ship_123",
  "orderId": "order_456",
  "status": "PREPARED",  // Estado nuevo
  "previousStatus": "PENDING",  // Estado anterior
  "timestamp": "2024-01-15T14:00:00.000Z"
}
```

**Consumidores**: Stats, orders para actualizar estado de orden.
**Valores posibles para `eventType`:**
- `MOVED_TO_PREPARED`
- `MOVED_TO_IN_TRANSIT`

---

#### 3. Evento 3: `SHIPPING_DELIVERED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.delivered`
**Descripcion**: Notifica que un envío ha sido entregado exitosamente al cliente. Marca el fin del ciclo de vida normal del envío. Lo dispara el CU04 - Pasar a Entregado.

**Estructura esperada del mensaje**:
```json
{
  "type": "SHIPPING_DELIVERED",
  "shipmentId": "ship_1234567890_abc123",
  "orderId": "order_123",
  "customerInfo": {
    "customerId": "user_456",
    "name": "Juan Pérez"
  },
  "deliveredAt": "2024-01-15T14:00:00.000Z",
  "timestamp": "2024-01-15T14:00:00.000Z"
}
```

---

#### 4. Evento 4: `SHIPPING_CANCELLED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.cancelled`
**Descripcion**: Notifica que un envío ha sido cancelado. Orders debe procesar el reembolso correspondiente. Lo dispara el CU05 - Cancelar Envío.

**Estructura esperada del mensaje**:
```json
{
  "type": "SHIPPING_CANCELLED",
  "shipmentId": "ship_1234567890_abc123",
  "orderId": "order_123",
  "status": "CANCELLED",
  "cancelledAt": "2024-01-15T12:00:00.000Z",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```
**Consumidores**: Orders para procesar reembolso.
**Accion esperada en Orders**: Iniciar proceso de reembolso automático al detectar este evento.

---

#### 5. Evento 5: `RETURN_INITIATED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.return.initiated`
**Descripcion**: Notifica que un cliente ha iniciado una devolución. El producto está en tránsito del cliente al almacén. Lo dispara el CU06 - Iniciar Devolución - Reembolso.

**Estructura esperada del mensaje**:
```json
{
  "type": "RETURN_INITIATED",
  "shipmentId": "ship_1234567890_abc123",
  "orderId": "order_123",
  "customerInfo": {
    "customerId": "user_456",
    "name": "Juan Pérez"
  },
  "articles": [
    {
      "articleId": "article_789",
      "quantity": 2,
      "price": 1500
    }
  ],
  "initiatedAt": "2024-01-15T15:00:00.000Z",
  "timestamp": "2024-01-15T15:00:00.000Z"
}
```
**Consumidores**: Orders para procesar reembolso.
**Accion esperada en Orders**: Marcar orden como "en proceso de devolución" pero NO procesar reembolso aún.

---

#### 6. Evento 6: `RETURN_COMPLETED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.return.completed`
**Descripcion**: Notifica que el producto ha sido devuelto al almacén y verificado. Orders debe procesar el reembolso. Lo dispara el CU07 - Completar Devolución.

**Estructura esperada del mensaje**:
```json
{
  "type": "RETURN_COMPLETED",
  "shipmentId": "ship_123",
  "orderId": "order_456",
  "customerInfo": {
    "customerId": "user_789"
  },
  "completedAt": "2024-01-18T14:00:00.000Z",
  "timestamp": "2024-01-18T14:00:00.000Z"
}
```
**Consumidores**: Orders para procesar reembolso.
**Accion esperada en Orders**: Marcar orden como "devolución completada" y procesar reembolso. Este evento es CRÍTICO porque desencadena el reembolso definitivo en Orders.

---

#### 7. Evento 7: `EXCHANGE_INITIATED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.exchange.initiated`
**Descripcion**: Notifica que se ha iniciado un cambio de producto. Se crean dos envíos vinculados (original y nuevo). Lo dispara el CU08 - Iniciar Cambio de Producto.

**Estructura esperada del mensaje**:
```json
{
  "type": "EXCHANGE_INITIATED",
  "originalShipmentId": "ship_1234567890_abc123",
  "newShipmentId": "ship_9876543210_xyz789",
  "orderId": "order_123",
  "customerInfo": {
    "customerId": "user_456",
    "name": "Juan Pérez"
  },
  "articles": [
    {
      "articleId": "article_789",
      "quantity": 2,
      "price": 1500
    }
  ],
  "initiatedAt": "2024-01-15T17:00:00.000Z",
  "timestamp": "2024-01-15T17:00:00.000Z"
}
```
**Consumidores**: Orders para marcar orden como en cambio.

---

#### 8. Evento 8: `EXCHANGE_COMPLETED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.exchange.completed`
**Descripcion**: Notifica que se ha creado el nuevo envío de cambio vinculado al envío original. Lo dispara CU08 - Iniciar Cambio de Producto (para el nuevo envío)

**Estructura esperada del mensaje**:
```json
{
  "type": "EXCHANGE_COMPLETED",
  "newShipmentId": "ship_789",
  "originalShipmentId": "ship_123",
  "orderId": "order_456",
  "status": "PENDING",
  "completedAt": "2024-01-17T10:00:05.000Z",
  "timestamp": "2024-01-17T10:00:05.000Z"
}
```
**Consumidores**: Orders para procesar reembolso.

---

#### 9. Evento 9: `EXCHANGE_FINALIZED`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.exchange.completed.final`
**Descripcion**: : Notifica que el cambio ha sido completado: producto original verificado y nuevo producto preparado para envío. Lo dispara el CU09 - Completar Cambio de Producto.

**Estructura esperada del mensaje**:
```json
{
  "type": "EXCHANGE_FINALIZED",
  "originalShipmentId": "ship_123",
  "newShipmentId": "ship_789",
  "orderId": "order_456",
  "productCondition": "good",  // "good" | "damaged" | "defective"
  "newShipmentStatus": "PREPARED",  // O "PENDING"
  "timestamp": "2024-01-18T15:00:00.000Z"
}
```
**Consumidores**: Orders.
**Accion esperada en Orders**: Actualizar estado de orden.

---

#### 10. Evento 10: `SHIPPING_ERROR`

**Exchange**: `ecommerce_events`
**Routing key**: `shipping.error`
**Descripcion**: Se emite cuando ocurre un error en el procesamiento de un envío. Lo dispara cualquier CU que falle. 

**Estructura esperada del mensaje**:
```json
{
  "type": "SHIPPING_ERROR",
  "shipmentId": "ship_123",
  "orderId": "order_456",
  "errorMessage": "Error al procesar envío: ...",
  "occurredAt": "2024-01-15T10:00:00.000Z",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```
**Consumidores**: Orders.

---
### 5. Manejo de Errores y Resiliencia

#### 1. Politica de Reintentos 

Todos los consumers implementan reintentos automaticos. Maximo 3 intentos por mensaje. 
* Se utiliza header `x-retry-count` para controlar el número de reintentos.

#### 2. Idempotencia

El sistema garantiza idempotencia mediante:
1. Event Store: `eventId` como clave primaria 
2. Inserción: `insertMany` con `ordered: false` ignora duplicados
3. Codigo de error: 11000: Manejo especifico de claves duplicadas sin lanzar error. 

---

### 6. Diagrama de Flujo de Eventos
```
┌─────────────┐  PAYMENT_APPROVED   ┌──────────────┐
│   Orders    │─────────────────────→│   Delivery   │
│  Service    │                      │   Service    │
└─────────────┘                      └──────────────┘
                                            │
                                            │ SHIPPING_CREATED
                                            │ SHIPPING_STATE_CHANGED
                                            │ SHIPPING_DELIVERED
                                            │ SHIPPING_CANCELLED
                                            │ RETURN_INITIATED
                                            │ RETURN_COMPLETED
                                            │ EXCHANGE_INITIATED
                                            │ EXCHANGE_COMPLETED
                                            ↓
┌─────────────┐                      ┌──────────────┐
│    Stats    │←─────────────────────│   RabbitMQ   │
│  Service    │                      │   Exchange   │
└─────────────┘                      └──────────────┘
                                            ↓
┌─────────────┐                      ┌──────────────┐
│   Orders    │←─────────────────────│  (routing)   │
│  Service    │  Eventos críticos    └──────────────┘
└─────────────┘  (cancelación, 
                  devolución, etc)


┌─────────────┐  ORDER_REFUND        ┌──────────────┐
│   Orders    │─────────────────────→│   Delivery   │
│  Service    │                      │   Service    │
└─────────────┘                      └──────────────┘


┌─────────────┐  LOGOUT              ┌──────────────┐
│    Auth     │─────────────────────→│   Delivery   │
│  Service    │                      │   Service    │
└─────────────┘                      └──────────────┘
```

---
### 7. Tabla de Resumen de Eventos

| Evento | Routing Key | Produce/Consume | Prioridad | Caso de Uso | Crítico |
|--------|-------------|-----------------|-----------|-------------|---------|
| `PAYMENT_APPROVED` | `order.payment.approved` | Consume | - | CU01 | ⚠️ Sí |
| `SHIPPING_CREATED` | `shipping.created` | Produce | 0 | CU01 | No |
| `SHIPPING_STATE_CHANGED` | `shipping.state.changed` | Produce | 0 | CU02, CU03 | No |
| `SHIPPING_DELIVERED` | `shipping.delivered` | Produce | 5 | CU04 | ⚠️ Sí |
| `SHIPPING_CANCELLED` | `shipping.cancelled` | Produce | 5 | CU05 | ⚠️ Sí |
| `RETURN_INITIATED` | `shipping.return.initiated` | Produce | 6 | CU06 | No |
| `RETURN_COMPLETED` | `shipping.return.completed` | Produce | 7 | CU07 | ⚠️⚠️ Crítico |
| `EXCHANGE_INITIATED` | `shipping.exchange.initiated` | Produce | 6 | CU08 | No |
| `EXCHANGE_COMPLETED` | `shipping.exchange.completed` | Produce | 5 | CU08 | No |
| `EXCHANGE_FINALIZED` | `shipping.exchange.completed.final` | Produce | 7 | CU09 | ⚠️ Sí |
| `ORDER_REFUND` | `order.refund.processed` | Consume | - | - | No |
| `LOGOUT` | `auth.logout` | Consume | - | - | No |
| `SHIPPING_ERROR` | `shipping.error` | Produce | 9 | Todos | ⚠️⚠️ Crítico |