# Microservicio de Envíos (Delivery Service)

Microservicio de gestión de envíos implementado con TypeScript, Express, MongoDB y RabbitMQ siguiendo principios de **Domain-Driven Design (DDD)**, con persistencia en MongoDB (patrón Repository) y eventos de integración vía RabbitMQ.

## Indice 

- [Descripción del Microservicio](#descripción-del-microservicio)
- [Casos de Uso](#casos-de-uso)
- [Entidades del Dominio](#entidades-del-dominio)
- [Endpoints por Rol](#endpoints-por-rol)
- [Interfaz RabbitMQ](#interfaz-rabbitmq)

## Descripción del Microservicio
El Microservicio de Envíos es responsable de gestionar todo el ciclo de vida del envío de órdenes de compra, desde que Orders confirma la orden (`order_placed`) hasta la entrega final, devolución o cambio del pedido.

---

## Casos de Uso

#### **CU01 - Registrar Envío**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Disparador**    | Evento `order_placed` publicado por Orders en su exchange fanout `order_placed` |
| **Descripción**   | Cuando se confirma una orden, el sistema crea automáticamente un nuevo envío con estado `PENDING`. La dirección se copia como snapshot inmutable desde el agregado `CustomerInfo` propio de Delivery. Si el usuario no tiene dirección registrada, no se crea el envío y se publica `SHIPPING_ERROR`. |
| **Evento emitido**| `SHIPPING_CREATED` → Routing key: `shipping.created` |
| **Estado inicial**| `PENDING` |

Flujo:

1. Escucha `order_placed` en la cola propia durable `delivery_order_placed` (bind al exchange fanout `order_placed`, routing key vacía)
2. Valida el campo `message` del sobre `{ correlation_id, message }` con Zod
3. Busca la `CustomerInfo` del `userId`; si no existe, publica `SHIPPING_ERROR` y hace ack
4. Crea el agregado `Shipment` con estado `PENDING` y snapshot de la dirección en `shippingAddress`
5. Persiste en MongoDB — el índice único parcial `(orderId, type=NORMAL)` garantiza idempotencia: clave duplicada ⇒ ack sin recrear
6. Publica `SHIPPING_CREATED` a `shipping_events` preservando el `correlation_id` entrante

**Evento que emite**: `SHIPPING_CREATED` (routing key: `shipping.created`)
**Nota**: El ecosistema no publica ningún evento de pago; `order_placed` es el único disparador real disponible. 

---
#### **CU02 - Pasar a Preparado**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | El operario confirma que todos los artículos han sido empaquetados correctamente y están listos para ser retirados por la empresa logística. |
| **Evento emitido**| `SHIPPING_STATE_CHANGED` (eventType: `MOVED_TO_PREPARED`) → Routing key: `shipping.state.changed` |
| **Transición de estado**| `PENDING` → `PREPARED` |

Flujo:

1. Admin solicita transición de estado mediante endpoint
2. Valida que el envío esté en estado PENDING
3. Actualiza estado a PREPARED
4. Registra tracking entry con actor y descripción
5. Publica `SHIPPING_STATE_CHANGED` con eventType `MOVED_TO_PREPARED`

**Transición de estado**: `PENDING` → `PREPARED`
**Evento que emite**: `SHIPPING_STATE_CHANGED` (routing key: `shipping.state.changed`, eventType: `MOVED_TO_PREPARED`)

---

#### **CU03 - Pasar a En Camino**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin  |
| **Descripción**   | La empresa logística retira el paquete del almacén y comienza el trayecto hacia el domicilio del cliente. |
| **Evento emitido**| `SHIPPING_STATE_CHANGED` (eventType: `MOVED_TO_IN_TRANSIT`) → Routing key: `shipping.state.changed` |
| **Transición de estado**| `PREPARED` → `IN_TRANSIT` |

Flujo:

1. Admin solicita transición de estado mediante endpoint
2. Valida que el envío esté en estado PREPARED
3. Actualiza estado a IN_TRANSIT
4. Registra tracking entry con actor y descripción
5. Publica `SHIPPING_STATE_CHANGED` con eventType `MOVED_TO_IN_TRANSIT`. A partir de este punto, el envío NO puede ser cancelado

**Transición de estado**: `PREPARED` → `IN_TRANSIT`
**Evento que emite**: `SHIPPING_STATE_CHANGED` (routing key: `shipping.state.changed`, eventType: `MOVED_TO_IN_TRANSIT`)
**Restricción importante**: Una vez en tránsito, *NO se puede cancelar el envío*.

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
3. Actualiza estado a DELIVERED
4. Registra tracking entry con actor y descripción
5. Publica `SHIPPING_DELIVERED`

**Transición de estado**: `IN_TRANSIT` → `DELIVERED`
**Evento que emite**: `SHIPPING_DELIVERED` (routing key: `shipping.delivered`)

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
3. Actualiza estado a CANCELLED y registra tracking entry con el motivo
4. Publica `SHIPPING_CANCELLED` con el campo `reason`
5. Notifica a Orders para procesar reembolso automático

**Transición de estado**: `PENDING` o `PREPARED` → `CANCELLED`
**Evento que emite**: `SHIPPING_CANCELLED` (routing key: `shipping.cancelled`)
**Restricción**: Solo se puede cancelar en estados PENDING o PREPARED. NO se puede cancelar si está IN_TRANSIT o DELIVERED.

---

#### **CU06 - Iniciar Devolución - Reembolso**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**    | User |
| **Descripción**   | El cliente solicita devolver el producto para obtener un reembolso. El envío pasa a `RETURNING`; el producto está en tránsito del cliente al almacén del ecommerce. |
| **Evento emitido**| `RETURN_INITIATED` → Routing key: `shipping.return.initiated` |
| **Transición de estado**| `DELIVERED` → `RETURNING` |

Flujo:

1. Cliente solicita devolución mediante endpoint (404 si el envío no le pertenece)
2. Valida que el envío esté en estado DELIVERED
3. Actualiza estado a RETURNING y registra tracking entry
4. Publica `RETURN_INITIATED`
5. Notifica a Orders sobre inicio de devolución

**Transición de estado**: `DELIVERED` → `RETURNING`
**Evento que emite**: `RETURN_INITIATED` (routing key: `shipping.return.initiated`)
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
3. Actualiza estado a RETURNED y registra tracking entry
4. Publica `RETURN_COMPLETED` con el campo `productCondition`
5. Notifica a Orders para ejecutar reembolso

**Transición de estado**: `RETURNING` → `RETURNED`
**Evento que emite**: `RETURN_COMPLETED` (routing key: `shipping.return.completed`)
**Importante**: Este evento es crítico para que Orders procese el reembolso al cliente.

---

#### **CU08 - Iniciar Cambio de Producto**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**    | User |
| **Descripción**   | El cliente solicita cambiar un producto. Se crean DOS procesos paralelos:
1. Envío original: El producto viaja del cliente al almacén (devolución)
2. Nuevo envío: Se prepara un nuevo envío con los mismos artículos del original (el motivo va en `description`)
Ambos envíos quedan vinculados mediante `relatedShipmentId`. |
| **Evento emitido**| `EXCHANGE_INITIATED` → Routing key: `shipping.exchange.initiated` |
| **Transición de estado**| `DELIVERED`  → `RETURNING`. Se crea un envio de tipo `EXCHANGE` con estado `PENDING`|

Flujo:

1. Cliente solicita cambio mediante endpoint (404 si el envío no le pertenece)
2. Valida que el envío original esté DELIVERED
3. Mueve el original a RETURNING
4. Crea nuevo envío tipo EXCHANGE en estado PENDING, vinculado en ambos sentidos por `relatedShipmentId`
5. Publica `EXCHANGE_INITIATED`

**Nota**: Ambos envíos están vinculados y pueden rastrearse entre sí. El original queda en `RETURNING` hasta que se complete el cambio (CU09).

---

#### **CU09 - Completar Cambio de Producto**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Admin |
| **Descripción**   | El operario verifica que el producto original haya llegado al almacén, valida su estado y decide si el cambio procede o se rechaza.
| **Evento emitido**| `EXCHANGE_FINALIZED` → Routing key: `shipping.exchange.completed.final` |
| **Transición de estado**| Según condición del producto (ver regla abajo) |

**Precondición**: el envío original debe estar en `RETURNING` **y tener** `relatedShipmentId` (una devolución pura nunca puede completarse como cambio).

**Regla según condición del producto original**:

- `good` o `defective` → el cambio **procede**:
  - Envío original: `RETURNING` → `EXCHANGE_PROCESSED`
  - Nuevo envío: `PENDING` → `PREPARED`
- `damaged` → el cambio **se rechaza**:
  - Envío original: `RETURNING` → `RETURNED`
  - Nuevo envío: `PENDING` → `CANCELLED`

Flujo:

1. Operario recibe producto original en almacén
2. Valida condición del producto (good/damaged/defective)
3. Aplica la regla de arriba a ambos envíos y registra tracking entries
4. Publica `EXCHANGE_FINALIZED` con `productCondition` y los estados finales de ambos envíos

**Evento que emite**: `EXCHANGE_FINALIZED` (routing key: `shipping.exchange.completed.final`)
**Importante**: Este evento es crítico para que Orders actualice el estado de la orden.

---
#### **CU10 - Consultar Estado de un Envío** 

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | Sin validacion |
| **Descripción**   | Un usuario sin validacion puede consultar el estado de un envio a partir del id |


Flujo:

1. El usuario ingresa el id del envío
2. Valida que el envío exista
3. Muestra el estado del envío y su historial de cambios

--- 

#### **CU11 - Consultar todos los envios existentes**

| **Campo**         | **Descripción** |
|-------------------|------------------|
| **Actor**         | admin / user |
| **Descripción**   | El administrador puede consultar todos los envíos existentes. Un usuario autenticado con rol `user` obtiene por el mismo endpoint **solo sus propios envíos**. |

Flujo:

1. Si el actor es admin, busca todos los envíos creados sin importar el estado; si es user, solo los propios
2. Devuelve los envíos (paginado)

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
  shippingAddress: ShippingAddress; // Snapshot inmutable copiado de CustomerInfo al crear el envío
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
  RETURNING = 'RETURNING',              // Devolución o cambio en tránsito
  RETURNED = 'RETURNED',                // Devolución completada
  EXCHANGE_PROCESSED = 'EXCHANGE_PROCESSED' // Cambio procesado
}
```

### Maquina de Estados

Validación estricta de transiciones de estado.

```
PENDING ──→ PREPARED ──→ IN_TRANSIT ──→ DELIVERED
   │            │                           │
   ↓            ↓                           ↓
CANCELLED   CANCELLED                   RETURNING
                                            │
            ┌───────────────────────────────┤
            ↓ (devolución, o cambio         ↓ (cambio aceptado; requiere
            │  rechazado por daño)          │  relatedShipmentId)
         RETURNED                    EXCHANGE_PROCESSED
```

**Estados terminales**: `CANCELLED`, `RETURNED`, `EXCHANGE_PROCESSED` (no aceptan más transiciones).

**Reglas**:
- Cancelar solo es posible desde `PENDING` o `PREPARED`.
- `EXCHANGE_PROCESSED` solo es alcanzable por envíos con `relatedShipmentId` (es decir, con un cambio iniciado). Una devolución pura (`RETURNING` sin vínculo) solo puede terminar en `RETURNED`.

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

### ShippingAddress (Value Object)

Dirección a la que se despacha un envío concreto. Snapshot **inmutable** copiado desde `CustomerInfo` al momento de crear el envío: cambios posteriores en los datos del cliente no afectan envíos existentes. `customerId` es además el dueño del envío (base del control de propiedad).

```typescript
{
  customerId: string;                // ID del cliente dueño del envío
  name: string;                      // Nombre del destinatario
  address: string;                   // Dirección de entrega
  city: string;                      // Ciudad
  zipCode: string;                   // Código postal
  phone: string;                     // Teléfono de contacto
}
```

### CustomerInfo (Agregado)

Datos de contacto y dirección del usuario, agregado propio de Delivery (ningún otro microservicio del ecosistema los almacena). Es **modificable**: se gestiona vía `GET/PUT /api/shipments/customer-info`. Al crear un envío se copia como snapshot inmutable en `shippingAddress`.

```typescript
{
  userId: string;         // Dueño de los datos (relación uno a uno)
  name: string;           // Nombre del destinatario
  address: string;        // Dirección
  city: string;           // Ciudad
  zipCode: string;        // Código postal
  phone: string;          // Teléfono
  updatedAt: Date;        // Última actualización
}
```

### Article
Representa un artículo a enviar.

```typescript
{
  articleId: string;      // ID del artículo
  quantity: number;       // Cantidad
}
```

### TrackingEntry

Representa un registro de estado del envío.

```typescript
{
  status: string;         // Estado en ese momento
  description: string;    // Descripción del cambio
  timestamp: Date;        // Cuándo ocurrió
  actor: string;          // "system" o el usuario que disparó la transición
}  
```
---
## Endpoints por Rol

### Públicos (Sin autenticación)

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

### Endpoints de Usuario (Requieren Autenticación)

**Header requerido:**
```http
 Authorization: Bearer <token>
```

#### Autenticación y autorización

- El JWT emitido por Auth contiene solo los claims `tokenID` y `userID` (sin `exp`, `iat` ni `permissions`).
- Delivery **no verifica la firma localmente**: valida el token con `GET {AUTH_SERVICE_URL}/users/current` (reenviando el header `Authorization`) y cachea el usuario en un `Map` en memoria con TTL de ~5 minutos.
- Los permisos (`admin`) vienen del array `permissions` del **usuario** devuelto por Auth, no del token.
- El logout llega por RabbitMQ (exchange fanout `auth`) e invalida la entrada correspondiente del cache.
- **Propiedad (ownership)**: en los endpoints de usuario, si el envío consultado no pertenece al usuario autenticado se responde **404** (nunca 403), para no revelar la existencia del recurso.

---
`GET /api/shipments/customer-info`

**Descripción**: Obtiene los datos de dirección del usuario autenticado (agregado `CustomerInfo`)
**Rol requerido**: `user`

**Entradas**: Sin datos

**Salidas**: JSON con la dirección registrada.
```json
{
  "success": true,
  "data": {
    "userId": "user_789",
    "name": "Juan Pérez",
    "address": "Calle Falsa 123",
    "city": "Buenos Aires",
    "zipCode": "1234",
    "phone": "+54 11 1234-5678",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```
**Errores posibles**:
- `404`: El usuario no registró dirección
- `401`: Autenticación fallida

---
`PUT /api/shipments/customer-info`

**Descripción**: Crea o actualiza los datos de dirección del usuario autenticado. Sin estos datos registrados no se pueden crear envíos automáticos (CU01). Modificarlos **no altera** los envíos ya creados: cada uno conserva su propio snapshot `shippingAddress`.
**Rol requerido**: `user`

**Entradas** (body, validado con Zod):
```json
{
  "name": "Juan Pérez",
  "address": "Calle Falsa 123",
  "city": "Buenos Aires",
  "zipCode": "1234",
  "phone": "+54 11 1234-5678"
}
```

**Salidas**: JSON con la dirección guardada (incluye `updatedAt`).
```json
{
  "success": true,
  "message": "Dirección guardada exitosamente",
  "data": {
    "userId": "user_789",
    "name": "Juan Pérez",
    "address": "Calle Falsa 123",
    "city": "Buenos Aires",
    "zipCode": "1234",
    "phone": "+54 11 1234-5678",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```
**Errores posibles**:
- `400`: Body inválido
- `401`: Autenticación fallida

---
`GET /api/shipments/:id`

**Descripción**: Obtiene el detalle completo de un envío
**Rol requerido**: `user` o `admin`. Un user solo puede ver sus propios envíos (404 si no es dueño); un admin puede ver cualquiera.

**Entradas** (Params):
- `id`: ID del envío

**Salidas**: JSON con el envío.
```json
{
  "success": true,
  "data": {
    "id": "ship_1234567890_abc123",
    "orderId": "order_123",
    "status": "IN_TRANSIT",
    "type": "NORMAL",
    "shippingAddress": { /* ... */ },
    "articles": [ /* ... */ ],
    "tracking": [ /* ... */ ],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```
**Errores posibles**:
- `404`: El envío no existe o no pertenece al usuario
- `401`: Autenticación fallida

---
`POST /api/shipments/:id/return`

**Descripción**: Inicia proceso de devolución (CU06)
**Rol requerido**: `user`

**Entradas** (Params): 
- `id`: ID del envío

**Entradas** (body):
```json
{
  "reason": "Producto defectuoso",  // Requerido: motivo de la devolución
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
- `404`: El envío no existe o no pertenece al usuario
- `401`: Autenticación fallida

---

`POST /api/shipments/:id/exchange`

**Descripción**: Inicia proceso de cambio de producto (CU08)
**Rol requerido**: `user`

**Entradas** (Params): 
- `id`: ID del envío

**Entradas** (body):
```json
{
  "description": "Cambio de talle: necesito talle 39"  // Requerido: motivo del cambio
}
```
**Nota**: el nuevo envío de cambio lleva **los mismos artículos** del original; no se envían artículos nuevos. El `description` detalla el motivo.

**Salidas**: JSON con el envío devuelto.
```json
{
  "success": true,
  "message": "Cambio iniciado exitosamente",
  "data": {
    "originalShipment": {
      "id": "ship_1234567890_abc123",
      "status": "RETURNING",
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
**Errores posibles**:
- `400`: El envío no está en estado `DELIVERED`
- `404`: El envío no existe o no pertenece al usuario
- `401`: Autenticación fallida

---
### Endpoints de Admin (Requieren Rol Admin)

**Headers requeridos:**
```
Authorization: Bearer <JWT_TOKEN>
```
El usuario devuelto por Auth (`GET /users/current`) debe incluir `"admin"` en su array `permissions`.

---
`GET /api/shipments`

**Descripción**: Obtiene todos los envíos creados (CU11)
**Rol requerido**: `user` o `admin`. Un admin obtiene todos los envíos; un user obtiene **solo sus propios envíos**.

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
  "reason": "Cliente canceló la orden",  // Requerido: motivo de la cancelación
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
  "productCondition": "good",  // Requerido: "good" | "damaged" | "defective"
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
  "productCondition": "good",  // Requerido: "good" | "damaged" | "defective"
  "notes": "Producto recibido en buen estado",  // Opcional
  "description": "Cambio procesado"  // Opcional
}
```

**Salidas**: JSON con ambos envíos (200). Ejemplo para `productCondition: "good"`:
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
    }
  }
}
```

**Errores posibles**:
- `400`: El envío original no está en estado `RETURNING` o no tiene envío de cambio vinculado (`relatedShipmentId`)

> **Nota**: no existe creación manual de envíos por HTTP. Un `Shipment` solo nace al escuchar
> el evento `order_placed` (CU01). No hay endpoint `POST /api/shipments`.

---

## Interfaz RabbitMQ

### 1. Topología de Mensajería

El ecosistema Go usa **un exchange por evento** (verificado contra el broker real): `auth` y `order_placed` son fanout **no durables** (transient); `place_order` y `article_exist` son direct (RPC interno, no nos incumben). Routing key vacía. Delivery nunca redeclara los exchanges de Go con otro tipo **ni otra durabilidad** (asertar con `durable: false` o bindear sin asertar); solo se *bindea* a ellos. Para publicar sus propios eventos, Delivery declara su exchange topic propio `shipping_events`.

| Exchange | Tipo | Dueño | Uso por Delivery |
|----------|------|-------|------------------|
| `order_placed` | fanout (no durable) | Orders | Consume (cola propia durable) |
| `auth` | fanout (no durable) | Auth | Consume (cola anónima exclusiva) |
| `shipping_events` | **topic** (durable, no auto-delete) | **Delivery** | Publica sus 9 eventos |

### 2. Sobre de mensajes (envelope)

Todos los mensajes del ecosistema viajan con el sobre de `commongo/rbt`:

```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": { /* payload del evento */ }
}
```

- Los consumers validan el campo `message` con Zod (no la raíz).
- Todo evento publicado por Delivery **preserva el `correlation_id` entrante** (o genera uno nuevo si la acción se origina por HTTP).

### 3. Queues

**Cola 1**: `delivery_order_placed`

**Vinculada a:** exchange fanout `order_placed` (routing key vacía)
**Durable**: True
**Proposito**: Recibe la notificación de orden creada para crear envíos automaticamente (CU01).

---
**Cola 2**: anónima (nombre generado por el broker), exclusiva y auto-delete

**Vinculada a:** exchange fanout `auth` (routing key vacía)
**Proposito**: Recibe notificaciones de logout para invalidar el cache de tokens.

---

### 4. Eventos que consume (Escucha)

#### 1. Evento `order_placed`

**Origen**: Microservicio Orders.
**Exchange**: `order_placed` (fanout)
**Cola que escucha**: `delivery_order_placed`

**Estructura esperada del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "orderId": "order_456",
    "cartId": "cart_123",
    "userId": "user_789",
    "articles": [
      {
        "articleId": "art_001",
        "quantity": 2
      }
    ]
  }
}
```

**Validaciones** (sobre `message`):
- `orderId` Requerido, string no vacío.
- `userId` Requerido, string no vacío.
- `articles` Requerido, array con al menos 1 elemento.

**Acciones al recibir mensaje**:
1. Valida `message` con Zod
2. Busca la `CustomerInfo` del `userId`; si no existe, publica `SHIPPING_ERROR` y hace ack
3. Crea el envío con estado `PENDING` y snapshot de la dirección en `shippingAddress`
4. Persiste en MongoDB; si el índice único parcial `(orderId, type=NORMAL)` detecta duplicado, hace ack sin recrear (idempotencia)
5. Publica `SHIPPING_CREATED` preservando el `correlation_id`

---

#### 2. Evento `logout`

**Origen**: Microservicio Auth.
**Exchange**: `auth` (fanout)
**Cola que escucha**: anónima exclusiva

**Estructura esperada del mensaje** (`message` es un string con el token):
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Acciones al recibir mensaje**:
1. Parsea el sobre, toma `message` y remueve el prefijo `Bearer `
2. Invalida la entrada correspondiente del cache de tokens en memoria

---
### 5. Eventos que produce (Publica)

Los 9 eventos se publican en el exchange **`shipping_events`** (topic). Todos los payloads viajan dentro del sobre `{ correlation_id, message }` y usan **camelCase**.

#### 1. Evento 1: `SHIPPING_CREATED`

**Routing key**: `shipping.created`
**Descripcion**: Se emite cuando se crea un nuevo envío automáticamente al recibir `order_placed`. Lo dispara el CU01 (no hay creación manual).

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "SHIPPING_CREATED",
    "shipmentId": "ship_1234567890_abc123",
    "orderId": "order_456",
    "status": "PENDING",
    "typeShipment": "NORMAL",
    "shippingAddress": {
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
        "quantity": 2
      }
    ],
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```
**Valores posibles para `typeShipment`**: `NORMAL` | `EXCHANGE`
**Consumidores**: Stats, orders (opcional)

---

#### 2. Evento 2: `SHIPPING_STATE_CHANGED`

**Routing key**: `shipping.state.changed`
**Descripcion**: Notifica cambios de estado del envío durante su ciclo de vida normal. Lo dispara:
CU02 - Pasar a Preparado, 
CU03 - Pasar a En Camino, 


**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "SHIPPING_STATE_CHANGED",
    "eventType": "MOVED_TO_PREPARED",
    "shipmentId": "ship_123",
    "orderId": "order_456",
    "status": "PREPARED",
    "previousStatus": "PENDING",
    "timestamp": "2024-01-15T14:00:00.000Z"
  }
}
```

**Consumidores**: Stats, orders para actualizar estado de orden.
**Valores posibles para `eventType`:**
- `MOVED_TO_PREPARED`
- `MOVED_TO_IN_TRANSIT`

---

#### 3. Evento 3: `SHIPPING_DELIVERED`

**Routing key**: `shipping.delivered`
**Descripcion**: Notifica que un envío ha sido entregado exitosamente al cliente. Marca el fin del ciclo de vida normal del envío. Lo dispara el CU04 - Pasar a Entregado.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "SHIPPING_DELIVERED",
    "shipmentId": "ship_1234567890_abc123",
    "orderId": "order_123",
    "deliveredAt": "2024-01-15T14:00:00.000Z",
    "timestamp": "2024-01-15T14:00:00.000Z"
  }
}
```

---

#### 4. Evento 4: `SHIPPING_CANCELLED`

**Routing key**: `shipping.cancelled`
**Descripcion**: Notifica que un envío ha sido cancelado. Orders debe procesar el reembolso correspondiente. Lo dispara el CU05 - Cancelar Envío.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "SHIPPING_CANCELLED",
    "shipmentId": "ship_1234567890_abc123",
    "orderId": "order_123",
    "status": "CANCELLED",
    "reason": "Cliente canceló la orden",
    "cancelledAt": "2024-01-15T12:00:00.000Z",
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}
```
**Consumidores**: Orders para procesar reembolso.
**Accion esperada en Orders**: Iniciar proceso de reembolso automático al detectar este evento.

---

#### 5. Evento 5: `RETURN_INITIATED`

**Routing key**: `shipping.return.initiated`
**Descripcion**: Notifica que un cliente ha iniciado una devolución. El producto está en tránsito del cliente al almacén. Lo dispara el CU06 - Iniciar Devolución - Reembolso.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "RETURN_INITIATED",
    "shipmentId": "ship_1234567890_abc123",
    "orderId": "order_123",
    "reason": "Producto defectuoso",
    "articles": [
      {
        "articleId": "article_789",
        "quantity": 2
      }
    ],
    "initiatedAt": "2024-01-15T15:00:00.000Z",
    "timestamp": "2024-01-15T15:00:00.000Z"
  }
}
```
**Consumidores**: Orders para procesar reembolso.
**Accion esperada en Orders**: Marcar orden como "en proceso de devolución" pero NO procesar reembolso aún.

---

#### 6. Evento 6: `RETURN_COMPLETED`

**Routing key**: `shipping.return.completed`
**Descripcion**: Notifica que el producto ha sido devuelto al almacén y verificado. Orders debe procesar el reembolso. Lo dispara el CU07 - Completar Devolución.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "RETURN_COMPLETED",
    "shipmentId": "ship_123",
    "orderId": "order_456",
    "productCondition": "good",
    "completedAt": "2024-01-18T14:00:00.000Z",
    "timestamp": "2024-01-18T14:00:00.000Z"
  }
}
```
**Valores posibles para `productCondition`**: `good` | `damaged` | `defective`
**Consumidores**: Orders para procesar reembolso.
**Accion esperada en Orders**: Marcar orden como "devolución completada" y procesar reembolso. Este evento es CRÍTICO porque desencadena el reembolso definitivo en Orders.

---

#### 7. Evento 7: `EXCHANGE_INITIATED`

**Routing key**: `shipping.exchange.initiated`
**Descripcion**: Notifica que se ha iniciado un cambio de producto. Se crean dos envíos vinculados (original y nuevo). Lo dispara el CU08 - Iniciar Cambio de Producto.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "EXCHANGE_INITIATED",
    "originalShipmentId": "ship_1234567890_abc123",
    "newShipmentId": "ship_9876543210_xyz789",
    "orderId": "order_123",
    "articles": [
      {
        "articleId": "article_789",
        "quantity": 2
      }
    ],
    "initiatedAt": "2024-01-15T17:00:00.000Z",
    "timestamp": "2024-01-15T17:00:00.000Z"
  }
}
```
**Nota**: `articles` son los artículos del **nuevo** envío de cambio.
**Consumidores**: Orders para marcar orden como en cambio.

---

#### 8. Evento 8: `EXCHANGE_FINALIZED`

**Routing key**: `shipping.exchange.completed.final`
**Descripcion**: Notifica que el cambio ha sido resuelto: producto original verificado y decisión tomada según su condición (ver regla CU09). Lo dispara el CU09 - Completar Cambio de Producto.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "EXCHANGE_FINALIZED",
    "originalShipmentId": "ship_123",
    "newShipmentId": "ship_789",
    "orderId": "order_456",
    "productCondition": "good",
    "originalShipmentStatus": "EXCHANGE_PROCESSED",
    "newShipmentStatus": "PREPARED",
    "timestamp": "2024-01-18T15:00:00.000Z"
  }
}
```
**Valores posibles**:
- `productCondition`: `good` | `damaged` | `defective`
- `originalShipmentStatus`: `EXCHANGE_PROCESSED` (cambio procede) | `RETURNED` (cambio rechazado)
- `newShipmentStatus`: `PREPARED` (cambio procede) | `CANCELLED` (cambio rechazado)

**Consumidores**: Orders.
**Accion esperada en Orders**: Actualizar estado de orden.

---

#### 9. Evento 9: `SHIPPING_ERROR`

**Routing key**: `shipping.error`
**Descripcion**: Se emite **únicamente ante fallos de los consumers** (ej.: llega `order_placed` de un usuario sin `CustomerInfo` registrada). Los errores de endpoints HTTP se responden por HTTP, no por este evento.

**Estructura del mensaje**:
```json
{
  "correlation_id": "b3c1f0d2-8a4e-4f5a-9c2b-7d6e5f4a3b2c",
  "message": {
    "type": "SHIPPING_ERROR",
    "orderId": "order_456",
    "userId": "user_789",
    "errorMessage": "El usuario no tiene una dirección de envío registrada",
    "occurredAt": "2024-01-15T10:00:00.000Z",
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```
**Consumidores**: Orders.

### 6. Idempotencia

La creación automática de envíos (CU01) es idempotente: MongoDB tiene un **índice único parcial** sobre `orderId` con filtro `type: "NORMAL"`. Si el consumer recibe un `order_placed` duplicado, el insert falla con clave duplicada y el mensaje se ackea sin crear un segundo envío ni publicar eventos.
