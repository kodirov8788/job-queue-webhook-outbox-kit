#!/bin/bash
# Verification script for Job Queue + Webhook Outbox Kit

set -e

echo "🔍 Verifying Job Queue + Webhook Outbox Kit..."
echo ""

# Check Node version
echo "📦 Checking Node.js version..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found v$node_version)"
  exit 1
fi
echo "✅ Node.js $(node -v)"
echo ""

# Check dependencies
echo "📚 Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "❌ Dependencies not installed. Run: npm install"
  exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Check Prisma client
echo "🗄️  Checking Prisma client..."
if [ ! -d "node_modules/.prisma" ]; then
  echo "⚠️  Prisma client not generated. Run: npx prisma generate"
  npx prisma generate
fi
echo "✅ Prisma client ready"
echo ""

# Type check
echo "🔤 Running TypeScript type check..."
npx tsc --noEmit
echo "✅ No type errors"
echo ""

# Lint check
echo "🧹 Running ESLint..."
npm run lint
echo "✅ Lint passed"
echo ""

# Build check
echo "🏗️  Building application..."
npm run build > /dev/null 2>&1
echo "✅ Build successful"
echo ""

# Check required files
echo "📄 Checking required files..."
required_files=(
  "README.md"
  "DEPLOYMENT.md"
  "CONTRIBUTING.md"
  "PROJECT_STRUCTURE.md"
  ".env.example"
  "prisma/schema.prisma"
  "vercel.json"
  "app/api/health/route.ts"
  "app/api/jobs/route.ts"
  "app/api/webhooks/endpoints/route.ts"
  "app/api/webhooks/outbox/route.ts"
  "app/api/worker/tick/route.ts"
  "app/api/demo/receiver/route.ts"
  "app/page.tsx"
  "lib/db.ts"
  "lib/queue.ts"
  "lib/webhook.ts"
  "lib/crypto.ts"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
    exit 1
  fi
done
echo "✅ All required files present"
echo ""

# Check environment example
echo "🔐 Checking environment template..."
if ! grep -q "DATABASE_URL" .env.example; then
  echo "❌ DATABASE_URL missing in .env.example"
  exit 1
fi
if ! grep -q "WEBHOOK_SIGNING_SECRET" .env.example; then
  echo "❌ WEBHOOK_SIGNING_SECRET missing in .env.example"
  exit 1
fi
if ! grep -q "CRON_SECRET" .env.example; then
  echo "❌ CRON_SECRET missing in .env.example"
  exit 1
fi
echo "✅ Environment template valid"
echo ""

# Check Prisma schema models
echo "📊 Checking Prisma schema..."
if ! grep -q "model Job" prisma/schema.prisma; then
  echo "❌ Job model missing in schema"
  exit 1
fi
if ! grep -q "model WebhookEndpoint" prisma/schema.prisma; then
  echo "❌ WebhookEndpoint model missing in schema"
  exit 1
fi
if ! grep -q "model WebhookOutbox" prisma/schema.prisma; then
  echo "❌ WebhookOutbox model missing in schema"
  exit 1
fi
echo "✅ Prisma schema valid"
echo ""

# Check vercel.json cron
echo "⏰ Checking Vercel cron configuration..."
if ! grep -q "crons" vercel.json; then
  echo "❌ Cron configuration missing in vercel.json"
  exit 1
fi
echo "✅ Vercel cron configured"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ All checks passed! Project is ready for deployment."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Next steps:"
echo "   1. Copy .env.example to .env and add your credentials"
echo "   2. Run: npm run db:push"
echo "   3. Run: npm run dev"
echo "   4. Visit: http://localhost:3000"
echo ""
echo "🚀 For production deployment, see DEPLOYMENT.md"
echo ""
