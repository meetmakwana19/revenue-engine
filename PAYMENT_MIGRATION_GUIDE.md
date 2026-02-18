# Payment Migration Guide: From Stripe Payment Links to Custom Payment Flow

## Overview

This guide explains how to migrate from Stripe Payment Links (hosted by Stripe) to a custom payment flow where your backend orchestrates the payment process.

## Architecture Comparison

### Before (Payment Links)
```
Frontend → Stripe Payment Link → Stripe Hosted Checkout → Success/Cancel
```

### After (Custom Flow)
```
Frontend → Your Backend API → Stripe API → Webhook → Your Backend → Frontend
```

## Two Approaches Available

### Approach 1: Checkout Sessions (Recommended)
Best for: Custom UI with Stripe-hosted checkout page
- Similar to Payment Links but fully controlled by your backend
- Stripe handles the payment UI
- Easy migration from Payment Links

### Approach 2: Payment Intents + Stripe Elements
Best for: Fully custom payment UI
- Complete control over payment UI
- More complex but maximum customization

## Implementation Details

### 1. Checkout Session Flow (Recommended)

#### Step 1: Create Checkout Session (Backend)

**Endpoint:** `POST /stripe/checkout-sessions`

**Request Body:**
```json
{
  "priceId": "price_1234567890",  // From your existing payment link
  "customerEmail": "customer@example.com",
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel",
  "metadata": {
    "orderId": "order_123",
    "userId": "user_456"
  }
}
```

**Response:**
```json
{
  "id": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "status": "open"
}
```

#### Step 2: Redirect User to Checkout URL (Frontend)

```javascript
// React example
const handlePayment = async () => {
  const response = await fetch('http://your-api.com/stripe/checkout-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId: 'price_1234567890', // From your existing payment link
      customerEmail: user.email,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/cancel`,
      metadata: {
        orderId: order.id,
        userId: user.id
      }
    })
  });
  
  const session = await response.json();
  window.location.href = session.url; // Redirect to Stripe Checkout
};
```

#### Step 3: Handle Webhook Events (Backend)

**Webhook Endpoint:** `POST /stripe/webhook`

Stripe will send events to this endpoint when payments complete.

**Configure Webhook in Stripe Dashboard:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-api.com/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy the webhook secret to `.env` as `STRIPE_WEBHOOK_SECRET`

### 2. Payment Intent Flow (Advanced)

#### Step 1: Create Payment Intent (Backend)

**Endpoint:** `POST /stripe/payment-intents`

**Request Body:**
```json
{
  "priceId": "price_1234567890",
  "customerEmail": "customer@example.com",
  "metadata": {
    "orderId": "order_123"
  }
}
```

**Response:**
```json
{
  "id": "pi_1234567890",
  "client_secret": "pi_1234567890_secret_...",
  "status": "requires_payment_method"
}
```

#### Step 2: Use Stripe Elements (Frontend)

```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...'); // Your publishable key

function CheckoutForm({ clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      }
    });

    if (error) {
      console.error(error);
    } else if (paymentIntent.status === 'succeeded') {
      // Payment succeeded
      window.location.href = '/success';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit">Pay</button>
    </form>
  );
}
```

## Migration Steps

### Step 1: Get Your Price IDs

From your existing Payment Links, extract the Price IDs:
1. Go to Stripe Dashboard → Products
2. Find products used in Payment Links
3. Copy the Price IDs (e.g., `price_1234567890`)

### Step 2: Update Environment Variables

Add to `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe Dashboard → Webhooks
```

### Step 3: Update Frontend

Replace Payment Link redirects with API calls:

**Before:**
```javascript
window.location.href = 'https://buy.stripe.com/test_dRm7sE2rQbdscvcea';
```

**After (Checkout Session):**
```javascript
const response = await fetch('/api/stripe/checkout-sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    priceId: 'price_1234567890',
    customerEmail: user.email,
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/cancel`
  })
});
const { url } = await response.json();
window.location.href = url;
```

### Step 4: Handle Webhooks

The webhook endpoint automatically handles:
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `checkout.session.completed` - Checkout completed

Add your business logic in the webhook handler (e.g., update database, send emails).

## API Endpoints Reference

### Checkout Sessions
- `POST /stripe/checkout-sessions` - Create checkout session
- `GET /stripe/checkout-sessions/:id` - Get checkout session status

### Payment Intents
- `POST /stripe/payment-intents` - Create payment intent
- `GET /stripe/payment-intents/:id` - Get payment intent status
- `POST /stripe/payment-intents/:id/confirm` - Confirm payment intent
- `POST /stripe/payment-intents/:id/cancel` - Cancel payment intent

### Webhooks
- `POST /stripe/webhook` - Receive Stripe webhook events

## Testing

### Test Mode
Use test API keys and test Price IDs:
- Test Price IDs start with `price_test_...`
- Test Payment Intents start with `pi_test_...`
- Test Checkout Sessions start with `cs_test_...`

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

## Security Considerations

1. **Never expose secret keys** - Keep `STRIPE_SECRET_KEY` server-side only
2. **Verify webhook signatures** - Always verify webhook events using `STRIPE_WEBHOOK_SECRET`
3. **Use HTTPS** - Always use HTTPS in production
4. **Validate amounts** - Always validate payment amounts server-side
5. **Idempotency** - Use idempotency keys for payment operations

## Benefits of Custom Flow

1. **Full Control** - Control the entire payment experience
2. **Better UX** - Seamless integration with your app
3. **Custom Logic** - Add custom business logic before/after payment
4. **Better Tracking** - Track payments in your database
5. **Flexibility** - Easy to add features like discounts, coupons, etc.

## Support

For issues or questions:
- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
