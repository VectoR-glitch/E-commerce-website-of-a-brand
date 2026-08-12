# E-commerce Website of a Brand

A full-stack e-commerce platform built for a direct-to-consumer retail brand — covering the complete customer journey from product discovery to post-purchase support, backed by a full internal admin console for day-to-day operations.

> Client/brand identifying details have been anonymized for portfolio purposes; the codebase and history are unmodified otherwise.

## Highlights

**Storefront**
- Product catalog, bundles/kits, cart, and checkout
- Wishlist, subscriptions, and a loyalty/rewards program
- Public order tracking via shareable tracking links
- Account area with registration, login, password reset, and security settings
- Blog, coupons, and promotional offers

**Payments & documents**
- Live payment processing via Razorpay
- Server-rendered PDF invoice generation

**Admin console**
- Product, inventory, and stock management
- Order management and fulfillment
- Customer management
- Coupon and bundle configuration
- Blog CMS
- Product Q&A and review moderation
- Analytics dashboard

## Tech stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Payments**: Razorpay
- **Email**: Resend
- **Hosting**: Vercel

## Architecture notes

- Server Components and Server Actions throughout, with `server-only` guards on privileged code paths
- PDF invoices generated on the server with `@react-pdf/renderer`, matching the same pricing/GST logic used at checkout
- Prisma with a dedicated Postgres adapter for connection handling in serverless environments
