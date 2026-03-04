# Checkout Flow Explanation

## How Session ID Works in Success Flow

### The Complete Flow

1. **Frontend → POST /stripe/checkout**
   - Frontend sends: `{ organization_id, plan_id, billing_interval, ... }`
   - Backend creates Stripe customer (or retrieves existing)
   - Backend creates Stripe checkout session
   - Backend saves both to MongoDB
   - Backend returns: `{ checkout_url: "https://checkout.stripe.com/..." }`

2. **Frontend → Redirects User to Stripe**
   - Frontend redirects user to `checkout_url`
   - User completes payment on Stripe's hosted page

3. **Stripe → Redirects Back to Your Frontend**
   - Stripe redirects to: `{successUrl}?session_id={CHECKOUT_SESSION_ID}`
   - The `{CHECKOUT_SESSION_ID}` placeholder is automatically replaced by Stripe with the actual session ID
   - Example: `https://yourapp.com/checkout/success?session_id=cs_test_abc123`

4. **Frontend → GET /stripe/checkout/success?session_id=cs_test_abc123**
   - Frontend extracts `session_id` from URL query parameter
   - Frontend calls your backend: `GET /stripe/checkout/success?session_id=cs_test_abc123`
   - Backend:
     - Retrieves session from Stripe using `session_id`
     - Verifies payment was successful
     - Retrieves subscription information
     - Returns subscription details

5. **Webhook (Async) → POST /stripe/webhook**
   - Stripe sends webhook event `checkout.session.completed`
   - Your backend processes the webhook
   - Updates checkout session status in MongoDB
   - Performs any additional business logic

## Why Session ID is Needed

The `session_id` is crucial because:

1. **Verification**: It allows your backend to verify the payment was actually completed
2. **Idempotency**: Prevents duplicate processing if user refreshes the success page
3. **Data Retrieval**: Used to fetch subscription details from Stripe
4. **Audit Trail**: Links the checkout session in MongoDB to the Stripe transaction

## Implementation Details

### Success URL Configuration

In `POST /stripe/checkout`, the success URL is configured as:

```typescript
successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
```

**Important**: Stripe automatically replaces `{CHECKOUT_SESSION_ID}` with the actual session ID when redirecting.

### Frontend Implementation

```javascript
// After redirect from Stripe
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');

if (sessionId) {
  // Call your backend to verify and get subscription details
  const response = await fetch(`/stripe/checkout/success?session_id=${sessionId}`);
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

### Backend Verification Process

The `GET /stripe/checkout/success` endpoint:

1. Receives `session_id` from query parameter
2. Retrieves session from Stripe: `stripe.checkout.sessions.retrieve(sessionId)`
3. Checks if `session.status === 'complete'`
4. Finds checkout session in MongoDB using `stripe_session_id`
5. Retrieves subscription from Stripe using `session.subscription`
6. Returns formatted subscription data

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Session Validation**: Verify session belongs to the organization
3. **Idempotency**: Check if session was already processed
4. **Error Handling**: Handle expired or invalid sessions gracefully

## Database Schema

### StripeCustomer Collection (`stripe_customers`)

```typescript
{
  organization_id: "org_123",
  stripe_customer_id: "cus_abc123",
  email: "user@example.com",
  stripe_data: { ... },
  created_at: Date,
  updated_at: Date
}
```

### CheckoutSession Collection (`checkout_sessions`)

```typescript
{
  organization_id: "org_123",
  stripe_session_id: "cs_test_abc123",
  stripe_customer_id: "cus_abc123",
  plan_id: "starter",
  billing_interval: "month",
  status: "completed", // pending, completed, expired
  metadata: { ... },
  created_at: Date,
  updated_at: Date
}
```

## Next Steps

1. **Install MongoDB dependencies**: `npm install @nestjs/mongoose mongoose`
2. **Set MONGODB_URI** in `.env`: `MONGODB_URI=mongodb://localhost:27017/revenue-engine`
3. **Implement Plan Lookup**: Integrate with your plans service to fetch `stripe_price_id`
4. **Configure Webhook**: Set up webhook endpoint in Stripe Dashboard
5. **Test Flow**: Test the complete checkout flow end-to-end

---

# Checkout Flow Explanation

## How Session ID Works in Success Flow

### The Complete Flow

## Testing the Complete Flow

### Prerequisites

1. **Server running**: Ensure your NestJS server is running on `http://localhost:3000`
2. **Stripe Test Mode**: Use Stripe test API keys (starts with `pk_test_` and `sk_test_`)
3. **MongoDB**: Ensure MongoDB is running and connected
4. **Test Card Numbers**:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`
   - Any future expiry date (e.g., `12/34`)
   - Any 3-digit CVC (e.g., `123`)

### Step 1: Create Checkout Session

**Endpoint**: `POST /stripe/checkout`

**Request Body**:

```json
{
  "organization_id": "org_test_123",
  "plan_id": "starter",
  "billing_interval": "month",
  "priceId": "price_test_1234567890",
  "overages_enabled": false,
  "overage_bandwidth": false,
  "overage_api": false
}
```

**cURL Command**:

```bash
curl -X POST http://localhost:3000/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_test_123",
    "plan_id": "starter",
    "billing_interval": "month",
    "priceId": "price_test_1234567890",
    "overages_enabled": false,
    "overage_bandwidth": false,
    "overage_api": false
  }'
```

**Expected Response**:

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_abc123..."
}
```

**Note**: You need to provide a valid `priceId`. To get a test price ID:

1. Create a product and price in Stripe Dashboard (test mode)
2. Or use the Stripe API to create them (see examples below)

### Step 2: Create Product and Price (If Needed)

**Create Product**:

```bash
curl -X POST http://localhost:3000/stripe/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Starter Plan",
    "description": "Monthly subscription plan",
    "images": []
  }'
```

**Create Price**:

```bash
curl -X POST http://localhost:3000/stripe/prices \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod_xxxxx",
    "unitAmount": 2900,
    "currency": "usd",
    "recurring": {
      "interval": "month"
    }
  }'
```

### Step 3: Complete Payment on Stripe

1. Copy the `checkout_url` from Step 1 response
2. Open it in your browser
3. Fill in test card details:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Name: Any name
   - Email: Any email
4. Click "Pay" or "Subscribe"
5. Stripe will redirect to: `http://localhost:3000/checkout-success?session_id=cs_test_abc123`

### Step 4: Verify Checkout Success

**Endpoint**: `GET /stripe/checkout/success?session_id={SESSION_ID}`

**cURL Command**:

```bash
# Replace cs_test_abc123 with the actual session_id from the redirect URL
curl -X GET "http://localhost:3000/stripe/checkout/success?session_id=cs_test_abc123" \
  -H "Content-Type: application/json"
```

**Expected Response**:

```json
{
  "session": {
    "id": "cs_test_abc123",
    "status": "complete",
    "customer": "cus_xxxxx",
    "subscription": "sub_xxxxx"
  },
  "subscription": {
    "id": "sub_xxxxx",
    "status": "active",
    "current_period_start": 1234567890,
    "current_period_end": 1234567890
  },
  "checkoutSession": {
    "organization_id": "org_test_123",
    "stripe_session_id": "cs_test_abc123",
    "status": "completed"
  }
}
```

### Step 5: Simulate Webhook (Optional)

**Endpoint**: `POST /stripe/webhook`

**Note**: In production, Stripe sends webhooks automatically. For testing, you can simulate them using Stripe CLI:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
# Login: stripe login
# Forward webhooks: stripe listen --forward-to localhost:3000/stripe/webhook

# Trigger a test webhook event
stripe trigger checkout.session.completed
```

**Manual Webhook Test** (requires proper signature):

```bash
# This is complex - use Stripe CLI instead
# The webhook requires a valid Stripe signature header
```

### Complete Test Script

Save this as `test-checkout-flow.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
ORG_ID="org_test_$(date +%s)"
PLAN_ID="starter"
BILLING_INTERVAL="month"

echo "Step 1: Creating checkout session..."
CHECKOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/stripe/checkout" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"$ORG_ID\",
    \"plan_id\": \"$PLAN_ID\",
    \"billing_interval\": \"$BILLING_INTERVAL\",
    \"priceId\": \"price_test_1234567890\",
    \"overages_enabled\": false
  }")

echo "Response: $CHECKOUT_RESPONSE"

# Extract checkout_url (requires jq: brew install jq)
CHECKOUT_URL=$(echo $CHECKOUT_RESPONSE | jq -r '.checkout_url')

if [ "$CHECKOUT_URL" != "null" ] && [ ! -z "$CHECKOUT_URL" ]; then
  echo ""
  echo "✓ Checkout session created!"
  echo "Checkout URL: $CHECKOUT_URL"
  echo ""
  echo "Next steps:"
  echo "1. Open the checkout URL in your browser"
  echo "2. Complete payment with test card: 4242 4242 4242 4242"
  echo "3. After redirect, extract session_id from URL"
  echo "4. Run: curl \"$BASE_URL/stripe/checkout/success?session_id=YOUR_SESSION_ID\""
else
  echo "✗ Failed to create checkout session"
  exit 1
fi
```

### Testing with Postman

**Collection JSON** (import into Postman):

```json
{
  "info": {
    "name": "Stripe Checkout Flow",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Checkout Session",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"organization_id\": \"org_test_123\",\n  \"plan_id\": \"starter\",\n  \"billing_interval\": \"month\",\n  \"priceId\": \"price_test_1234567890\",\n  \"overages_enabled\": false\n}"
        },
        "url": {
          "raw": "http://localhost:3000/stripe/checkout",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["stripe", "checkout"]
        }
      }
    },
    {
      "name": "Verify Checkout Success",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:3000/stripe/checkout/success?session_id=cs_test_abc123",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["stripe", "checkout", "success"],
          "query": [
            {
              "key": "session_id",
              "value": "cs_test_abc123",
              "description": "Replace with actual session_id from redirect URL"
            }
          ]
        }
      }
    }
  ]
}
```

### Troubleshooting

1. **"Price ID is required" error**:
   - Create a product and price first using the endpoints above
   - Or implement the plan lookup service to fetch `stripe_price_id` automatically

2. **Webhook signature verification fails**:
   - Ensure `STRIPE_WEBHOOK_SECRET` is set in `.env`
   - Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/stripe/webhook`

3. **MongoDB connection errors**:
   - Verify `MONGODB_URI` in `.env` is correct
   - Ensure MongoDB is running: `mongod` or `brew services start mongodb-community`

4. **Session not found**:
   - Ensure you're using the correct `session_id` from the redirect URL
   - Check that the session was created in test mode (session IDs start with `cs_test_`)

---

1. **Frontend → POST /stripe/checkout**
   - Frontend sends: `{ organization_id, plan_id, billing_interval, ... }`
   - Backend creates Stripe customer (or retrieves existing)
   - Backend creates Stripe checkout session
   - Backend saves both to MongoDB
   - Backend returns: `{ checkout_url: "https://checkout.stripe.com/..." }`

2. **Frontend → Redirects User to Stripe**
   - Frontend redirects user to `checkout_url`
   - User completes payment on Stripe's hosted page

3. **Stripe → Redirects Back to Your Frontend**
   - Stripe redirects to: `{successUrl}?session_id={CHECKOUT_SESSION_ID}`
   - The `{CHECKOUT_SESSION_ID}` placeholder is automatically replaced by Stripe with the actual session ID
   - Example: `https://yourapp.com/checkout/success?session_id=cs_test_abc123`

4. **Frontend → GET /stripe/checkout/success?session_id=cs_test_abc123**
   - Frontend extracts `session_id` from URL query parameter
   - Frontend calls your backend: `GET /stripe/checkout/success?session_id=cs_test_abc123`
   - Backend:
     - Retrieves session from Stripe using `session_id`
     - Verifies payment was successful
     - Retrieves subscription information
     - Returns subscription details

5. **Webhook (Async) → POST /stripe/webhook**
   - Stripe sends webhook event `checkout.session.completed`
   - Your backend processes the webhook
   - Updates checkout session status in MongoDB
   - Performs any additional business logic

## Why Session ID is Needed

The `session_id` is crucial because:

1. **Verification**: It allows your backend to verify the payment was actually completed
2. **Idempotency**: Prevents duplicate processing if user refreshes the success page
3. **Data Retrieval**: Used to fetch subscription details from Stripe
4. **Audit Trail**: Links the checkout session in MongoDB to the Stripe transaction

## Implementation Details

### Success URL Configuration

In `POST /stripe/checkout`, the success URL is configured as:

```typescript
successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
```

**Important**: Stripe automatically replaces `{CHECKOUT_SESSION_ID}` with the actual session ID when redirecting.

### Frontend Implementation

```javascript
// After redirect from Stripe
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');

if (sessionId) {
  // Call your backend to verify and get subscription details
  const response = await fetch(`/stripe/checkout/success?session_id=${sessionId}`);
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

### Backend Verification Process

The `GET /stripe/checkout/success` endpoint:

1. Receives `session_id` from query parameter
2. Retrieves session from Stripe: `stripe.checkout.sessions.retrieve(sessionId)`
3. Checks if `session.status === 'complete'`
4. Finds checkout session in MongoDB using `stripe_session_id`
5. Retrieves subscription from Stripe using `session.subscription`
6. Returns formatted subscription data

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Session Validation**: Verify session belongs to the organization
3. **Idempotency**: Check if session was already processed
4. **Error Handling**: Handle expired or invalid sessions gracefully

## Database Schema

### StripeCustomer Collection (`stripe_customers`)

```typescript
{
  organization_id: "org_123",
  stripe_customer_id: "cus_abc123",
  email: "user@example.com",
  stripe_data: { ... },
  created_at: Date,
  updated_at: Date
}
```

### CheckoutSession Collection (`checkout_sessions`)

```typescript
{
  organization_id: "org_123",
  stripe_session_id: "cs_test_abc123",
  stripe_customer_id: "cus_abc123",
  plan_id: "starter",
  billing_interval: "month",
  status: "completed", // pending, completed, expired
  metadata: { ... },
  created_at: Date,
  updated_at: Date
}
```

## Next Steps

1. **Install MongoDB dependencies**: `npm install @nestjs/mongoose mongoose`
2. **Set MONGODB_URI** in `.env`: `MONGODB_URI=mongodb://localhost:27017/revenue-engine`
3. **Implement Plan Lookup**: Integrate with your plans service to fetch `stripe_price_id`
4. **Configure Webhook**: Set up webhook endpoint in Stripe Dashboard
5. **Test Flow**: Test the complete checkout flow end-to-end
