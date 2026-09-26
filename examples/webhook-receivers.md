# Webhook Receiver Examples

Examples of how to build webhook receivers that work with this kit.

## Basic Node.js/Express Receiver

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const eventType = req.headers['x-webhook-event-type'];
  
  const rawBody = req.body.toString('utf8');
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const payload = JSON.parse(rawBody);
  
  // Process the webhook
  console.log(`Received ${eventType}:`, payload);
  
  res.json({ success: true });
});

app.listen(3000);
```

## Next.js API Route Receiver

```typescript
// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-webhook-signature');
  const timestamp = request.headers.get('x-webhook-timestamp');
  const eventType = request.headers.get('x-webhook-event-type');
  
  if (!signature || !timestamp || !eventType) {
    return NextResponse.json(
      { error: 'Missing webhook headers' },
      { status: 400 }
    );
  }
  
  const body = await request.text();
  const secret = process.env.WEBHOOK_SECRET!;
  
  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }
  
  const payload = JSON.parse(body);
  
  // Process based on event type
  switch (eventType) {
    case 'user.created':
      await handleUserCreated(payload);
      break;
    case 'order.completed':
      await handleOrderCompleted(payload);
      break;
    default:
      console.log(`Unknown event type: ${eventType}`);
  }
  
  return NextResponse.json({ success: true });
}

async function handleUserCreated(payload: any) {
  console.log('New user:', payload);
  // Your logic here
}

async function handleOrderCompleted(payload: any) {
  console.log('Order completed:', payload);
  // Your logic here
}
```

## Python/Flask Receiver

```python
from flask import Flask, request, jsonify
import hmac
import hashlib

app = Flask(__name__)
SECRET = 'your-webhook-secret'

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    timestamp = request.headers.get('X-Webhook-Timestamp')
    event_type = request.headers.get('X-Webhook-Event-Type')
    
    if not all([signature, timestamp, event_type]):
        return jsonify({'error': 'Missing headers'}), 400
    
    payload = request.get_data()
    
    if not verify_signature(payload, signature, SECRET):
        return jsonify({'error': 'Invalid signature'}), 401
    
    data = request.get_json()
    
    print(f'Received {event_type}:', data)
    
    # Process the webhook
    if event_type == 'user.created':
        handle_user_created(data)
    elif event_type == 'order.completed':
        handle_order_completed(data)
    
    return jsonify({'success': True})

def handle_user_created(data):
    print('New user:', data)

def handle_order_completed(data):
    print('Order completed:', data)

if __name__ == '__main__':
    app.run(port=3000)
```

## Go Receiver

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "io"
    "log"
    "net/http"
)

const webhookSecret = "your-webhook-secret"

func verifySignature(payload []byte, signature, secret string) bool {
    h := hmac.New(sha256.New, []byte(secret))
    h.Write(payload)
    expected := hex.EncodeToString(h.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expected))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-Webhook-Signature")
    timestamp := r.Header.Get("X-Webhook-Timestamp")
    eventType := r.Header.Get("X-Webhook-Event-Type")
    
    if signature == "" || timestamp == "" || eventType == "" {
        http.Error(w, "Missing headers", http.StatusBadRequest)
        return
    }
    
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Error reading body", http.StatusBadRequest)
        return
    }
    
    if !verifySignature(body, signature, webhookSecret) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }
    
    var payload map[string]interface{}
    if err := json.Unmarshal(body, &payload); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }
    
    log.Printf("Received %s: %v", eventType, payload)
    
    // Process webhook based on event type
    switch eventType {
    case "user.created":
        handleUserCreated(payload)
    case "order.completed":
        handleOrderCompleted(payload)
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func handleUserCreated(payload map[string]interface{}) {
    log.Println("New user:", payload)
}

func handleOrderCompleted(payload map[string]interface{}) {
    log.Println("Order completed:", payload)
}

func main() {
    http.HandleFunc("/webhook", webhookHandler)
    log.Fatal(http.ListenAndServe(":3000", nil))
}
```

## Ruby/Sinatra Receiver

```ruby
require 'sinatra'
require 'json'
require 'openssl'

SECRET = ENV['WEBHOOK_SECRET'] || 'your-webhook-secret'

def verify_signature(payload, signature, secret)
  expected = OpenSSL::HMAC.hexdigest('SHA256', secret, payload)
  Rack::Utils.secure_compare(signature, expected)
end

post '/webhook' do
  signature = request.env['HTTP_X_WEBHOOK_SIGNATURE']
  timestamp = request.env['HTTP_X_WEBHOOK_TIMESTAMP']
  event_type = request.env['HTTP_X_WEBHOOK_EVENT_TYPE']
  
  unless signature && timestamp && event_type
    status 400
    return { error: 'Missing headers' }.to_json
  end
  
  payload = request.body.read
  
  unless verify_signature(payload, signature, SECRET)
    status 401
    return { error: 'Invalid signature' }.to_json
  end
  
  data = JSON.parse(payload)
  
  puts "Received #{event_type}: #{data}"
  
  case event_type
  when 'user.created'
    handle_user_created(data)
  when 'order.completed'
    handle_order_completed(data)
  end
  
  content_type :json
  { success: true }.to_json
end

def handle_user_created(data)
  puts "New user: #{data}"
end

def handle_order_completed(data)
  puts "Order completed: #{data}"
end
```

## Testing Webhooks Locally

### Using ngrok

```bash
# Install ngrok
brew install ngrok

# Start your webhook receiver
npm run dev  # or python app.py, go run main.go, etc.

# Expose it with ngrok
ngrok http 3000

# Use the ngrok URL when registering the webhook endpoint
# Example: https://abc123.ngrok.io/webhook
```

### Using cURL

```bash
# Generate signature
SECRET="your-secret"
PAYLOAD='{"userId":"123","email":"test@example.com"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send test webhook
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -H "X-Webhook-Event-Type: user.created" \
  -d "$PAYLOAD"
```

### Testing Script

```bash
#!/bin/bash
# test-webhook.sh

SECRET="${WEBHOOK_SECRET:-your-secret}"
ENDPOINT="${WEBHOOK_ENDPOINT:-http://localhost:3000/webhook}"
EVENT_TYPE="${EVENT_TYPE:-test.event}"

PAYLOAD='{"test":"data","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -H "X-Webhook-Event-Type: $EVENT_TYPE" \
  -d "$PAYLOAD" \
  -v
```

## Security Best Practices

### 1. Verify Signatures

Always verify the HMAC signature before processing webhooks.

```typescript
// ❌ Bad: No verification
app.post('/webhook', async (req, res) => {
  const payload = req.body;
  await processWebhook(payload);
});

// ✅ Good: Verify signature
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const body = await req.text();
  
  if (!verifySignature(body, signature, SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  await processWebhook(JSON.parse(body));
});
```

### 2. Check Timestamp

Reject old webhooks to prevent replay attacks.

```typescript
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function isTimestampValid(timestamp: string): boolean {
  const webhookTime = new Date(timestamp).getTime();
  const now = Date.now();
  return Math.abs(now - webhookTime) < MAX_AGE_MS;
}
```

### 3. Use HTTPS

Always use HTTPS endpoints in production.

```typescript
// ✅ Good
const endpoint = 'https://api.example.com/webhook';

// ❌ Bad for production
const endpoint = 'http://api.example.com/webhook';
```

### 4. Idempotent Processing

Handle duplicate deliveries gracefully.

```typescript
async function processWebhook(payload: any) {
  const eventId = payload.id || payload.eventId;
  
  // Check if already processed
  const existing = await db.processedWebhooks.findUnique({
    where: { eventId },
  });
  
  if (existing) {
    console.log('Webhook already processed:', eventId);
    return;
  }
  
  // Process webhook
  await handleWebhookLogic(payload);
  
  // Mark as processed
  await db.processedWebhooks.create({
    data: { eventId, processedAt: new Date() },
  });
}
```

### 5. Error Handling

Return appropriate status codes for retries.

```typescript
app.post('/webhook', async (req, res) => {
  try {
    await processWebhook(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // 5xx = retry, 4xx = don't retry
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Processing failed' });
    }
  }
});
```

## Monitoring

```typescript
async function processWebhook(payload: any) {
  const startTime = Date.now();
  
  try {
    await handleWebhook(payload);
    
    const duration = Date.now() - startTime;
    console.log('[Webhook Success]', {
      eventType: payload.eventType,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Webhook Failed]', {
      eventType: payload.eventType,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}
```
