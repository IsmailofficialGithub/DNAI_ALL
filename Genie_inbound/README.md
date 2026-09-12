# Genie Inbound

## What this product does (for everyone)

Genie Inbound is a smart customer interaction system that helps businesses manage incoming calls, emails, documents, and payments in one place.

If you are not a developer, think of it as a digital assistant that:
- answers questions and processes requests automatically,
- sends follow-up emails and payment receipts,
- stores important information in a secure database,
- and helps agents work faster by automating routine communication.

This product is built to make everyday customer service easier and faster for non-technical users.

## What it is technically

Genie Inbound is a full-stack web application with:
- a React + TypeScript frontend for the user interface,
- a Node.js backend for handling API requests,
- Supabase for database and authentication support,
- Stripe integration for payment processing,
- email sending capabilities using SendGrid or similar services,
- and AI-powered features for automated responses and document extraction.

The repository contains:
- `src/` — frontend React application code,
- `backend/` — server logic, routing, email/payment services, and webhook support,
- `public/` and `build/` — frontend static assets and production build output,
- `api/` — serverless or helper email send logic,
- `supabase/` and `migration/` — database schema and migration scripts.

## Key features

- Inbound call and message handling
- Automated AI email responses
- Document extraction and processing
- Payment workflow support with Stripe
- Agent and conversation management UI
- Template-based emails and notifications

## Getting started

1. Install dependencies:
   ```powershell
   npm install
   cd backend
   npm install
   ```

2. Run the frontend:
   ```powershell
   npm start
   ```

3. Run the backend server:
   ```powershell
   cd backend
   npm start
   ```

4. Configure environment variables for Supabase, Stripe, and email provider credentials in your `.env` files.

## Folder structure

- `src/` — React components, hooks, services, and UI
- `backend/` — API controllers, services, routes, and server setup
- `public/` — static frontend files
- `build/` — generated production frontend output
- `migration/` — SQL schema and migration scripts
- `supabase/` — Supabase project migrations and helpers

## Notes

- The app mixes frontend and backend code in a single repository for easy local development.
- Use `craco` for frontend build and environment configuration.
- Backend APIs support calls, documents, leads, payments, and email workflows.

## License

This repository does not include a license file by default. Add one if you want to publish or share with a team.
