# Codebase Architecture Documentation

## Overview
This document provides a comprehensive mapping of the codebase architecture, including backend routes, controllers, frontend components, API calls, and database relationships.

---

## Backend Architecture

### Route Structure

#### 1. **Consumers Routes** (`backend/routes/consumers.routes.js`)
- **Base Path**: `/api/consumers`
- **Access**: Admin only (with permission checks)
- **Routes**:
  - `GET /` - Get all consumers (with filters: account_status, search, pagination)
  - `GET /:id` - Get consumer by ID
  - `PUT /:id` - Update consumer (requires `consumers.update` permission)
  - `DELETE /:id` - Delete consumer (requires `consumers.delete` permission)
  - `POST /:id/reset-password` - Reset consumer password
  - `PATCH /:id/account-status` - Update account status (requires `consumers.update` permission)
  - `POST /:id/grant-lifetime-access` - Grant lifetime access (requires `consumers.grant_lifetime_access` or `consumers.manage_lifetime_access`)
  - `POST /:id/revoke-lifetime-access` - Revoke lifetime access (requires `consumers.revoke_lifetime_access` or `consumers.manage_lifetime_access`)
  - `POST /:id/reassign` - Reassign consumer to different reseller (requires `consumers.reassign` permission)
  - `GET /:id/product-settings` - Get consumer product settings

#### 2. **Resellers Routes** (`backend/routes/resellers.routes.js`)
- **Base Path**: `/api/resellers`
- **Routes**:

  **Admin Routes**:
  - `GET /` - Get all resellers (admin only)
  - `GET /:id` - Get reseller by ID (admin only)
  - `POST /` - Create new reseller (admin only)
  - `PUT /:id` - Update reseller (admin only)
  - `DELETE /:id` - Delete reseller (admin only)
  - `POST /:id/reset-password` - Reset reseller password (admin only)
  - `PATCH /:id/account-status` - Update account status (admin only)
  - `GET /:id/referred-consumers` - Get consumers referred by reseller (admin only)
  - `GET /:id/commission` - Get reseller commission (admin only)
  - `PUT /:id/commission` - Set custom commission (admin only)
  - `DELETE /:id/commission` - Reset commission to default (admin only)
  - `POST /create-consumer` - Create consumer (admin only, legacy route)

  **Reseller's Own Consumers** (Reseller can manage their own consumers):
  - `GET /my-commission` - Get reseller's own commission
  - `GET /my-consumers` - Get all consumers created by logged-in reseller
  - `POST /my-consumers` - Create new consumer (referred by reseller)
  - `PUT /my-consumers/:id` - Update consumer created by reseller
  - `DELETE /my-consumers/:id` - Delete consumer created by reseller
  - `POST /my-consumers/:id/reset-password` - Reset consumer password

  **Reseller's Own Resellers** (Reseller can create other resellers):
  - `GET /my-resellers` - Get all resellers created by logged-in reseller
  - `POST /my-resellers` - Create new reseller
  - `GET /my-resellers/:id` - Get reseller by ID
  - `PUT /my-resellers/:id` - Update reseller
  - `DELETE /my-resellers/:id` - Delete reseller

  **Referred Resellers**:
  - `GET /referred-resellers` - Get all referred resellers (reseller and admin)

---

## Frontend Architecture

### API Client Structure (`front-end/src/services/apiClient.js`)

The frontend uses a centralized API client that:
- Automatically adds authentication tokens from Supabase
- Handles errors globally (including account deactivation)
- Uses axios interceptors for request/response handling

#### API Client Methods:

**Consumers API** (`apiClient.consumers.*`):
- `getAll(queryString)` → `GET /api/consumers?{queryString}`
- `getById(id)` → `GET /api/consumers/:id`
- `create(consumerData)` → `POST /api/consumers`
- `update(id, consumerData)` → `PUT /api/consumers/:id`
- `delete(id)` → `DELETE /api/consumers/:id`
- `resetPassword(id)` → `POST /api/consumers/:id/reset-password`
- `updateAccountStatus(id, status, trialDate, lifetimeAccess)` → `PATCH /api/consumers/:id/account-status`
- `grantLifetimeAccess(id)` → `POST /api/consumers/:id/grant-lifetime-access`
- `revokeLifetimeAccess(id, trialDays)` → `POST /api/consumers/:id/revoke-lifetime-access`
- `reassign(id, { reseller_id })` → `POST /api/consumers/:id/reassign`

**Resellers API** (`apiClient.resellers.*`):
- `getAll(queryString)` → `GET /api/resellers?{queryString}`
- `getById(id)` → `GET /api/resellers/:id`
- `create(resellerData)` → `POST /api/resellers`
- `update(id, resellerData)` → `PUT /api/resellers/:id`
- `delete(id)` → `DELETE /api/resellers/:id`
- `resetPassword(id)` → `POST /api/resellers/:id/reset-password`
- `updateAccountStatus(id, status)` → `PATCH /api/resellers/:id/account-status`
- `getReferredConsumers(id)` → `GET /api/resellers/:id/referred-consumers`
- `createConsumer(consumerData)` → `POST /api/resellers/create-consumer` (legacy)

**Reseller's Own Consumers**:
- `getMyConsumers()` → `GET /api/resellers/my-consumers`
- `createMyConsumer(consumerData)` → `POST /api/resellers/my-consumers`
- `updateMyConsumer(id, consumerData)` → `PUT /api/resellers/my-consumers/:id`
- `deleteMyConsumer(id)` → `DELETE /api/resellers/my-consumers/:id`
- `resetMyConsumerPassword(id)` → `POST /api/resellers/my-consumers/:id/reset-password`

**Reseller's Own Resellers**:
- `getMyResellers(queryString)` → `GET /api/resellers/my-resellers?{queryString}`
- `createMyReseller(resellerData)` → `POST /api/resellers/my-resellers`
- `getMyResellerById(id)` → `GET /api/resellers/my-resellers/:id`
- `updateMyReseller(id, resellerData)` → `PUT /api/resellers/my-resellers/:id`
- `deleteMyReseller(id)` → `DELETE /api/resellers/my-resellers/:id`

### Frontend API Wrappers

#### Consumers API (`front-end/src/api/backend/consumers.js`)
Wrapper functions that call `apiClient.consumers.*`:
- `getConsumers(filters)` - Calls `apiClient.consumers.getAll()`
- `getConsumerById(consumerId)` - Calls `apiClient.consumers.getById()`
- `createConsumer(consumerData)` - Calls `apiClient.resellers.createConsumer()` (uses reseller endpoint)
- `updateConsumer(consumerId, updateData)` - Calls `apiClient.consumers.update()`
- `deleteConsumer(consumerId)` - Calls `apiClient.consumers.delete()`
- `resetConsumerPassword(consumerId)` - Calls `apiClient.consumers.resetPassword()`
- `updateConsumerAccountStatus(...)` - Calls `apiClient.consumers.updateAccountStatus()`
- `grantLifetimeAccess(consumerId)` - Calls `apiClient.consumers.grantLifetimeAccess()`
- `revokeLifetimeAccess(consumerId, trialDays)` - Calls `apiClient.consumers.revokeLifetimeAccess()`
- `reassignConsumerToReseller(consumerId, resellerId)` - Calls `apiClient.consumers.reassign()`

#### Resellers API (`front-end/src/api/backend/resellers.js`)
Wrapper functions that call `apiClient.resellers.*`:
- `getResellers(filters)` - Calls `apiClient.resellers.getAll()`
- `getResellerById(resellerId)` - Calls `apiClient.resellers.getById()`
- `createReseller(resellerData)` - Calls `apiClient.resellers.create()`
- `updateReseller(resellerId, updateData)` - Calls `apiClient.resellers.update()`
- `deleteReseller(resellerId)` - Calls `apiClient.resellers.delete()`
- `resetResellerPassword(resellerId)` - Calls `apiClient.resellers.resetPassword()`
- `updateResellerAccountStatus(resellerId, status)` - Calls `apiClient.resellers.updateAccountStatus()`
- `getMyResellers(search)` - Calls `apiClient.resellers.getMyResellers()`
- `createMyReseller(resellerData)` - Calls `apiClient.resellers.createMyReseller()`
- `updateMyReseller(resellerId, updateData)` - Calls `apiClient.resellers.updateMyReseller()`
- `deleteMyReseller(resellerId)` - Calls `apiClient.resellers.deleteMyReseller()`

### Frontend Components → API Mapping

#### Admin Components:

**Consumers.js** (`front-end/src/views/Consumers.js`):
- Uses: `getConsumers()`, `createConsumer()`, `updateConsumer()`, `deleteConsumer()`, `resetConsumerPassword()`, `updateConsumerAccountStatus()`
- Calls: `/api/consumers` (via `apiClient.consumers.*`)
- Permissions: Checks `consumers.view`, `consumers.create`, `consumers.update`, `consumers.delete`, `consumers.read`

**Resellers.js** (`front-end/src/views/Resellers.js`):
- Uses: `getResellers()`, `createReseller()`, `updateReseller()`, `deleteReseller()`, `resetResellerPassword()`, `updateResellerAccountStatus()`
- Calls: `/api/resellers` (via `apiClient.resellers.*`)
- Permissions: Checks `resellers.view`, `resellers.create`, `resellers.update`, `resellers.delete`, `resellers.read`
- Special: Hover to show referred consumers via `apiClient.resellers.getReferredConsumers()`

#### Reseller Components:

**ResellerConsumers.js** (`front-end/src/views/ResellerConsumers.js`):
- Uses: `apiClient.resellers.getMyConsumers()` directly
- Calls: `GET /api/resellers/my-consumers`
- Access: Only resellers can see their own consumers

---

## Database Structure

### Key Tables:

1. **profiles** - Main user profile table
   - `user_id` (UUID, primary key)
   - `full_name`, `email`, `phone`, `country`, `city`
   - `role` (TEXT[] - array of roles: 'admin', 'reseller', 'consumer')
   - `referred_by` (UUID, foreign key to profiles.user_id)
   - `account_status` ('active', 'deactive', 'expired_subscription')
   - `trial_expiry` (timestamp)
   - `lifetime_access` (boolean)
   - `commission_rate` (decimal, nullable - custom commission)
   - `commission_updated_at` (timestamp)
   - `subscribed_packages` (UUID[] - array of package IDs)

2. **user_product_access** - Product access for consumers
   - `user_id` (UUID, foreign key)
   - `product_id` (UUID, foreign key)
   - `product_settings` (JSONB - product-specific settings like vapi_account, agent_number, etc.)

3. **user_package_access** - Package access for consumers
   - `user_id` (UUID, foreign key)
   - `package_id` (UUID, foreign key)

4. **auth_role_with_profiles** - Database view
   - Combines auth.users and profiles
   - Exposes role as TEXT[] array
   - Used for queries that need role filtering

### Relationships:

- **Reseller → Consumers**: One-to-many via `profiles.referred_by`
- **Reseller → Resellers**: One-to-many via `profiles.referred_by` (resellers can create other resellers)
- **Consumer → Products**: Many-to-many via `user_product_access`
- **Consumer → Packages**: Many-to-many via `user_package_access` and `profiles.subscribed_packages`

---

## Authentication & Authorization Flow

### Backend Middleware (`backend/middleware/auth.js`):

1. **authenticate** - Verifies JWT token from Supabase
   - Extracts token from `Authorization: Bearer <token>` header
   - Verifies with Supabase (no caching - always fresh)
   - Attaches `req.user` (from Supabase auth)

2. **requireAdmin** - Checks if user has admin role
   - Fetches fresh role from `auth_role_with_profiles` view
   - Checks if role array includes 'admin' OR `is_systemadmin === true`
   - Attaches `req.userProfile` with profile data

3. **requireRole(allowedRoles)** - Checks if user has any of the allowed roles
   - Fetches fresh role from database
   - Checks if role array includes any of the allowed roles
   - Also checks account_status for resellers/consumers

4. **loadUserProfile** - Loads user profile data
   - Fetches from `auth_role_with_profiles` view
   - Attaches `req.userProfile` to request

### Permission System:

- Permissions are checked via `backend/middleware/permissions.js`
- Uses `requirePermission(permissionName)` middleware
- Permissions stored in database and checked via RPC functions
- Frontend uses `usePermissions()` hook to check permissions client-side

---

## Key Data Flows

### Creating a Consumer (Admin):

1. Frontend: `Consumers.js` → `createConsumer()` → `apiClient.resellers.createConsumer()`
2. Backend: `POST /api/resellers/create-consumer` → `createConsumerAdmin()` controller
3. Controller:
   - Validates input
   - Creates user in Supabase Auth
   - Creates profile in `profiles` table
   - Stores product access in `user_product_access` (if provided)
   - Stores package access in `user_package_access` and `profiles.subscribed_packages` (if provided)
   - Sends welcome email
   - Logs activity
   - Invalidates cache

### Creating a Consumer (Reseller):

1. Frontend: `ResellerConsumers.js` → `apiClient.resellers.createMyConsumer()`
2. Backend: `POST /api/resellers/my-consumers` → `createMyConsumer()` controller
3. Controller:
   - Validates input
   - Checks max consumers limit (if configured)
   - Creates user in Supabase Auth
   - Creates profile with `referred_by = resellerId`
   - Stores product/package access
   - Sends welcome email
   - Logs activity

### Updating Consumer:

1. Frontend: `Consumers.js` → `updateConsumer()` → `apiClient.consumers.update()`
2. Backend: `PUT /api/consumers/:id` → `updateConsumer()` controller
3. Controller:
   - Validates UUID and input
   - Updates `profiles` table
   - Updates `user_product_access` (if subscribed_products provided)
   - Updates `user_package_access` and `profiles.subscribed_packages` (if subscribed_packages provided)
   - Updates roles (if provided)
   - Sends trial expiry change email (if changed)
   - Logs activity with changed fields
   - Invalidates cache

### Getting Consumers List:

1. Frontend: `Consumers.js` → `getConsumers()` → `apiClient.consumers.getAll()`
2. Backend: `GET /api/consumers?account_status=active&search=john` → `getAllConsumers()` controller
3. Controller:
   - Validates and sanitizes search input
   - Checks Redis cache
   - Queries `auth_role_with_profiles` view with filters
   - Fetches product access for each consumer
   - Returns paginated response
   - Caches result in Redis

---

## Important Notes

1. **Role Storage**: Roles are stored as TEXT[] arrays in the database. The `auth_role_with_profiles` view properly exposes this.

2. **Consumer Creation**: Admin creates consumers via `/api/resellers/create-consumer` (legacy route) or can use `/api/consumers` (if implemented). Resellers create via `/api/resellers/my-consumers`.

3. **Product vs Package Access**:
   - Products: Stored in `user_product_access` table with optional `product_settings` JSONB
   - Packages: Stored in both `user_package_access` table AND `profiles.subscribed_packages` array

4. **Commission System**:
   - Default commission stored in `app_settings` table
   - Custom commission stored in `profiles.commission_rate`
   - Effective commission = custom_commission || default_commission

5. **Caching**: Redis is used for caching consumer/reseller lists. Cache is invalidated on create/update/delete operations.

6. **Permissions**: Frontend checks permissions using `usePermissions()` hook which fetches permissions once and caches them. Backend checks permissions on each request via middleware.

7. **Account Status**: 
   - 'active' - Account is active
   - 'deactive' - Account is deactivated
   - 'expired_subscription' - Trial/subscription expired

8. **Lifetime Access**: Consumers can have `lifetime_access = true` which overrides trial expiry.

---

## File Structure Summary

### Backend:
- `backend/routes/consumers.routes.js` - Consumer routes
- `backend/routes/resellers.routes.js` - Reseller routes
- `backend/routes/controllers/consumers.controller.js` - Consumer controller logic
- `backend/routes/controllers/resellers.controller.js` - Reseller controller logic
- `backend/middleware/auth.js` - Authentication middleware
- `backend/middleware/permissions.js` - Permission checking middleware

### Frontend:
- `front-end/src/services/apiClient.js` - Centralized API client
- `front-end/src/api/backend/consumers.js` - Consumer API wrappers
- `front-end/src/api/backend/resellers.js` - Reseller API wrappers
- `front-end/src/views/Consumers.js` - Admin consumers management page
- `front-end/src/views/Resellers.js` - Admin resellers management page
- `front-end/src/views/ResellerConsumers.js` - Reseller's own consumers page
- `front-end/src/hooks/usePermissions.js` - Permission checking hook

---

This architecture ensures:
- Clear separation between admin and reseller operations
- Proper permission checking at both frontend and backend
- Efficient caching and database queries
- Comprehensive activity logging
- Secure authentication and authorization

