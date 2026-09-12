# Admin Panel Documentation

Complete documentation of all components, pages, buttons, sidebar items, and APIs in the `/admin` section.

---

## 📋 Table of Contents

1. [Sidebar Navigation](#sidebar-navigation)
2. [Pages & Components](#pages--components)
3. [Hidden Routes](#hidden-routes)
4. [Buttons & Actions](#buttons--actions)
5. [API Endpoints](#api-endpoints)
6. [Components Used](#components-used)

---

## 🗂️ Sidebar Navigation

The sidebar displays the following menu items (in order):

| Icon | Name | Route | Component | Notes |
|------|------|-------|-----------|-------|
| 📊 | Dashboard | `/admin/dashboard` | `Dashboard.js` | Main dashboard with statistics |
| 👤 | Users | `/admin/users` | `Users.js` | Admin user management |
| 👥 | Consumers | `/admin/consumers` | `Consumers.js` | Consumer management with submenus |
| 💡 | Resellers | `/admin/resellers` | `Resellers.js` | Reseller management |
| 📝 | Products | `/admin/products` | `Products.js` | Product management |
| 📄 | Invoices | `/admin/invoices` | `Invoices.js` | Invoice management |
| 🏷️ | Offers | `/admin/offers` | `Offers.js` | Offer management |
| 📊 | Activity Logs | `/admin/activity-logs` | `ActivityLogs.js` | System activity tracking |
| 🎧 | Customer Support | `/admin/customers` | `Customers.js` | Support ticket management |
| ⚙️ | Settings | `/admin/settings` | `AdminSettings.js` | System settings |
| 🔑 | Permissions | `/admin/permissions` | `Permissions.js` | **System Admin Only** |

### Consumers Submenus
- Active Consumers (`/admin/consumers?status=active`)
- Deactive Consumers (`/admin/consumers?status=deactive`)
- Expired Subscription (`/admin/consumers?status=expired_subscription`)

---

## 📄 Pages & Components

### 1. Dashboard (`/admin/dashboard`)
**Component:** `Dashboard.js`

**Features:**
- Statistics cards (users, consumers, resellers, revenue)
- Charts and graphs
- Quick access links
- Recent activity summary

**Buttons:**
- View Statistics (links to detailed pages)

---

### 2. Users (`/admin/users`)
**Component:** `Users.js`

**Features:**
- User list with pagination (20 per page)
- Search functionality
- Filter by role
- User management actions

**Buttons:**
- ➕ **Create User** (header button)
- 🔍 **Search** (search input)
- ⋮ **Actions Menu** (per user):
  - 👁️ View Details
  - ✏️ Update
  - 🔑 Reset Password
  - 👤 Activate/Deactivate Account
  - 🗑️ Delete

**Actions:**
- `View Details` → Navigate to `/admin/users/:id`
- `Update` → Open update modal
- `Reset Password` → Send password reset email
- `Deactivate Account` → Change account status
- `Delete` → Delete user (with confirmation)

---

### 3. Consumers (`/admin/consumers`)
**Component:** `Consumers.js`

**Features:**
- Consumer list with pagination (20 per page)
- Search by name/email
- Filter by status (Active, Deactive, Expired Subscription)
- Consumer management actions
- Trial expiry management

**Buttons:**
- ➕ **Create Consumer** (header button)
- 🔍 **Search** (search input)
- 🧹 **Clear Filters** (filter reset)
- ⋮ **Actions Menu** (per consumer):
  - 👁️ View Details
  - ✏️ Update
  - 🔄 Update Status
  - 🔑 Reset Password
  - 📄 Create Invoice
  - 📅 Extend Trial
  - ♾️ Grant Lifetime Access
  - 🗑️ Delete

**Actions:**
- `View Details` → Navigate to `/admin/consumers/:id`
- `Update` → Open update modal
- `Update Status` → Change account status (active/deactive/expired)
- `Reset Password` → Send password reset email
- `Create Invoice` → Open invoice creation modal
- `Extend Trial` → Extend trial period (max 7 days from creation)
- `Grant Lifetime Access` → Grant unlimited access (sets `lifetime_access = true`)
- `Delete` → Delete consumer (with confirmation)

**Status Badges:**
- 🟢 Active
- 🔴 Deactive
- ⚠️ Expired Subscription
- 🟣 Lifetime Access

---

### 4. Resellers (`/admin/resellers`)
**Component:** `Resellers.js`

**Features:**
- Reseller list with pagination (20 per page)
- Search functionality
- Commission display
- Consumer count per reseller
- Hover tooltip for consumer details

**Buttons:**
- ➕ **Create Reseller** (header button)
- 🔍 **Search** (search input)
- 👥 **Consumer Count** (clickable badge, shows tooltip on hover)
- ⋮ **Actions Menu** (per reseller):
  - 👁️ View Details
  - ✏️ Update
  - 🔑 Reset Password
  - 👤 Activate/Deactivate Account
  - 🗑️ Delete

**Actions:**
- `View Details` → Navigate to `/admin/reseller/:id`
- `Update` → Open update modal
- `Reset Password` → Send password reset email
- `Deactivate Account` → Change account status
- `Delete` → Delete reseller (with confirmation)

---

### 5. Products (`/admin/products`)
**Component:** `Products.js`

**Features:**
- Product list
- Product management
- Product details

**Buttons:**
- ➕ **Create Product**
- ✏️ **Edit Product**
- 🗑️ **Delete Product**
- 👁️ **View Details**

---

### 6. Invoices (`/admin/invoices`)
**Component:** `Invoices.js`

**Features:**
- Invoice list
- Invoice management
- Payment tracking

**Buttons:**
- ➕ **Create Invoice**
- 👁️ **View Invoice**
- 💳 **View Payments** (navigate to `/admin/invoices/:invoiceId/payments`)

---

### 7. Offers (`/admin/offers`)
**Component:** `Offers.js`

**Features:**
- Offer list
- Offer management
- Offer creation and editing

**Buttons:**
- ➕ **Create Offer**
- ✏️ **Edit Offer**
- 🗑️ **Delete Offer**

---

### 8. Activity Logs (`/admin/activity-logs`)
**Component:** `ActivityLogs.js`

**Features:**
- Activity log list
- Filter by action type
- Search functionality
- Detailed log view

**Buttons:**
- 🔍 **Search**
- 👁️ **View Details** (navigate to `/admin/activity-logs/:id`)

---

### 9. Customer Support (`/admin/customers`)
**Component:** `Customers.js`

**Features:**
- Support ticket list
- Ticket status management
- Message threads
- Ticket assignment

**Buttons:**
- ➕ **Create Ticket**
- 👁️ **View Ticket**
- 💬 **Add Message**
- 🔄 **Update Status**
- 📎 **Attach File**

---

### 10. Settings (`/admin/settings`)
**Component:** `AdminSettings.js`

**Features:**
- Multiple settings tabs:
  - **General** (Basic settings)
  - **Email** (Email configuration)
  - **Server** (Server settings)
  - **Security** (Security settings)
  - **Notifications** (Notification preferences)
  - **Features** (Feature toggles)
  - **Product Databases** (Database connections)

**Buttons:**
- 💾 **Save Settings** (per tab)
- 🔄 **Test Connection** (for databases)
- ➕ **Add Database**
- ✏️ **Edit Database**
- 🗑️ **Delete Database**

---

### 11. Permissions (`/admin/permissions`)
**Component:** `Permissions.js`
**Access:** System Admin Only (`is_systemadmin = true`)

**Features:**
- 4 main tabs:
  1. **All Permissions** - View all system permissions (with pagination - 50 per page)
  2. **Role Permissions** - Manage permissions per role (with pagination - 20 per page)
  3. **User Permissions** - Manage permissions per user (with pagination - 20 per page)
  4. **System Admins** - Manage system administrators

**Buttons:**
- 🔍 **Search Permissions**
- 🔽 **Filter by Resource**
- 🔽 **Filter by Action**
- 🧹 **Clear Filters**
- ✅ **Save Changes** (Role/User permissions)
- ➕ **Assign Permissions**
- ➖ **Remove Permissions**
- 🔑 **Set System Admin**

**Pagination:**
- All Permissions: 50 per page
- Role Permissions: 20 per page
- User Permissions: 20 per page

---

## 🔗 Hidden Routes

These routes are not shown in the sidebar but are accessible via navigation:

| Route | Component | Access Method |
|-------|-----------|---------------|
| `/admin/reseller/:id` | `ResellerDetail.js` | Click "View Details" on reseller |
| `/admin/reseller/:id/earnings` | `ResellerEarningsBreakdown.js` | From reseller detail page |
| `/admin/users/:id` | `UserDetail.js` | Click "View Details" on user |
| `/admin/consumers/:id` | `ConsumerDetail.js` | Click "View Details" on consumer |
| `/admin/product/:id` | `ProductDetail.js` | Click "View Details" on product |
| `/admin/invoices/:invoiceId/payments` | `InvoicePaymentDetail.js` | From invoice page |
| `/admin/activity-logs/:id` | `ActivityLogDetail.js` | Click on activity log |
| `/admin/logs/:id` | `ActivityLogDetail.js` | Alternative route for activity log |
| `/admin/account` | `Account.js` | User account settings |
| `/admin/reseller-statistics` | `ResellerStatistics.js` | From dashboard |

---

## 🔘 Buttons & Actions Summary

### Common Actions Across Pages

| Action | Icon | Description | Used In |
|--------|------|-------------|---------|
| Create | ➕ | Create new record | Users, Consumers, Resellers, Products, Invoices, Offers |
| View Details | 👁️ | View full details | Users, Consumers, Resellers, Products, Invoices, Activity Logs |
| Update/Edit | ✏️ | Edit record | Users, Consumers, Resellers, Products, Offers |
| Delete | 🗑️ | Delete record | Users, Consumers, Resellers, Products, Offers |
| Reset Password | 🔑 | Reset user password | Users, Consumers, Resellers |
| Activate/Deactivate | 👤 | Change account status | Users, Consumers, Resellers |
| Search | 🔍 | Search records | All list pages |
| Clear Filters | 🧹 | Reset all filters | Consumers, Permissions |
| Save | 💾 | Save changes | Settings, Permissions |
| Previous/Next | ⬅️➡️ | Pagination | All paginated pages |

### Page-Specific Actions

**Consumers:**
- 📄 Create Invoice
- 📅 Extend Trial
- ♾️ Grant Lifetime Access
- 🔄 Update Status

**Resellers:**
- 👥 View Consumers (hover tooltip)

**Invoices:**
- 💳 View Payments

**Activity Logs:**
- 📊 View Details

**Customer Support:**
- 💬 Add Message
- 📎 Attach File
- 🔄 Update Status

**Permissions:**
- ✅ Assign Permissions
- ➖ Remove Permissions
- 🔑 Set System Admin

**Settings:**
- 🔄 Test Connection
- ➕ Add Database

---

## 🌐 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | User login |
| POST | `/api/auth/logout` | Private | User logout |
| GET | `/api/auth/me` | Private | Get current user info |

### Users (`/api/users`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/users` | Admin | Get all admin users (with search) |
| GET | `/api/users/:id` | Admin | Get user by ID |
| POST | `/api/users` | Admin | Create new user |
| PUT | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Delete user |
| POST | `/api/users/:id/reset-password` | Admin | Reset user password |
| PATCH | `/api/users/:id/account-status` | Admin | Update account status |

### Consumers (`/api/consumers`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/consumers` | Admin | Get all consumers (with filters) |
| GET | `/api/consumers/:id` | Admin | Get consumer by ID |
| PUT | `/api/consumers/:id` | Admin | Update consumer |
| DELETE | `/api/consumers/:id` | Admin | Delete consumer |
| POST | `/api/consumers/:id/reset-password` | Admin | Reset consumer password |
| PATCH | `/api/consumers/:id/account-status` | Admin | Update account status (supports `lifetime_access`) |

### Resellers (`/api/resellers`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/resellers` | Admin | Get all resellers (with search) |
| GET | `/api/resellers/:id` | Admin | Get reseller by ID |
| POST | `/api/resellers` | Admin | Create reseller |
| PUT | `/api/resellers/:id` | Admin | Update reseller |
| DELETE | `/api/resellers/:id` | Admin | Delete reseller |
| POST | `/api/resellers/:id/reset-password` | Admin | Reset reseller password |
| PATCH | `/api/resellers/:id/account-status` | Admin | Update account status |
| GET | `/api/resellers/:id/referred-consumers` | Admin | Get reseller's consumers |
| GET | `/api/resellers/:id/commission` | Admin | Get reseller commission |
| POST | `/api/resellers/:id/commission` | Admin | Set reseller commission |
| POST | `/api/resellers/:id/commission/reset` | Admin | Reset reseller commission |
| POST | `/api/resellers/create-consumer` | Admin | Create consumer via reseller endpoint |

### Products (`/api/products`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/products` | Admin | Get all products |
| GET | `/api/products/:id` | Admin | Get product by ID |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |

### Invoices (`/api/invoices`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/invoices` | Admin | Get all invoices |
| GET | `/api/invoices/:id` | Admin | Get invoice by ID |
| POST | `/api/invoices` | Admin | Create invoice |
| GET | `/api/invoices/:id/payments` | Admin | Get invoice payments |
| GET | `/api/consumers/:id/products` | Admin | Get consumer products for invoice |

### Offers (`/api/offers`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/offers` | Admin | Get all offers |
| GET | `/api/offers/:id` | Admin | Get offer by ID |
| POST | `/api/offers` | Admin | Create offer |
| PUT | `/api/offers/:id` | Admin | Update offer |
| DELETE | `/api/offers/:id` | Admin | Delete offer |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/dashboard/stats` | Admin | Get dashboard statistics |
| GET | `/api/dashboard/reseller-stats` | Admin | Get reseller statistics |

### Activity Logs (`/api/activity-logs`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/activity-logs` | Admin | Get all activity logs (with filters) |
| GET | `/api/activity-logs/:id` | Admin | Get activity log by ID |

### Settings (`/api/settings`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/settings/default-commission` | Admin | Get default commission |
| PUT | `/api/settings/default-commission` | Admin | Update default commission |
| GET | `/api/settings/reseller/:id` | Admin | Get reseller settings |
| PUT | `/api/settings/reseller/:id` | Admin | Update reseller settings |

### Permissions (`/api/permissions`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/permissions` | Private | Get all permissions (with filters) |
| GET | `/api/permissions/:id` | Private | Get permission by ID |
| GET | `/api/permissions/me` | Private | Get current user permissions |
| GET | `/api/permissions/user/:userId` | Private | Get user permissions |
| GET | `/api/permissions/role/:role` | Private | Get role permissions |
| GET | `/api/permissions/check/:userId/:permissionName` | Private | Check user permission |
| POST | `/api/permissions/role/:role/assign` | SystemAdmin | Assign permissions to role |
| DELETE | `/api/permissions/role/:role/remove` | SystemAdmin | Remove permissions from role |
| POST | `/api/permissions/user/:userId/assign` | SystemAdmin | Assign permissions to user |
| DELETE | `/api/permissions/user/:userId/remove` | SystemAdmin | Remove permissions from user |
| PATCH | `/api/permissions/user/:userId/systemadmin` | SystemAdmin | Set system admin status |
| GET | `/api/permissions/users` | SystemAdmin | Get all users for permissions |

### Customer Support (`/api/customer-support`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/customer-support/tickets` | Private | Get all tickets |
| GET | `/api/customer-support/tickets/:id` | Private | Get ticket by ID |
| POST | `/api/customer-support/tickets` | Private | Create ticket |
| PATCH | `/api/customer-support/tickets/:id/status` | Private | Update ticket status |
| POST | `/api/customer-support/tickets/:id/messages` | Private | Add message to ticket |
| GET | `/api/customer-support/tickets/stats` | Admin | Get ticket statistics |

### Product Databases (`/api/admin/product-databases`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/admin/product-databases` | Admin | Get all product databases |
| GET | `/api/admin/product-databases/:id` | Admin | Get database by ID |
| POST | `/api/admin/product-databases` | Admin | Create database connection |
| PUT | `/api/admin/product-databases/:id` | Admin | Update database |
| DELETE | `/api/admin/product-databases/:id` | Admin | Delete database |
| POST | `/api/admin/product-databases/:id/test` | Admin | Test database connection |

### Product Details (`/api/admin/products`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/admin/products` | Admin | Get product details |
| GET | `/api/admin/products/:id` | Admin | Get product detail by ID |

### Invitations (`/api/invitations`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/invitations` | Admin | Get all invitations |
| POST | `/api/invitations` | Admin | Create invitation |
| GET | `/api/invitations/:token` | Public | Get invitation by token |
| POST | `/api/invitations/:token/accept` | Public | Accept invitation |

### Payment Gateways
#### Stripe (`/api/stripe`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/stripe/create-payment-intent` | Public | Create Stripe payment intent |
| POST | `/api/stripe/confirm-payment` | Public | Confirm Stripe payment |

#### PayPal (`/api/paypal`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/paypal/create-order` | Public | Create PayPal order |
| POST | `/api/paypal/capture-order` | Public | Capture PayPal payment |

### Call Logs (`/api/call-logs`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/call-logs` | Public | Get call logs |
| POST | `/api/call-logs` | Public | Create call log |

---

## 🧩 Components Used

### UI Components (`front-end/src/components/ui/`)
- `createUserModel.jsx` - Create user modal
- `createConsumerModel.jsx` - Create consumer modal
- `createResellerModel.jsx` - Create reseller modal
- `updateUserModel.jsx` - Update user modal
- `updateConsumerModel.jsx` - Update consumer modal
- `updateResellerModel.jsx` - Update reseller modal
- `deleteModel.jsx` - Delete confirmation modal
- `createInvoiceModal.jsx` - Create invoice modal
- `forgetPasswordComformPopup.jsx` - Password reset confirmation

### Layout Components
- `Admin.js` - Main admin layout with sidebar
- `AdminNavbar.js` - Top navigation bar

### Icons Library
- **Lucide React** - Primary icon library
- **Font Awesome** - Additional icons (nc-icon classes)

---

## 📊 Pagination Details

| Page | Items Per Page | Total Pages Calculation |
|------|----------------|------------------------|
| Users | 20 | `Math.ceil(users.length / 20)` |
| Consumers | 20 | `Math.ceil(consumers.length / 20)` |
| Resellers | 20 | `Math.ceil(resellers.length / 20)` |
| Permissions (All) | 50 | `Math.ceil(totalPermissions / 50)` |
| Permissions (Role) | 20 | `Math.ceil(permissions.length / 20)` |
| Permissions (User) | 20 | `Math.ceil(permissions.length / 20)` |
| Activity Logs | Variable | Backend pagination |
| Invoices | Variable | Backend pagination |

---

## 🔐 Access Control

### Role-Based Access
- **Admin** - Full access to all admin routes
- **System Admin** (`is_systemadmin = true`) - Additional access to Permissions page

### Protected Routes
All `/admin/*` routes require:
- Valid authentication token
- `role = 'admin'` in user profile
- Active account status (`account_status = 'active'`)

### Special Access
- **Permissions Page** - Requires `is_systemadmin = true`
- **Account Settings** - Accessible to all authenticated admins

---

## 📝 Notes for Role-Based Implementation

When implementing role-based access control, consider:

1. **Page-Level Permissions:**
   - Each page should check for specific permissions
   - Hide sidebar items if user lacks permission
   - Show "Access Denied" message if accessed directly

2. **Button-Level Permissions:**
   - Disable/hide buttons based on permissions
   - Example: `users.create`, `users.delete`, `users.update`

3. **API-Level Permissions:**
   - Backend already has permission middleware
   - Use `requirePermission('resource.action')` middleware
   - Example: `requirePermission('users.delete')`

4. **Permission Naming Convention:**
   - Format: `{resource}.{action}`
   - Examples: `users.create`, `consumers.delete`, `invoices.view`

5. **Common Permissions Needed:**
   - `users.*` - User management
   - `consumers.*` - Consumer management
   - `resellers.*` - Reseller management
   - `products.*` - Product management
   - `invoices.*` - Invoice management
   - `offers.*` - Offer management
   - `settings.*` - Settings management
   - `permissions.*` - Permission management (SystemAdmin only)
   - `activity_logs.view` - View activity logs
   - `customer_support.*` - Support ticket management

---

## 🚀 Quick Reference

### Most Used Actions
1. **Create User/Consumer/Reseller** - Header ➕ button
2. **View Details** - Actions menu → 👁️ View Details
3. **Update** - Actions menu → ✏️ Update
4. **Delete** - Actions menu → 🗑️ Delete
5. **Reset Password** - Actions menu → 🔑 Reset Password

### Most Used APIs
1. `GET /api/users` - List users
2. `GET /api/consumers` - List consumers
3. `GET /api/resellers` - List resellers
4. `GET /api/dashboard/stats` - Dashboard statistics
5. `GET /api/permissions` - List permissions

---

**Last Updated:** 2024
**Version:** 1.0.0

