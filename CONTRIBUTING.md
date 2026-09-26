# Contributing Guide

Thank you for considering contributing to the Job Queue + Webhook Outbox Kit! This guide will help you get started.

## Development Setup

1. **Fork and Clone**

```bash
git clone https://github.com/yourusername/job-queue-webhook-outbox-kit.git
cd job-queue-webhook-outbox-kit
```

2. **Install Dependencies**

```bash
npm install
```

3. **Set Up Database**

Create a free Neon Postgres database at https://neon.tech or use a local Postgres instance.

```bash
cp .env.example .env
# Edit .env with your database credentials
npm run db:push
```

4. **Start Development Server**

```bash
npm run dev
```

Visit http://localhost:3000

## Project Structure

```
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── health/          # Health check endpoint
│   │   ├── jobs/            # Job queue endpoints
│   │   ├── webhooks/        # Webhook management
│   │   ├── worker/          # Worker/cron endpoint
│   │   └── demo/            # Demo receiver
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Homepage/demo UI
├── lib/                     # Core library code
│   ├── db.ts               # Prisma client singleton
│   ├── crypto.ts           # Webhook signatures
│   ├── queue.ts            # Job queue logic
│   └── webhook.ts          # Webhook outbox logic
├── prisma/
│   └── schema.prisma       # Database schema
└── ...
```

## Code Style

- **TypeScript**: Strict mode enabled, no `any` types unless documented
- **Formatting**: Use Prettier (will auto-format on save if configured)
- **Linting**: Run `npm run lint` before committing
- **Naming**: Descriptive variable/function names, camelCase for JS/TS

## Making Changes

### Adding a New Job Type

1. Add processing logic in `/app/api/worker/tick/route.ts`:

```typescript
async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'my_new_job':
      // Your processing logic here
      await myCustomProcessor(job.payload);
      break;
    // ... existing cases
  }
}
```

2. Document the new job type in README.md

### Adding a New API Endpoint

1. Create a new route in `/app/api/`
2. Use consistent error handling patterns
3. Add TypeScript types for request/response
4. Document in README.md API section

### Modifying the Schema

1. Edit `prisma/schema.prisma`
2. Test locally with `npm run db:push`
3. Document breaking changes clearly in PR description

## Testing

Currently, the project uses manual testing via the demo UI. When adding tests:

```bash
# Run type checks
npx tsc --noEmit

# Run lint
npm run lint

# Test build
npm run build
```

## Pull Request Process

1. **Create a Feature Branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make Your Changes**

- Write clean, self-documenting code
- Add comments for complex logic
- Update documentation if needed

3. **Test Locally**

- Run `npm run build` to ensure it builds
- Test the demo UI workflow end-to-end
- Verify API endpoints work as expected

4. **Commit**

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add email notification job type"
git commit -m "fix: webhook signature verification for empty payloads"
git commit -m "docs: update deployment guide with Railway instructions"
```

Commit message prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

5. **Push and Create PR**

```bash
git push origin feature/your-feature-name
```

Create a pull request on GitHub with:
- Clear title describing the change
- Detailed description of what and why
- Screenshots for UI changes
- Any breaking changes highlighted

## Areas for Contribution

### High Priority

- [ ] Unit tests for core library functions
- [ ] Integration tests for API endpoints
- [ ] Support for more database providers (MySQL, SQLite)
- [ ] Admin dashboard for monitoring queue/outbox
- [ ] Webhook endpoint verification (challenge-response)

### Nice to Have

- [ ] Webhook retry strategies (linear, custom)
- [ ] Job scheduling (cron expressions)
- [ ] Job dependencies and workflows
- [ ] Webhook event filtering
- [ ] Rate limiting per endpoint
- [ ] Circuit breaker for failing endpoints
- [ ] Metrics and observability hooks

### Documentation

- [ ] Video walkthrough/tutorial
- [ ] More example job types
- [ ] Deployment guides for other platforms (Railway, Fly.io, etc.)
- [ ] Architecture deep-dive blog post
- [ ] API client libraries

## Code Review Guidelines

When reviewing PRs:

1. **Functionality**: Does it work as intended?
2. **Code Quality**: Is it clean, readable, maintainable?
3. **TypeScript**: Are types properly defined?
4. **Performance**: Any obvious performance issues?
5. **Security**: Any security concerns?
6. **Documentation**: Is it documented if needed?

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue with reproduction steps
- **Security**: Email security@example.com (do not open public issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
