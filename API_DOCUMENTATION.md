# Revenue Engine API Documentation

## Table of Contents

- [Revenue Engine API Documentation](#revenue-engine-api-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Base URL](#base-url)
  - [Authentication](#authentication)
  - [Data Models \& Schemas](#data-models--schemas)
    - [Subscription Plan Schema](#subscription-plan-schema)
    - [Stripe Customer Schema](#stripe-customer-schema)
    - [Checkout Session Schema](#checkout-session-schema)
    - [Subscription Schema](#subscription-schema)
    - [Webhook Event Schema](#webhook-event-schema)
    - [Checkout Headers](#checkout-headers)
  - [Payment Controller](#payment-controller)
    - [Customer Endpoints](#customer-endpoints)
      - [Create Customer](#create-customer)
      - [List Customers](#list-customers)
      - [Get Customer](#get-customer)
      - [Update Customer](#update-customer)
      - [Delete Customer](#delete-customer)
    - [Product Endpoints](#product-endpoints)
      - [Create Product](#create-product)
      - [List Products](#list-products)
      - [Get Product](#get-product)
      - [Update Product](#update-product)
      - [Delete Product](#delete-product)
      - [Attach Feature to Product](#attach-feature-to-product)
    - [Checkout Endpoints (Used in Production)](#checkout-endpoints-used-in-production)
      - [Create Checkout](#create-checkout)
      - [Verify Checkout Session](#verify-checkout-session)
    - [Health Check](#health-check)
  - [Subscription Plans Controller](#subscription-plans-controller)
    - [Create Subscription Plan](#create-subscription-plan)
    - [List Subscription Plans](#list-subscription-plans)
    - [Get Subscription Plan](#get-subscription-plan)
    - [Update Subscription Plan](#update-subscription-plan)
    - [Delete Subscription Plan](#delete-subscription-plan)
  - [Webhook Controller](#webhook-controller)
    - [Stripe Webhook](#stripe-webhook)
  - [Superadmin API - gRPC Endpoint](#superadmin-api---grpc-endpoint)
  - [Error Responses](#error-responses)
  - [Notes](#notes)
  - [Version History](#version-history)

---

## Overview

The Revenue Engine is a NestJS-based service that integrates with Stripe for payment processing, subscription management, and webhook handling. This API provides endpoints for:

- Customer management
- Checkout session creation
- Subscription plan management
- Webhook event processing
- Payment intent handling (not currently used in production)

---

## Base URL

```
http://localhost:3000
```

Default port: `3000` (configurable via `PORT` environment variable)

---

## Authentication

Currently, the API does not require authentication headers for most endpoints. However, certain endpoints require specific headers:

- **Checkout endpoints** require custom headers (see [Checkout Headers](#checkout-headers))

---

## Data Models & Schemas

### Subscription Plan Schema

```typescript
{
  subscription_plan_uid: string;        // Unique identifier (required, unique)
  org_plan_template_uid: string;        // Organization plan template UID (required)
  name: string;                          // Plan name (required)
  metadata: {                           // Plan metadata (required)
    product_uid: string;                // Product UID (required)
  };
  prices: Price[];                      // Array of prices (default: [])
  created_at: Date;                     // Creation timestamp (auto-generated)
  updated_at: Date;                     // Last update timestamp (auto-generated)
}

Price {
  id: string;                           // Stripe price ID (required)
  interval: string;                     // Billing interval: "month", "year", "week", "day" (required)
}
```

---

### Stripe Customer Schema

```typescript
{
  organization_id: string;              // Organization identifier (required, unique)
  stripe_customer_id: string;          // Stripe customer ID (required, unique)
  email?: string;                       // Customer email
  name?: string;                        // Customer name
  stripe_data?: Record<string, unknown>; // Full Stripe customer object
  created_at: Date;                     // Creation timestamp (auto-generated)
  updated_at: Date;                     // Last update timestamp (auto-generated)
}
```

---

### Checkout Session Schema

```typescript
{
  organization_id: string;              // Organization identifier (required)
  stripe_session_id: string;            // Stripe checkout session ID (required, unique)
  stripe_customer_id: string;           // Stripe customer ID (required)
  plan_id?: string;                     // Plan identifier
  billing_interval?: string;            // Billing interval
  metadata?: Record<string, string>;    // Session metadata
  status: string;                       // Status: "pending", "completed", "expired" (default: "pending")
  created_at: Date;                     // Creation timestamp (auto-generated)
  updated_at: Date;                     // Last update timestamp (auto-generated)
}
```

---

### Subscription Schema

```typescript
{
  stripe_subscription_id: string;        // Stripe subscription ID (required, unique)
  organization_id: string;              // Organization identifier (required)
  stripe_customer_id: string;           // Stripe customer ID (required)
  plan_id?: string;                     // Plan identifier
  billing_interval?: string;            // Billing interval: "month" | "year"
  status: string;                       // Status: "active", "canceled", "past_due", "unpaid", "trialing", etc. (required)
  current_period_start: Date;           // Current period start date (required)
  current_period_end: Date;             // Current period end date (required)
  cancel_at_period_end: boolean;        // Cancel at period end flag (default: false)
  canceled_at?: Date;                   // Cancellation timestamp
  metadata?: Record<string, string>;    // Subscription metadata
  stripe_data?: Record<string, unknown>; // Full Stripe subscription object
  created_at: Date;                     // Creation timestamp (auto-generated)
  updated_at: Date;                     // Last update timestamp (auto-generated)
}
```

**Indexes:**

- `stripe_subscription_id` (unique)
- `organization_id`
- `stripe_customer_id`
- `status`

---

### Webhook Event Schema

```typescript
{
  event_id: string;                     // Stripe event ID (unique)
  event_type: string;                   // Stripe event type
  processed: boolean;                   // Whether event has been processed
  event_data: Record<string, unknown>;  // Full Stripe event data
  processed_at?: Date;                  // Processing timestamp
  processing_result?: {                 // Processing result
    success: boolean;
    subscription_id?: string;
    organization_id?: string;
    error?: string;
  };
  created_at: Date;                     // Creation timestamp (auto-generated)
  updated_at: Date;                     // Last update timestamp (auto-generated)
}
```

---

### Checkout Headers

**Required Headers for `/payments/checkout`:**

| Header            | Type   | Required | Description                                         |
| ----------------- | ------ | -------- | --------------------------------------------------- |
| X-Organization-Id | string | Yes      | Organization identifier                             |
| X-Customer-Email  | string | Yes      | Customer email address (must be valid email format) |
| X-Region          | string | Yes      | Region identifier                                   |

**Validation:**

- `X-Organization-Id`: Must be a non-empty string
- `X-Customer-Email`: Must be a valid email address
- `X-Region`: Must be a non-empty string

---

## Payment Controller

**Base Path:** `/payments`

### Customer Endpoints

_Note: These endpoints are used for testing purposes._

#### Create Customer

**Endpoint:** `POST /payments/customers`

**Description:** Creates a new Stripe customer and stores it in the database.

**Request Body:**

```json
{
  "email": "customer@example.com",
  "name": "John Doe"
}
```

**Request Schema:**

| Field | Type   | Required | Description            |
| ----- | ------ | -------- | ---------------------- |
| email | string | Yes      | Customer email address |
| name  | string | No       | Customer name          |

**Response:** `201 Created`

```json
{
  "id": "cus_xxxxxxxxxxxxx",
  "object": "customer",
  "email": "customer@example.com",
  "name": "John Doe",
  "created": 1234567890,
  "metadata": {}
}
```

---

#### List Customers

**Endpoint:** `GET /payments/customers`

**Description:** Retrieves a list of Stripe customers.

**Query Parameters:**

| Parameter | Type   | Required | Default | Description                           |
| --------- | ------ | -------- | ------- | ------------------------------------- |
| limit     | number | No       | 10      | Maximum number of customers to return |

**Example Request:**

```
GET /payments/customers?limit=20
```

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "cus_xxxxxxxxxxxxx",
      "object": "customer",
      "email": "customer@example.com",
      "name": "John Doe"
    }
  ],
  "has_more": false
}
```

---

#### Get Customer

**Endpoint:** `GET /payments/customers/:id`

**Description:** Retrieves a specific customer by Stripe customer ID.

**Path Parameters:**

| Parameter | Type   | Required | Description                                    |
| --------- | ------ | -------- | ---------------------------------------------- |
| id        | string | Yes      | Stripe customer ID (e.g., `cus_xxxxxxxxxxxxx`) |

**Response:** `200 OK`

```json
{
  "id": "cus_xxxxxxxxxxxxx",
  "object": "customer",
  "email": "customer@example.com",
  "name": "John Doe",
  "created": 1234567890
}
```

---

#### Update Customer

**Endpoint:** `PUT /payments/customers/:id`

**Description:** Updates an existing customer.

**Path Parameters:**

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| id        | string | Yes      | Stripe customer ID |

**Request Body:**

```json
{
  "email": "newemail@example.com",
  "name": "Jane Doe",
  "metadata": {
    "organization_id": "org_123"
  }
}
```

**Request Schema:**

| Field    | Type   | Required | Description                  |
| -------- | ------ | -------- | ---------------------------- |
| email    | string | No       | New email address            |
| name     | string | No       | New name                     |
| metadata | object | No       | Key-value pairs for metadata |

**Response:** `200 OK`

```json
{
  "id": "cus_xxxxxxxxxxxxx",
  "email": "newemail@example.com",
  "name": "Jane Doe",
  "metadata": {
    "organization_id": "org_123"
  }
}
```

---

#### Delete Customer

**Endpoint:** `DELETE /payments/customers/:id`

**Description:** Deletes a customer from Stripe.

**Path Parameters:**

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| id        | string | Yes      | Stripe customer ID |

**Response:** `200 OK`

```json
{
  "id": "cus_xxxxxxxxxxxxx",
  "deleted": true
}
```

---

### Product Endpoints

_Note: These endpoints are used for testing purposes._

#### Create Product

**Endpoint:** `POST /payments/products`

**Description:** Creates a new Stripe product.

**Request Body:**

```json
{
  "name": "Premium Plan",
  "description": "Premium subscription plan",
  "images": ["https://example.com/image.png"]
}
```

**Request Schema:**

| Field       | Type     | Required | Description         |
| ----------- | -------- | -------- | ------------------- |
| name        | string   | Yes      | Product name        |
| description | string   | No       | Product description |
| images      | string[] | No       | Array of image URLs |

**Response:** `201 Created`

```json
{
  "id": "prod_xxxxxxxxxxxxx",
  "object": "product",
  "name": "Premium Plan",
  "description": "Premium subscription plan",
  "images": ["https://example.com/image.png"],
  "created": 1234567890
}
```

---

#### List Products

**Endpoint:** `GET /payments/products`

**Description:** Retrieves a list of products.

**Query Parameters:**

| Parameter | Type    | Required | Default | Description                |
| --------- | ------- | -------- | ------- | -------------------------- |
| limit     | number  | No       | 10      | Maximum number of products |
| active    | boolean | No       | true    | Filter by active status    |

**Example Request:**

```
GET /payments/products?limit=20&active=true
```

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "prod_xxxxxxxxxxxxx",
      "name": "Premium Plan",
      "active": true
    }
  ],
  "has_more": false
}
```

---

#### Get Product

**Endpoint:** `GET /payments/products/:id`

**Description:** Retrieves a specific product.

**Path Parameters:**

| Parameter | Type   | Required | Description                             |
| --------- | ------ | -------- | --------------------------------------- |
| id        | string | Yes      | Product ID (e.g., `prod_xxxxxxxxxxxxx`) |

**Response:** `200 OK`

```json
{
  "id": "prod_xxxxxxxxxxxxx",
  "name": "Premium Plan",
  "description": "Premium subscription plan",
  "active": true
}
```

---

#### Update Product

**Endpoint:** `PUT /payments/products/:id`

**Description:** Updates a product.

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| id        | string | Yes      | Product ID  |

**Request Body:**

```json
{
  "name": "Updated Premium Plan",
  "description": "Updated description",
  "images": ["https://example.com/new-image.png"]
}
```

**Response:** `200 OK`

```json
{
  "id": "prod_xxxxxxxxxxxxx",
  "name": "Updated Premium Plan",
  "description": "Updated description"
}
```

---

#### Delete Product

**Endpoint:** `DELETE /payments/products/:id`

**Description:** Deletes a product.

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| id        | string | Yes      | Product ID  |

**Response:** `200 OK`

```json
{
  "id": "prod_xxxxxxxxxxxxx",
  "deleted": true
}
```

---

#### Attach Feature to Product

**Endpoint:** `POST /payments/products/:id/features`

**Description:** Attaches a feature to a product. Used because Stripe UI doesn't support this operation.

**Path Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| id        | string | Yes      | Product ID  |

**Request Body:**

```json
{
  "entitlement_feature": "feature_uid_123"
}
```

**Request Schema:**

| Field               | Type   | Required | Description           |
| ------------------- | ------ | -------- | --------------------- |
| entitlement_feature | string | Yes      | Feature UID to attach |

**Response:** `201 Created`

```json
{
  "id": "prod_xxxxxxxxxxxxx",
  "features": [
    {
      "entitlement_feature": "feature_uid_123"
    }
  ]
}
```

---

### Checkout Endpoints (Used in Production)

#### Create Checkout

**Endpoint:** `POST /payments/checkout`

**Description:** Creates a checkout session for subscription purchase. This is the **recommended endpoint** for creating checkout sessions.

**Headers:**

| Header            | Type   | Required | Description                                  |
| ----------------- | ------ | -------- | -------------------------------------------- |
| X-Organization-Id | string | Yes      | Organization identifier                      |
| X-Customer-Email  | string | Yes      | Customer email address (must be valid email) |
| X-Region          | string | Yes      | Region identifier                            |

**Request Body:**

```json
{
  "subscription_plan_uid": "plan_uid_123",
  "billing_interval": "month",
  "overages_enabled": true,
  "overage_bandwidth": false,
  "overage_api": true
}
```

**Request Schema:**

| Field                 | Type    | Required | Description                         |
| --------------------- | ------- | -------- | ----------------------------------- |
| subscription_plan_uid | string  | Yes      | Subscription plan UID               |
| billing_interval      | string  | Yes      | Billing interval: "month" or "year" |
| overages_enabled      | boolean | No       | Enable overages                     |
| overage_bandwidth     | boolean | No       | Enable bandwidth overage            |
| overage_api           | boolean | No       | Enable API overage                  |

**Example Request:**

```bash
curl -X POST http://localhost:3000/payments/checkout \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: org_123" \
  -H "X-Customer-Email: customer@example.com" \
  -H "X-Region: us-east-1" \
  -d '{
    "subscription_plan_uid": "plan_uid_123",
    "billing_interval": "month",
    "overages_enabled": true
  }'
```

**Response:** `200 OK`

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_xxxxxxxxxxxxx"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid subscription plan UID or billing interval
- `400 Bad Request` - Missing required headers
- `400 Bad Request` - Invalid price ID or billing interval mismatch

---

#### Verify Checkout Session

**Endpoint:** `POST /payments/checkout/success`

**Description:** Verifies a checkout session after successful payment. Used on product.

**Request Body:**

```json
{
  "session_id": "cs_test_xxxxxxxxxxxxx"
}
```

**Request Schema:**

| Field      | Type   | Required | Description                |
| ---------- | ------ | -------- | -------------------------- |
| session_id | string | Yes      | Stripe checkout session ID |

**Response:** `200 OK`

```json
{
  "session_id": "cs_test_xxxxxxxxxxxxx",
  "status": "complete",
  "payment_status": "paid",
  "subscription_id": "sub_xxxxxxxxxxxxx",
  "customer_id": "cus_xxxxxxxxxxxxx"
}
```

---

### Health Check

**Endpoint:** `GET /payments/health`

**Description:** Health check endpoint for the payment service.

**Response:** `200 OK`

```json
{
  "status": "ok",
  "message": "Stripe service is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Subscription Plans Controller

**Base Path:** `/subscription-plans`

### Create Subscription Plan

**Endpoint:** `POST /subscription-plans`

**Description:** Creates a new subscription plan.

**Request Body:**

```json
{
  "org_plan_template_uid": "template_uid_123",
  "name": "Premium Plan",
  "metadata": {
    "product_uid": "product_uid_123"
  },
  "prices": [
    {
      "id": "price_xxxxxxxxxxxxx",
      "interval": "month"
    },
    {
      "id": "price_yyyyyyyyyyyyy",
      "interval": "year"
    }
  ]
}
```

**Request Schema:**

| Field                 | Type   | Required | Description                                      |
| --------------------- | ------ | -------- | ------------------------------------------------ |
| org_plan_template_uid | string | Yes      | Organization plan template UID                   |
| name                  | string | Yes      | Plan name (cannot be empty)                      |
| metadata              | object | Yes      | Plan metadata                                    |
| metadata.product_uid  | string | Yes      | Product UID                                      |
| prices                | array  | Yes      | Array of prices (at least one required)          |
| prices[].id           | string | Yes      | Stripe price ID                                  |
| prices[].interval     | string | Yes      | Billing interval: "month", "year", "week", "day" |

**Response:** `201 Created`

```json
{
  "subscription_plan_uid": "plan_uid_123",
  "org_plan_template_uid": "template_uid_123",
  "name": "Premium Plan",
  "metadata": {
    "product_uid": "product_uid_123"
  },
  "prices": [
    {
      "id": "price_xxxxxxxxxxxxx",
      "interval": "month"
    },
    {
      "id": "price_yyyyyyyyyyyyy",
      "interval": "year"
    }
  ],
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Name is required and cannot be empty
- `400 Bad Request` - Metadata with product_uid is required
- `400 Bad Request` - At least one price is required
- `400 Bad Request` - Each price must have both id and interval
- `409 Conflict` - Subscription plan with this UID already exists

---

### List Subscription Plans

**Endpoint:** `GET /subscription-plans`

**Description:** Retrieves a list of subscription plans with pagination support.

**Query Parameters:**

| Parameter | Type   | Required | Default | Description                                              |
| --------- | ------ | -------- | ------- | -------------------------------------------------------- |
| limit     | number | No       | None    | Maximum number of plans to return (must be non-negative) |
| skip      | number | No       | None    | Number of plans to skip (must be non-negative)           |

**Example Request:**

```
GET /subscription-plans?limit=10&skip=0
```

**Response:** `200 OK`

```json
[
  {
    "subscription_plan_uid": "plan_uid_123",
    "org_plan_template_uid": "template_uid_123",
    "name": "Premium Plan",
    "metadata": {
      "product_uid": "product_uid_123"
    },
    "prices": [
      {
        "id": "price_xxxxxxxxxxxxx",
        "interval": "month"
      }
    ],
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**

- `400 Bad Request` - Limit must be a non-negative integer
- `400 Bad Request` - Skip must be a non-negative integer

---

### Get Subscription Plan

**Endpoint:** `GET /subscription-plans/:subscription_plan_uid`

**Description:** Retrieves a specific subscription plan by UID.

**Path Parameters:**

| Parameter             | Type   | Required | Description           |
| --------------------- | ------ | -------- | --------------------- |
| subscription_plan_uid | string | Yes      | Subscription plan UID |

**Response:** `200 OK`

```json
{
  "subscription_plan_uid": "plan_uid_123",
  "org_plan_template_uid": "template_uid_123",
  "name": "Premium Plan",
  "metadata": {
    "product_uid": "product_uid_123"
  },
  "prices": [
    {
      "id": "price_xxxxxxxxxxxxx",
      "interval": "month"
    }
  ],
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Subscription plan UID is required
- `404 Not Found` - Subscription plan not found

---

### Update Subscription Plan

**Endpoint:** `PATCH /subscription-plans/:subscription_plan_uid`

**Description:** Updates a subscription plan. Only provided fields are updated (PATCH-style).

**Path Parameters:**

| Parameter             | Type   | Required | Description           |
| --------------------- | ------ | -------- | --------------------- |
| subscription_plan_uid | string | Yes      | Subscription plan UID |

**Request Body:**

```json
{
  "name": "Updated Premium Plan",
  "metadata": {
    "product_uid": "product_uid_456"
  },
  "prices": [
    {
      "id": "price_new_xxxxxxxxxxxxx",
      "interval": "month"
    }
  ],
  "org_plan_template_uid": "template_uid_456"
}
```

**Request Schema:**

| Field                 | Type   | Required      | Description                                             |
| --------------------- | ------ | ------------- | ------------------------------------------------------- |
| name                  | string | No            | Plan name (cannot be empty if provided)                 |
| metadata              | object | No            | Plan metadata                                           |
| metadata.product_uid  | string | Conditional\* | Product UID (required if metadata is provided)          |
| prices                | array  | No            | Array of prices                                         |
| prices[].id           | string | Conditional\* | Stripe price ID (required if prices array is provided)  |
| prices[].interval     | string | Conditional\* | Billing interval (required if prices array is provided) |
| org_plan_template_uid | string | No            | Organization plan template UID                          |

\*At least one field must be provided for update.

**Response:** `200 OK`

```json
{
  "subscription_plan_uid": "plan_uid_123",
  "org_plan_template_uid": "template_uid_456",
  "name": "Updated Premium Plan",
  "metadata": {
    "product_uid": "product_uid_456"
  },
  "prices": [
    {
      "id": "price_new_xxxxxxxxxxxxx",
      "interval": "month"
    }
  ],
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Subscription plan UID is required
- `400 Bad Request` - At least one field must be provided for update
- `400 Bad Request` - Name cannot be empty
- `400 Bad Request` - Metadata product_uid is required (if metadata provided)
- `400 Bad Request` - Each price must have both id and interval (if prices provided)
- `404 Not Found` - Subscription plan not found

---

### Delete Subscription Plan

**Endpoint:** `DELETE /subscription-plans/:subscription_plan_uid`

**Description:** Deletes a subscription plan.

**Path Parameters:**

| Parameter             | Type   | Required | Description           |
| --------------------- | ------ | -------- | --------------------- |
| subscription_plan_uid | string | Yes      | Subscription plan UID |

**Response:** `200 OK`

```json
{
  "message": "Subscription plan deleted successfully"
}
```

**Error Responses:**

- `400 Bad Request` - Subscription plan UID is required
- `404 Not Found` - Subscription plan not found

---

## Webhook Controller

**Base Path:** `/webhooks`

### Stripe Webhook

**Endpoint:** `POST /webhooks/stripe`

**Description:** Receives webhook events from Stripe and processes them. This endpoint handles:

1. Webhook signature verification
2. Idempotency checking (prevents duplicate processing)
3. Customer lookup
4. Subscription verification with Stripe SDK
5. Subscription status updates in database

This provides a backchannel approach to verify checkout subscription status, independent of the `/checkout/success` endpoint.

**Headers:**

| Header           | Type   | Required | Description                               |
| ---------------- | ------ | -------- | ----------------------------------------- |
| stripe-signature | string | Yes      | Stripe webhook signature for verification |
| Content-Type     | string | Yes      | Must be `application/json`                |

**Request Body:**

Raw Stripe webhook event (JSON). The request body must be raw (not parsed) for signature verification.

**Example Stripe Event:**

```json
{
  "id": "evt_xxxxxxxxxxxxx",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_xxxxxxxxxxxxx",
      "object": "checkout.session",
      "customer": "cus_xxxxxxxxxxxxx",
      "subscription": "sub_xxxxxxxxxxxxx",
      "status": "complete",
      "payment_status": "paid"
    }
  }
}
```

**Supported Event Types:**

- `checkout.session.completed` - Checkout session completed
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription deleted
- `invoice.payment_succeeded` - Invoice payment succeeded
- `invoice.payment_failed` - Invoice payment failed

**Response:** `200 OK`

```json
{
  "received": true,
  "eventId": "evt_xxxxxxxxxxxxx",
  "processed": true,
  "message": "Event processed successfully"
}
```

**Error Responses:**

- `400 Bad Request` - Missing or invalid Stripe signature
- `400 Bad Request` - STRIPE_WEBHOOK_SECRET not configured
- `400 Bad Request` - Raw body required for signature verification

**Note:** The endpoint always returns `200 OK` to Stripe, even if processing fails internally. This prevents Stripe from retrying immediately. Failed events can be manually retried later.

---

## Superadmin API - gRPC Endpoint

**Service:** `PlanService`  
**Method:** `handleOrganizationPlanLifecycle`

**Description:** This gRPC method is consumed by the Revenue Engine's webhook handler service (`webhook-handler.service.ts`). It handles organization plan lifecycle when a subscription is created or updated.

**When Called:**

This method is called automatically by the webhook handler when:

- A subscription is created (`customer.subscription.created`)
- A subscription is updated (`customer.subscription.updated`)

The webhook handler extracts the `subscription_plan_uid` from subscription metadata, looks up the corresponding `org_plan_template_uid` from the subscription plans collection, and then calls this gRPC method.

**gRPC Request:**

```protobuf
message HandleOrganizationPlanLifecycleRequest {
  string org_uid = 1;
  string org_plan_template_uid = 2;
}
```

**Request Schema:**

| Field                 | Type   | Required | Description                    |
| --------------------- | ------ | -------- | ------------------------------ |
| org_uid               | string | Yes      | Organization UID               |
| org_plan_template_uid | string | Yes      | Organization plan template UID |

**Example Request:**

```json
{
  "org_uid": "org_123",
  "org_plan_template_uid": "template_uid_123"
}
```

**gRPC Response:**

```protobuf
message HandleOrganizationPlanLifecycleResponse {
  bool success = 1;
  string message = 2;
  string plan_id = 3;
  string org_uid = 4;
  repeated string errors = 5;
}
```

**Response Schema:**

| Field   | Type     | Description                      |
| ------- | -------- | -------------------------------- |
| success | boolean  | Whether the operation succeeded  |
| message | string   | Response message                 |
| plan_id | string   | Created/updated plan ID          |
| org_uid | string   | Organization UID                 |
| errors  | string[] | Array of error messages (if any) |

**Example Response:**

```json
{
  "success": true,
  "message": "Organization plan lifecycle handled successfully",
  "plan_id": "plan_123",
  "org_uid": "org_123"
}
```

**What It Does:**

1. Fetches template from TemplatesModel using `org_plan_template_uid`
2. Fetches default features using `getDefaultFeaturesV2` logic
3. Merges features from both collections
4. Creates a new plan
5. Updates organization with the new `plan_id`

**Error Responses:**

- `INVALID_ARGUMENT` (gRPC code 3) - Missing required fields (`org_uid` or `org_plan_template_uid`)
- `INTERNAL` (gRPC code 13) - Internal server error

**Note:** This is an internal service-to-service gRPC call. No authentication is required as gRPC is for internal communication where auth is handled at infrastructure level (service mesh, mTLS, etc.).

---

## Error Responses

All endpoints follow standard HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request (validation errors, missing fields, etc.)
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate UID)
- `500 Internal Server Error` - Server error

**Error Response Format:**

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

---

## Notes

1. **Endpoints Status:**
   - ✅ **Used in Production:** Customer endpoints (testing), Product endpoints (testing), Product features endpoint, Checkout endpoint (`POST /payments/checkout`), Checkout success endpoint, Webhook endpoint, Subscription Plans endpoints
   - 📝 **Note:** Only actively used endpoints are documented. Unused endpoints (Payment Intent, Price, Subscription direct creation, and old Checkout Session endpoints) have been excluded from this documentation.

2. **Webhook Processing:**
   - Webhooks are processed asynchronously
   - Idempotency is enforced using event IDs
   - Failed webhook processing doesn't fail the HTTP request (returns 200 to Stripe)

3. **Checkout Flow:**
   - Use `POST /payments/checkout` for creating checkout sessions
   - After payment, Stripe redirects to success URL
   - Webhook events are processed independently for reliability

4. **Subscription Plan Lifecycle:**
   - Subscription plans are created via `POST /subscription-plans`
   - When a subscription is created/updated via webhook, the system automatically calls the gRPC `handleOrganizationPlanLifecycle` method
   - This creates/updates the organization's plan based on the subscription plan template

---

## Version History

- **v1.0** - Initial API documentation
  - Payment Controller endpoints
  - Webhook Controller endpoints
  - Subscription Plans Controller endpoints
  - Superadmin API gRPC endpoint documentation
