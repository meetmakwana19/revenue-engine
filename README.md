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
   - Handles idempotency checking
   - Looks up customer in database
   - Verifies subscription with Stripe SDK
   - Updates subscription status in database

3. **Database Schemas**
   - `WebhookEvent` - Tracks processed events for idempotency
   - `Subscription` - Stores subscription status and details

### Supported Events

#### Primary Events

- **`checkout.session.completed`** - Main event for successful payment completion
  - Looks up customer
  - Verifies subscription
  - Creates/updates subscription record
  - Updates checkout session status

#### Subscription Events

- **`customer.subscription.created`** - New subscription created
- **`customer.subscription.updated`** - Subscription updated (status change, plan change, etc.)
- **`customer.subscription.deleted`** - Subscription canceled

#### Invoice Events

- **`invoice.payment_succeeded`** - Successful invoice payment
- **`invoice.payment_failed`** - Failed invoice payment

### Webhook Processing Flow

```
1. Stripe sends webhook → POST /payments/webhook
2. Backend verifies signature using STRIPE_WEBHOOK_SECRET
3. Backend checks if event already processed (idempotency)
4. Backend looks up customer in database
5. Backend retrieves subscription from Stripe
6. Backend updates/creates subscription record
7. Backend updates checkout session status (if applicable)
8. Backend marks event as processed
9. Returns 200 OK to Stripe
```

### Key Features

#### 1. Idempotency Protection

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

#### 2. Customer Lookup

The service looks up customers in the database using the Stripe customer ID from the webhook event:

```typescript
const customer = await stripeCustomerModel.findOne({
  stripe_customer_id: customerId,
});
```

If customer is not found, webhook processing fails (but returns 200 to Stripe to prevent retries).

#### 3. Subscription Verification

After customer lookup, the service:

1. Retrieves the full subscription from Stripe using the Stripe SDK
2. Verifies subscription details
3. Updates or creates subscription record in database

### Error Handling

The webhook handler follows Stripe best practices:

1. **Always returns 200** - Even if processing fails, the endpoint returns 200 to prevent immediate retries
2. **Logs errors** - All errors are logged with full context
3. **Tracks failures** - Failed events are marked in the database for manual retry
4. **Idempotent** - Duplicate events are safely ignored

### Benefits of Backchannel Approach

1. **Reliability** - Webhooks provide a reliable backchannel independent of user actions
2. **Real-time Updates** - Subscription status updates immediately when Stripe processes payment
3. **Redundancy** - Works even if `/checkout/success` endpoint fails or is not called
4. **Event History** - All webhook events are tracked for audit and debugging
5. **Idempotency** - Prevents duplicate processing of the same event

### Comparison: `/checkout/success` vs Webhook

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
