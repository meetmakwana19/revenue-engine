# Revenue Engine - Stripe Payment Integration

A NestJS-based revenue engine that integrates with Stripe for payment processing, subscription management, and webhook handling.

## Table of Contents

- [Project Overview](#project-overview)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Database Schemas](#database-schemas)
- [Checkout Flow](#checkout-flow)
- [Webhook Integration](#webhook-integration)
- [Testing](#testing)
- [Configuration](#configuration)

---

## Project Overview

This revenue engine provides a complete payment processing system built on NestJS and Stripe. It handles:

- **Customer Management**: Create and manage Stripe customers linked to organizations
- **Checkout Sessions**: Create Stripe checkout sessions for subscription payments
- **Subscription Management**: Track and manage subscription lifecycle
- **Webhook Processing**: Handle Stripe webhook events for real-time payment updates
- **Payment Intents**: Support for one-time payments (optional)

### Key Features

- ✅ Stripe Checkout Session integration
- ✅ Webhook backchannel for reliable payment verification
- ✅ MongoDB persistence for all payment data
- ✅ Idempotent webhook processing
- ✅ Subscription lifecycle management
- ✅ Support for multiple billing intervals (monthly/yearly)

---

## Project Structure

```
revenue-engine/
├── src/
│   ├── payment/
│   │   ├── providers/stripe/
│   │   │   ├── services/
│   │   │   │   └── stripe.service.ts      # Core Stripe service
│   │   │   ├── schemas/
│   │   │   │   ├── stripe-customer.schema.ts
│   │   │   │   ├── checkout-session.schema.ts
│   │   │   │   └── subscription.schema.ts
│   │   │   └── dto/                       # Data transfer objects
│   │   └── payment.controller.ts         # Payment API endpoints
│   ├── webhook/
│   │   ├── schemas/
│   │   │   └── webhook-event.schema.ts
│   │   └── webhook.controller.ts         # Webhook endpoint
│   └── subscription-plans/               # Subscription plan management
└── README.md
```

---

## API Endpoints

### Customer Management

#### `POST /payments/customers`

Create a new Stripe customer.

**Request Body:**

```json
{
  "email": "customer@example.com",
  "name": "John Doe"
}
```

#### `GET /payments/customers`

List all customers (with optional limit).

**Query Parameters:**

- `limit` (optional): Number of customers to return (default: 10)

#### `GET /payments/customers/:id`

Retrieve a specific customer by Stripe customer ID.

#### `PUT /payments/customers/:id`

Update customer information.

#### `DELETE /payments/customers/:id`

Delete a customer from Stripe.

---

### Checkout Sessions (Primary Payment Flow)

#### `POST /payments/checkout`

Create a checkout session for subscription payment. **This is the main endpoint for initiating payments.**

**Headers:**

- `x-organization-id`: Organization identifier
- `x-customer-email`: Customer email address

**Request Body:**

```json
{
  "subscription_plan_uid": "plan_starter",
  "billing_interval": "month",
  "overages_enabled": false,
  "overage_bandwidth": false,
  "overage_api": false
}
```

**Response:**

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Flow:**

1. Backend looks up subscription plan by `subscription_plan_uid`
2. Finds matching price for `billing_interval`
3. Validates price ID with Stripe
4. Creates or retrieves Stripe customer
5. Creates Stripe checkout session
6. Saves checkout session to MongoDB
7. Returns checkout URL

#### `POST /payments/checkout/success`

Verify checkout session after payment completion.

**Request Body:**

```json
{
  "session_id": "cs_test_abc123"
}
```

**Response:**

```json
{
  "session": { ... },
  "subscription": { ... },
  "checkoutSession": { ... }
}
```

#### `POST /payments/checkout-sessions`

Alternative endpoint for creating checkout sessions (lower-level API).

#### `GET /payments/checkout-sessions/:id`

Retrieve checkout session details.

---

### Payment Intents (Optional - for one-time payments)

#### `POST /payments/payment-intents`

Create a payment intent for one-time payments.

**Request Body:**

```json
{
  "amount": 2900,
  "currency": "usd",
  "priceId": "price_1234567890",
  "customerEmail": "customer@example.com",
  "metadata": { "orderId": "order_123" }
}
```

#### `GET /payments/payment-intents/:id`

Retrieve payment intent status.

#### `POST /payments/payment-intents/:id/confirm`

Confirm a payment intent.

#### `POST /payments/payment-intents/:id/cancel`

Cancel a payment intent.

---

### Products & Prices

#### `POST /payments/products`

Create a Stripe product.

#### `GET /payments/products`

List products.

#### `GET /payments/products/:id`

Get product details.

#### `POST /payments/prices`

Create a Stripe price.

#### `GET /payments/prices`

List prices.

#### `GET /payments/prices/:id`

Get price details.

---

### Subscriptions

#### `POST /payments/subscriptions`

Create a subscription directly (alternative to checkout flow).

#### `GET /payments/subscriptions`

List subscriptions.

#### `GET /payments/subscriptions/:id`

Get subscription details.

#### `POST /payments/subscriptions/:id/cancel`

Cancel a subscription.

---

### Webhooks

#### `POST /payments/webhook`

Receive Stripe webhook events. This endpoint:

- Verifies webhook signature
- Processes events idempotently
- Updates subscription status in database
- Handles multiple event types

**Note:** Requires `rawBody: true` in NestJS configuration for signature verification.

---

## Database Schemas

### StripeCustomer Collection (`stripe_customers`)

Maps organizations to Stripe customers.

```typescript
{
  organization_id: string (unique),      // Your organization identifier
  stripe_customer_id: string (unique),   // Stripe customer ID (cus_xxx)
  email?: string,
  name?: string,
  stripe_data?: Record<string, unknown>, // Full Stripe customer object
  created_at: Date,
  updated_at: Date
}
```

**Usage:**

- Created/retrieved via `StripeService.getOrCreateCustomer()`
- Used in checkout flow to link organizations to Stripe customers
- Used in webhook handler to look up customers by `stripe_customer_id`

---

### CheckoutSession Collection (`checkout_sessions`)

Tracks Stripe checkout sessions throughout the payment process.

```typescript
{
  organization_id: string,
  stripe_session_id: string (unique),    // Stripe session ID (cs_test_xxx)
  stripe_customer_id: string,
  plan_id?: string,
  billing_interval?: string,             // 'month' | 'year'
  metadata?: Record<string, string>,
  status: string,                         // 'pending' | 'completed' | 'expired'
  created_at: Date,
  updated_at: Date
}
```

**Usage:**

- Created when initiating checkout flow
- Updated when webhook processes `checkout.session.completed`
- Used in `/checkout/success` endpoint to verify session

---

### Subscription Collection (`subscriptions`)

Stores subscription state and lifecycle information.

```typescript
{
  stripe_subscription_id: string (unique), // Stripe subscription ID (sub_xxx)
  organization_id: string,
  stripe_customer_id: string,
  plan_id?: string,
  billing_interval?: string,               // 'month' | 'year'
  status: string,                          // 'active' | 'canceled' | 'past_due' | etc.
  current_period_start: Date,
  current_period_end: Date,
  cancel_at_period_end: boolean,
  canceled_at?: Date,
  metadata?: Record<string, string>,
  stripe_data?: Record<string, unknown>,  // Full Stripe subscription object
  created_at: Date,
  updated_at: Date
}
```

**Usage:**

- Created/updated by webhook handler when processing subscription events
- Used to track subscription lifecycle (created, updated, deleted)
- Stores full Stripe subscription object for reference

**Indexes:**

- `stripe_subscription_id` (unique)
- `organization_id`
- `stripe_customer_id`
- `status`

---

### WebhookEvent Collection (`webhook_events`)

Tracks processed webhook events for idempotency and audit trail.

```typescript
{
  event_id: string (unique),             // Stripe event ID (evt_xxx)
  event_type: string,                    // e.g., 'checkout.session.completed'
  processed: boolean,                     // Whether this event has been processed
  event_data?: Record<string, unknown>,  // Store event payload for debugging
  processing_result?: {
    success: boolean,
    error?: string,
    subscription_id?: string,
    organization_id?: string
  },
  created_at: Date,
  updated_at: Date,
  processed_at?: Date
}
```

**Usage:**

- Prevents duplicate processing of webhook events
- Tracks processing status and results
- Stores event payload for debugging

**Indexes:**

- `event_id` (unique)
- `processed`, `created_at` (for querying unprocessed events)

---

### Schema Relationships

```
StripeCustomer (1) ──< (many) CheckoutSession
StripeCustomer (1) ──< (many) Subscription
WebhookEvent (1) ──> (1) Subscription (via processing_result)
```

**Key Relationships:**

- `CheckoutSession.stripe_customer_id` → `StripeCustomer.stripe_customer_id`
- `Subscription.stripe_customer_id` → `StripeCustomer.stripe_customer_id`
- `Subscription.organization_id` → `StripeCustomer.organization_id`

---

## Checkout Flow

The complete checkout flow from initiation to payment completion.

### Step-by-Step Flow

```
1. Frontend → POST /payments/checkout
   ├─ Sends: { organization_id, plan_id, billing_interval, ... }
   ├─ Backend creates/retrieves Stripe customer
   ├─ Backend creates Stripe checkout session
   ├─ Backend saves checkout session to MongoDB
   └─ Returns: { checkout_url: "https://checkout.stripe.com/..." }

2. Frontend → Redirects User to Stripe
   └─ User completes payment on Stripe's hosted page

3. Stripe → Redirects Back to Frontend
   └─ Redirects to: {successUrl}?session_id={CHECKOUT_SESSION_ID}
   └─ Stripe automatically replaces {CHECKOUT_SESSION_ID} with actual session ID

4. Frontend → POST /payments/checkout/success
   ├─ Sends: { session_id: "cs_test_abc123" }
   ├─ Backend retrieves session from Stripe
   ├─ Backend verifies payment was successful
   ├─ Backend retrieves subscription information
   └─ Returns subscription details

5. Webhook (Async) → POST /payments/webhook
   ├─ Stripe sends webhook event: checkout.session.completed
   ├─ Backend processes webhook
   ├─ Backend updates checkout session status in MongoDB
   └─ Backend creates/updates subscription record
```

### Why Session ID is Needed

The `session_id` is crucial because:

1. **Verification**: Allows backend to verify payment was actually completed
2. **Idempotency**: Prevents duplicate processing if user refreshes success page
3. **Data Retrieval**: Used to fetch subscription details from Stripe
4. **Audit Trail**: Links checkout session in MongoDB to Stripe transaction

### Success URL Configuration

In `POST /payments/checkout`, the success URL is configured as:

```typescript
successUrl: `${baseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`;
```

**Important**: Stripe automatically replaces `{CHECKOUT_SESSION_ID}` with the actual session ID when redirecting.

### Frontend Implementation Example

```javascript
// After redirect from Stripe
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');

if (sessionId) {
  // Call backend to verify and get subscription details
  const response = await fetch(`/payments/checkout/success`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });

  const data = await response.json();

  if (data.subscription) {
    // Payment successful! Show subscription details
    console.log('Subscription:', data.subscription);
  } else {
    // Payment not completed or session expired
    console.error('Payment verification failed');
  }
}
```

---

## Webhook Integration

Webhooks provide a **backchannel approach** to verify checkout subscription status, independent of the `/checkout/success` endpoint.

### Architecture

```
Stripe → Webhook Endpoint → WebhookHandlerService → Database
```

### Components

1. **Webhook Endpoint** (`POST /payments/webhook`)
   - Receives webhook events from Stripe
   - Verifies webhook signature
   - Delegates processing to WebhookHandlerService

2. **WebhookHandlerService**
   - Handles idempotency checking based on processed `event_id`
   - Looks up customer in database
   - Verifies subscription with Stripe SDK
   - Updates subscription status in database

3. **Database Schemas**
   - `WebhookEvent` - Tracks processed events for idempotency
   - `Subscription` - Stores subscription status and details

---

## Webhook Event Hierarchy & Sequence

Based on actual webhook data captured during checkout, events occur in the following sequence:

### Event Flow Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Customer Setup                                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. customer.created          → Customer record created          │
│ 2. customer.updated          → Customer currency set           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Payment Processing                                    │
├─────────────────────────────────────────────────────────────────┤
│ 3. payment_intent.created      → Payment intent initialized    │
│ 4. payment_intent.requires_action → User action required        │
│ 5. payment_method.attached     → Payment method linked         │
│ 6. payment_intent.succeeded    → Payment successful            │
│ 7. mandate.updated             → Payment mandate activated      │
│ 8. charge.succeeded            → Charge completed               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Checkout & Subscription                                │
├─────────────────────────────────────────────────────────────────┤
│ 9. checkout.session.completed  → Checkout completed ✅          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Invoice Lifecycle                                      │
├─────────────────────────────────────────────────────────────────┤
│ 10. invoice.finalized         → Invoice finalized              │
│ 11. invoice.created           → Invoice created                 │
│ 12. invoice.paid              → Invoice marked as paid         │
│ 13. invoice.payment_succeeded → Payment succeeded ✅           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5: Subscription Activation                                │
├─────────────────────────────────────────────────────────────────┤
│ 14. customer.subscription.created → Subscription active ✅      │
│ 15. invoice_payment.paid       → Payment record created         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Webhook Event Details

### Phase 1: Customer Setup

#### 1. `customer.created` ⚠️ **Not Currently Handled**

**Role**: Triggered when a new Stripe customer is created during checkout.

**Key Payload Fields**:

```typescript
{
  id: "cus_xxx",                    // Stripe customer ID
  email: "customer@example.com",   // Customer email
  metadata: {
    organization_id: "org_xxx",    // Your organization ID
    region: "aws-na"                // Region info
  },
  created: 1771845502              // Unix timestamp
}
```

**Current Status**: Acknowledged but not processed. Customer is already created via `StripeService.getOrCreateCustomer()` before checkout.

**Recommendation**: Optional - Can be used for customer sync/audit, but not critical since customer creation is handled synchronously.

---

#### 2. `customer.updated` ⚠️ **Not Currently Handled**

**Role**: Triggered when customer properties change (e.g., currency, email, metadata updates).

**Key Payload Fields**:

```typescript
{
  id: "cus_xxx",
  email: "customer@example.com",
  currency: "usd",                  // Updated currency
  metadata: {
    organization_id: "org_xxx",
    region: "aws-na"
  },
  previous_attributes: {            // What changed
    currency: null
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Useful for syncing customer data changes, but not critical for subscription flow.

---

### Phase 2: Payment Processing

#### 3. `payment_intent.created` ⚠️ **Not Currently Handled**

**Role**: Triggered when a payment intent is created for the checkout session.

**Key Payload Fields**:

```typescript
{
  id: "pi_xxx",                     // Payment intent ID
  amount: 14900,                    // Amount in cents
  currency: "usd",
  customer: "cus_xxx",             // Customer ID
  status: "requires_payment_method",
  description: "Subscription creation",
  setup_future_usage: "off_session" // For recurring payments
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Payment intents are managed by Stripe during checkout. Not needed for subscription tracking.

---

#### 4. `payment_intent.requires_action` ⚠️ **Not Currently Handled**

**Role**: Triggered when additional user action is required (e.g., 3D Secure, Cash App QR code).

**Key Payload Fields**:

```typescript
{
  id: "pi_xxx",
  status: "requires_action",
  next_action: {
    type: "cashapp_handle_redirect_or_display_qr_code",
    cashapp_handle_redirect_or_display_qr_code: {
      qr_code: { ... },            // QR code for Cash App
      hosted_instructions_url: "..."
    }
  },
  payment_method: "pm_xxx"
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Frontend handles payment actions. Backend doesn't need to process this.

---

#### 5. `payment_method.attached` ⚠️ **Not Currently Handled**

**Role**: Triggered when a payment method is attached to a customer.

**Key Payload Fields**:

```typescript
{
  id: "pm_xxx",                     // Payment method ID
  type: "cashapp" | "card" | ...,  // Payment method type
  customer: "cus_xxx",
  billing_details: {
    email: "customer@example.com"
  },
  cashapp: {                        // Type-specific data
    buyer_id: "test_buyer_id",
    cashtag: "$test_cashtag"
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Payment methods are managed by Stripe. Not needed for subscription tracking.

---

#### 6. `payment_intent.succeeded` ⚠️ **Not Currently Handled**

**Role**: Triggered when payment intent is successfully completed.

**Key Payload Fields**:

```typescript
{
  id: "pi_xxx",
  status: "succeeded",
  amount_received: 14900,          // Amount actually received
  payment_method: "pm_xxx",
  latest_charge: "py_xxx",         // Charge ID
  customer: "cus_xxx"
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Payment success is already captured via `checkout.session.completed` and `charge.succeeded`. Redundant for subscription flow.

---

#### 7. `mandate.updated` ⚠️ **Not Currently Handled**

**Role**: Triggered when a payment mandate (authorization for recurring payments) status changes.

**Key Payload Fields**:

```typescript
{
  id: "mandate_xxx",
  status: "active",                 // Changed from "pending"
  payment_method: "pm_xxx",
  customer_acceptance: {
    type: "online",
    online: {
      ip_address: "150.242.207.159",
      user_agent: "Mozilla/5.0..."
    },
    accepted_at: 1771845524
  },
  previous_attributes: {
    status: "pending"
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Mandates are managed by Stripe for recurring payments. Not critical for subscription tracking.

---

#### 8. `charge.succeeded` ⚠️ **Not Currently Handled**

**Role**: Triggered when a charge is successfully completed.

**Key Payload Fields**:

```typescript
{
  id: "py_xxx",                     // Charge ID
  amount: 14900,
  amount_captured: 14900,
  currency: "usd",
  customer: "cus_xxx",
  payment_intent: "pi_xxx",
  payment_method: "pm_xxx",
  receipt_url: "https://pay.stripe.com/receipts/...",
  status: "succeeded",
  outcome: {
    type: "authorized",
    network_status: "approved_by_network",
    seller_message: "Payment complete."
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Charge success is already captured via `checkout.session.completed`. Useful for payment audit/receipt tracking, but not critical for subscription flow.

---

### Phase 3: Checkout & Subscription

#### 9. `checkout.session.completed` ✅ **Currently Handled**

**Role**: **Primary event** for successful checkout completion. This is the main event that triggers subscription creation.

**Key Payload Fields**:

```typescript
{
  id: "cs_test_xxx",               // Checkout session ID
  customer: "cus_xxx",
  subscription: "sub_xxx",         // Subscription ID
  invoice: "in_xxx",                // Invoice ID
  payment_status: "paid",
  status: "complete",
  mode: "subscription",
  metadata: {
    plan_id: "bltcb07a3310c774979",
    organization_id: "bltsample123",
    billing_interval: "month",
    overages_enabled: "false"
  },
  amount_total: 14900,
  currency: "usd"
}
```

**Current Processing**:

- ✅ Looks up customer in database
- ✅ Verifies subscription with Stripe SDK
- ✅ Creates/updates subscription record
- ✅ Updates checkout session status to `completed`

**Status**: **Critical** - This is the main event for subscription activation.

---

### Phase 4: Invoice Lifecycle

#### 10. `invoice.finalized` ⚠️ **Not Currently Handled**

**Role**: Triggered when an invoice is finalized and ready for payment.

**Key Payload Fields**:

```typescript
{
  id: "in_xxx",
  customer: "cus_xxx",
  subscription: "sub_xxx",
  status: "paid",
  amount_due: 14900,
  amount_paid: 14900,
  billing_reason: "subscription_create",
  hosted_invoice_url: "https://invoice.stripe.com/...",
  invoice_pdf: "https://pay.stripe.com/invoice/...",
  lines: {
    data: [{
      amount: 14900,
      description: "1 × Contentstack Growth Plan (at $149.00 / month)",
      period: {
        start: 1771845523,
        end: 1774264723
      }
    }]
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Invoice finalization is handled by Stripe. Useful for invoice tracking/notifications, but not critical for subscription status.

---

#### 11. `invoice.created` ⚠️ **Not Currently Handled**

**Role**: Triggered when an invoice is created (before finalization).

**Key Payload Fields**:

```typescript
{
  id: "in_xxx",
  customer: "cus_xxx",
  subscription: "sub_xxx",
  status: "paid",
  billing_reason: "subscription_create",
  amount_due: 14900,
  amount_paid: 14900
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Invoice creation is part of Stripe's internal flow. Not needed for subscription tracking.

---

#### 12. `invoice.paid` ⚠️ **Not Currently Handled**

**Role**: Triggered when an invoice is marked as paid.

**Key Payload Fields**:

```typescript
{
  id: "in_xxx",
  customer: "cus_xxx",
  subscription: "sub_xxx",
  status: "paid",
  amount_paid: 14900,
  status_transitions: {
    paid_at: 1771845532
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - Invoice payment status is already captured via `invoice.payment_succeeded`. Redundant for subscription flow.

---

#### 13. `invoice.payment_succeeded` ✅ **Currently Handled**

**Role**: Triggered when an invoice payment succeeds. Used for recurring subscription payments.

**Key Payload Fields**:

```typescript
{
  id: "in_xxx",
  customer: "cus_xxx",
  subscription: "sub_xxx",         // Subscription ID
  status: "paid",
  amount_paid: 14900,
  billing_reason: "subscription_create" | "subscription_cycle",
  status_transitions: {
    paid_at: 1771845532
  }
}
```

**Current Processing**:

- ✅ Extracts subscription ID from invoice
- ✅ Retrieves subscription from Stripe
- ✅ Updates subscription record in database

**Status**: **Critical** - Handles recurring subscription payments (monthly/yearly renewals).

---

### Phase 5: Subscription Activation

#### 14. `customer.subscription.created` ✅ **Currently Handled**

**Role**: Triggered when a subscription is created and activated.

**Key Payload Fields**:

```typescript
{
  id: "sub_xxx",                    // Subscription ID
  customer: "cus_xxx",
  status: "active",
  current_period_start: 1771845523,
  current_period_end: 1774264723,
  billing_cycle_anchor: 1771845523,
  items: {
    data: [{
      id: "si_xxx",
      price: {
        id: "price_xxx",
        unit_amount: 14900,
        recurring: {
          interval: "month",
          interval_count: 1
        }
      },
      quantity: 1
    }]
  },
  latest_invoice: "in_xxx",
  default_payment_method: "pm_xxx"
}
```

**Current Processing**:

- ✅ Looks up customer in database
- ✅ Retrieves full subscription from Stripe SDK
- ✅ Creates/updates subscription record with full details
- ✅ Sets subscription status to `active`

**Status**: **Critical** - Confirms subscription activation and stores subscription details.

---

#### 15. `invoice_payment.paid` ⚠️ **Not Currently Handled**

**Role**: Triggered when an invoice payment record is created (internal Stripe record).

**Key Payload Fields**:

```typescript
{
  id: "inpay_xxx",
  invoice: "in_xxx",
  amount_paid: 14900,
  amount_requested: 14900,
  status: "paid",
  payment: {
    payment_intent: "pi_xxx",
    type: "payment_intent"
  },
  status_transitions: {
    paid_at: 1771845532
  }
}
```

**Current Status**: Acknowledged but not processed.

**Recommendation**: Optional - This is an internal Stripe record linking invoices to payments. Not needed for subscription tracking.

---

## Event Processing Summary

### ✅ Currently Handled Events (Critical)

| Event                           | Status     | Purpose                                   |
| ------------------------------- | ---------- | ----------------------------------------- |
| `checkout.session.completed`    | ✅ Handled | Primary event for subscription activation |
| `customer.subscription.created` | ✅ Handled | Confirms subscription creation            |
| `customer.subscription.updated` | ✅ Handled | Handles subscription changes              |
| `customer.subscription.deleted` | ✅ Handled | Handles subscription cancellation         |
| `invoice.payment_succeeded`     | ✅ Handled | Handles recurring payment success         |
| `invoice.payment_failed`        | ✅ Handled | Handles recurring payment failures        |

### ⚠️ Not Currently Handled Events

| Event                     | Recommendation | Reason                                                 |
| ------------------------- | -------------- | ------------------------------------------------------ |
| `customer.created`        | Optional       | Customer creation handled synchronously                |
| `customer.updated`        | Optional       | Customer updates not critical for subscriptions        |
| `payment_intent.*`        | Optional       | Payment intents managed by Stripe during checkout      |
| `payment_method.attached` | Optional       | Payment methods managed by Stripe                      |
| `mandate.updated`         | Optional       | Mandates managed by Stripe for recurring payments      |
| `charge.succeeded`        | Optional       | Charge success captured via checkout.session.completed |
| `invoice.finalized`       | Optional       | Invoice finalization handled by Stripe                 |
| `invoice.created`         | Optional       | Invoice creation part of Stripe's internal flow        |
| `invoice.paid`            | Optional       | Redundant with invoice.payment_succeeded               |
| `invoice_payment.paid`    | Optional       | Internal Stripe record, not needed for tracking        |

---

## Webhook Processing Flow

```
1. Stripe sends webhook → POST /payments/webhook
2. Backend verifies signature using STRIPE_WEBHOOK_SECRET
3. Backend checks if event already processed (idempotency)
4. Backend routes event to appropriate handler:
   ├─ checkout.session.completed → handleCheckoutSessionCompleted()
   ├─ customer.subscription.* → handleSubscriptionUpdated/Deleted()
   └─ invoice.payment_* → handleInvoicePaymentSucceeded/Failed()
5. Handler looks up customer in database
6. Handler retrieves subscription from Stripe SDK
7. Handler updates/creates subscription record
8. Handler updates checkout session status (if applicable)
9. Backend marks event as processed
10. Returns 200 OK to Stripe
```

---

## Key Features

### 1. Idempotency Protection

Events are tracked in the `webhook_events` collection to prevent duplicate processing:

```typescript
{
  event_id: "evt_xxx",        // Stripe event ID
  event_type: "checkout.session.completed",
  processed: true,
  processed_at: Date,
  processing_result: {
    success: true,
    subscription_id: "sub_xxx",
    organization_id: "org_xxx"
  }
}
```

### 2. Customer Lookup

The service looks up customers in the database using the Stripe customer ID from the webhook event:

```typescript
const customer = await stripeCustomerModel.findOne({
  stripe_customer_id: customerId,
});
```

If customer is not found, webhook processing fails (but returns 200 to Stripe to prevent retries).

### 3. Subscription Verification

After customer lookup, the service:

1. Retrieves the full subscription from Stripe using the Stripe SDK
2. Verifies subscription details
3. Updates or creates subscription record in database

---

## Error Handling

The webhook handler follows Stripe best practices:

1. **Always returns 200** - Even if processing fails, the endpoint returns 200 to prevent immediate retries
2. **Logs errors** - All errors are logged with full context
3. **Tracks failures** - Failed events are marked in the database for manual retry
4. **Idempotent** - Duplicate events are safely ignored

---

## Benefits of Backchannel Approach

1. **Reliability** - Webhooks provide a reliable backchannel independent of user actions
2. **Real-time Updates** - Subscription status updates immediately when Stripe processes payment
3. **Redundancy** - Works even if `/checkout/success` endpoint fails or is not called
4. **Event History** - All webhook events are tracked for audit and debugging
5. **Idempotency** - Prevents duplicate processing of the same event

---

## Comparison: `/checkout/success` vs Webhook

| Aspect      | `/checkout/success`          | Webhook                   |
| ----------- | ---------------------------- | ------------------------- |
| Trigger     | User redirects after payment | Stripe sends event        |
| Timing      | Immediate after redirect     | May arrive slightly later |
| Reliability | Depends on user action       | Guaranteed by Stripe      |
| Use Case    | Frontend confirmation        | Backend status sync       |

Both approaches complement each other:

- `/checkout/success` provides immediate feedback to users
- Webhook ensures backend is always in sync with Stripe

---

## Recommendations

### Current Implementation Assessment

✅ **Well Implemented**:

- Critical events (`checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`) are properly handled
- Idempotency protection prevents duplicate processing
- Customer lookup ensures data integrity
- Subscription verification via Stripe SDK ensures accuracy

### Optional Enhancements

If you need additional features, consider handling:

1. **`charge.succeeded`** - For payment audit/receipt tracking
2. **`invoice.finalized`** - For invoice notification/email triggers
3. **`customer.updated`** - For customer data synchronization

However, these are **not required** for the current subscription flow to work correctly.

---

## Testing

### Prerequisites

1. **Stripe Test Mode**: Use Stripe test API keys (starts with `pk_test_` and `sk_test_`)
2. **MongoDB**: Ensure MongoDB is running and connected
3. **Test Card Numbers**:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`
   - Any future expiry date (e.g., `12/34`)
   - Any 3-digit CVC (e.g., `123`)

### Local Webhook Testing with Stripe CLI

Stripe doesn't accept `http://localhost:3000` URLs for webhooks because Stripe requires HTTPS endpoints. Use Stripe CLI to forward webhooks to your local server.

#### Step 1: Install Stripe CLI

**macOS:**

```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**

```bash
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Windows:** Download from https://github.com/stripe/stripe-cli/releases/latest

#### Step 2: Login to Stripe

```bash
stripe login
```

#### Step 3: Forward Webhooks to Local Server

```bash
stripe listen --forward-to localhost:3000/payments/webhook
```

**Output:**

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

**⚠️ IMPORTANT**: Copy the webhook signing secret! Add it to your `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Note**: This secret is different from the one in Stripe Dashboard. Use the CLI secret for local testing.

#### Step 4: Restart Your Application

Restart your NestJS server to load the new environment variable.

#### Step 5: Trigger Test Events

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test subscription creation
stripe trigger customer.subscription.created

# Test subscription update
stripe trigger customer.subscription.updated

# Test subscription deletion
stripe trigger customer.subscription.deleted

# Test invoice payment success
stripe trigger invoice.payment_succeeded

# Test invoice payment failure
stripe trigger invoice.payment_failed
```

### End-to-End Testing

#### Step 1: Create Checkout Session

```bash
curl -X POST http://localhost:3000/payments/checkout \
  -H "Content-Type: application/json" \
  -H "x-organization-id: org_test_123" \
  -H "x-customer-email: test@example.com" \
  -d '{
    "subscription_plan_uid": "your_plan_uid",
    "billing_interval": "month",
    "overages_enabled": false,
    "overage_bandwidth": false,
    "overage_api": false
  }'
```

**Response:**

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_abc123..."
}
```

#### Step 2: Complete Payment

1. Copy the `checkout_url` from the response
2. Open it in your browser
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete the payment

#### Step 3: Verify Webhook Processing

Check your application logs and database:

```bash
# Check webhook events
mongosh revenue-engine --eval "db.webhook_events.find().sort({created_at: -1}).limit(1).pretty()"

# Check subscriptions
mongosh revenue-engine --eval "db.subscriptions.find().sort({created_at: -1}).limit(1).pretty()"

# Check checkout sessions
mongosh revenue-engine --eval "db.checkout_sessions.find().sort({created_at: -1}).limit(1).pretty()"
```

### Production Webhook Setup

#### Step 1: Configure Webhook in Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Create an event destination" or "Add endpoint"
3. Configure settings:
   - **Where**: Your account ✅
   - **API Version**: Use your account's default API version ✅
   - **Event Payload**: Snapshot ✅
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Choose destination: **Webhook endpoint**
6. Enter endpoint URL: `https://your-domain.com/payments/webhook`
7. Click "Create"

#### Step 2: Copy Webhook Signing Secret

1. Click on your newly created webhook endpoint
2. Find the **"Signing secret"** section
3. Click **"Reveal"** to show the secret
4. Copy the secret (it starts with `whsec_...`)
5. Add it to your `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

**⚠️ Security Note**: Never commit this secret to version control. Keep it in `.env` file which should be in `.gitignore`.

#### Step 3: Test Your Webhook

1. In your webhook endpoint details, click **"Send test webhook"**
2. Select an event type (e.g., `checkout.session.completed`)
3. Click **"Send test webhook"**
4. Check your application logs to verify it was received

### Troubleshooting

#### Webhook Signature Verification Fails

1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure `rawBody: true` is set in `main.ts` (already configured)
3. Check that the webhook endpoint URL matches Stripe Dashboard

#### Customer Not Found

- Ensure customer was created before checkout
- Check `stripe_customers` collection for customer record
- Verify `organization_id` mapping is correct

#### Subscription Not Updated

- Check webhook event logs
- Verify subscription exists in Stripe
- Check database connection
- Review error logs for processing failures

#### Webhook Not Receiving Events

1. Check endpoint URL: Ensure it's correct and publicly accessible
2. Verify HTTPS: Production endpoints must use HTTPS
3. Check firewall: Ensure Stripe can reach your server
4. Review logs: Check Stripe Dashboard → Webhooks → Your endpoint → Events tab

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...          # Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_...    # Stripe publishable key (for frontend)
STRIPE_WEBHOOK_SECRET=whsec_...       # Webhook signing secret

# Database
MONGODB_URI=mongodb://localhost:27017/revenue-engine

# Application
PORT=3000
NODE_ENV=development
```

### NestJS Configuration

Ensure `rawBody: true` is set in `main.ts` for webhook signature verification:

```typescript
const app = await NestFactory.create(AppModule, {
  rawBody: true, // Required for webhook signature verification
});
```

### Required Dependencies

```bash
npm install @nestjs/mongoose mongoose stripe
npm install --save-dev @types/node
```

---

## API Interaction Flow

### Complete Payment Flow Diagram

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       │ 1. POST /payments/checkout
       │    Headers: x-organization-id, x-customer-email
       │    Body: { subscription_plan_uid, billing_interval, ... }
       ▼
┌──────────────────────┐
│  PaymentController   │
│  POST /checkout       │
└──────┬───────────────┘
       │
       │ 2. Lookup subscription plan
       │ 3. Find matching price
       │ 4. Validate price with Stripe
       │ 5. Get or create Stripe customer
       │ 6. Create checkout session
       │ 7. Save to MongoDB
       │
       ▼
┌──────────────────────┐
│   StripeService       │
└──────┬───────────────┘
       │
       │ Returns: { checkout_url }
       │
       ▼
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       │ 8. Redirect user to checkout_url
       │
       ▼
┌─────────────┐
│   Stripe    │
│  Checkout   │
└──────┬──────┘
       │
       │ 9. User completes payment
       │
       │ 10. Redirect to success URL
       │     ?session_id={CHECKOUT_SESSION_ID}
       │
       ▼
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       │ 11. POST /payments/checkout/success
       │     Body: { session_id }
       │
       ▼
┌──────────────────────┐
│  PaymentController   │
│  POST /checkout/     │
│      success         │
└──────┬───────────────┘
       │
       │ 12. Retrieve session from Stripe
       │ 13. Verify payment status
       │ 14. Get subscription details
       │
       ▼
┌─────────────┐
│  Frontend   │
│  (Shows     │
│  success)   │
└─────────────┘

       │
       │ (Async - happens in parallel)
       │
       ▼
┌─────────────┐
│   Stripe    │
└──────┬──────┘
       │
       │ 15. POST /payments/webhook
       │     Event: checkout.session.completed
       │
       ▼
┌──────────────────────┐
│  WebhookController   │
│  POST /webhook        │
└──────┬───────────────┘
       │
       │ 16. Verify signature
       │ 17. Check idempotency
       │ 18. Lookup customer
       │ 19. Retrieve subscription
       │ 20. Update database
       │
       ▼
┌─────────────┐
│  MongoDB    │
│  - Events   │
│  - Subs     │
│  - Sessions │
└─────────────┘
```

### Key API Interactions

1. **Checkout Initiation**: Frontend → `POST /payments/checkout` → Backend creates Stripe session
2. **Payment Completion**: User → Stripe Checkout → Stripe processes payment
3. **Success Verification**: Frontend → `POST /payments/checkout/success` → Backend verifies payment
4. **Webhook Processing**: Stripe → `POST /payments/webhook` → Backend updates database
5. **Customer Management**: Backend automatically creates/retrieves customers via StripeService
6. **Subscription Tracking**: Webhook handler creates/updates subscription records

---

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
2. **Session Validation**: Verify session belongs to the organization
3. **Idempotency**: Check if session/event was already processed
4. **Error Handling**: Handle expired or invalid sessions gracefully
5. **Never expose secret keys**: Keep `STRIPE_SECRET_KEY` server-side only
6. **Use HTTPS**: Always use HTTPS in production
7. **Validate amounts**: Always validate payment amounts server-side

---

## Best Practices

1. **Always verify webhook signatures** - Never trust unverified events
2. **Handle idempotency** - Use event IDs to prevent duplicate processing
3. **Return 200 quickly** - Process events asynchronously if needed
4. **Log everything** - Maintain audit trail of all webhook events
5. **Monitor failures** - Set up alerts for failed webhook processing
6. **Test thoroughly** - Use Stripe CLI for local testing before production

---

## Support & Resources

- [Stripe Documentation](https://docs.stripe.com)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks)
- [Stripe Webhook Best Practices](https://docs.stripe.com/webhooks/best-practices)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [NestJS Documentation](https://docs.nestjs.com)

---

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
