# Permissions System Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Database Structure](#database-structure)
4. [Backend APIs](#backend-apis)
5. [Frontend Interface](#frontend-interface)
6. [Usage Examples](#usage-examples)
7. [Permission Hierarchy](#permission-hierarchy)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The Permissions System is a comprehensive Role-Based Access Control (RBAC) solution that provides granular permission management for your application. It allows system administrators to control what users can do based on their roles and individual permissions.

### Key Features
- **Role-Based Permissions**: Assign permissions to roles (admin, reseller, consumer, viewer)
- **User-Specific Permissions**: Override role permissions for individual users
- **System Administrator**: Special users with full access to all permissions
- **Granular Control**: Fine-grained permissions for each resource and action
- **Real-Time Management**: Manage permissions through admin interface

---

## 🔧 How It Works

### Architecture Flow

```
User Request → Authentication → Permission Check → Access Granted/Denied
                ↓
         Load User Profile
                ↓
    Check is_systemadmin (bypass all checks)
                ↓
    Check User-Specific Permissions (overrides role)
                ↓
    Check Role Permissions (default permissions)
                ↓
    Return Access Decision
```

### Permission Check Process

1. **System Admin Check**: If user is `is_systemadmin = true`, grant all permissions
2. **User Permission Override**: Check `user_permissions` table for specific user permissions
3. **Role Permission**: Check `role_permissions` table for role-based permissions
4. **Default Deny**: If no permission found, access is denied

### SQL Functions

The system uses two main SQL functions:

#### `has_permission(user_id, permission_name)`
- Returns `true` if user has the permission, `false` otherwise
- Checks in order: systemadmin → user_permissions → role_permissions

#### `get_user_permissions(user_id)`
- Returns all permissions for a user
- Includes role permissions + user-specific overrides

---

## 🗄️ Database Structure

### Tables

#### 1. `permissions`
Stores all available permissions in the system.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE,           -- e.g., "users.create"
  resource TEXT,              -- e.g., "users"
  action TEXT,                -- e.g., "create"
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Example Permissions:**
- `users.create` - Create new users
- `users.view` - View users list
- `invoices.delete` - Delete invoices
- `permissions.manage` - Manage permissions (systemadmin only)

#### 2. `role_permissions`
Links permissions to roles (many-to-many).

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role TEXT,                  -- "admin", "reseller", "consumer", "viewer"
  permission_id UUID REFERENCES permissions(id),
  created_at TIMESTAMP,
  UNIQUE(role, permission_id)
);
```

#### 3. `user_permissions`
User-specific permission overrides.

```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  permission_id UUID REFERENCES permissions(id),
  granted BOOLEAN DEFAULT true,  -- true = grant, false = revoke
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, permission_id)
);
```

#### 4. `profiles` (Updated)
Added `is_systemadmin` column.

```sql
ALTER TABLE profiles 
ADD COLUMN is_systemadmin BOOLEAN DEFAULT false;
```

---

## 🔌 Backend APIs

### Base URL
All endpoints are under `/api/permissions`

### Authentication
All endpoints require authentication token:
```
Authorization: Bearer <token>
```

### Endpoints

#### 1. Get All Permissions
```http
GET /api/permissions
GET /api/permissions?resource=users
GET /api/permissions?action=create
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "users.create",
      "resource": "users",
      "action": "create",
      "description": "Create new users"
    }
  ],
  "count": 50
}
```

#### 2. Get Current User Permissions
```http
GET /api/permissions/me
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "permission_name": "users.create",
      "granted": true
    }
  ]
}
```

#### 3. Get User Permissions
```http
GET /api/permissions/user/:userId
```

**Access:** Requires `permissions.view` permission

#### 4. Get Role Permissions
```http
GET /api/permissions/role/:role
```

**Example:**
```http
GET /api/permissions/role/admin
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "role": "admin",
      "permissions": {
        "id": "uuid",
        "name": "users.create",
        "resource": "users",
        "action": "create"
      }
    }
  ]
}
```

#### 5. Check User Permission
```http
GET /api/permissions/check/:userId/:permissionName
```

**Example:**
```http
GET /api/permissions/check/123e4567-e89b-12d3-a456-426614174000/users.create
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "permissionName": "users.create",
    "hasPermission": true
  }
}
```

#### 6. Assign Permissions to Role
```http
POST /api/permissions/role/:role/assign
```

**Body:**
```json
{
  "permissionIds": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

**Access:** Systemadmin only

#### 7. Remove Permissions from Role
```http
DELETE /api/permissions/role/:role/remove
```

**Body:**
```json
{
  "permissionIds": ["uuid-1", "uuid-2"]
}
```

**Access:** Systemadmin only

#### 8. Assign Permissions to User
```http
POST /api/permissions/user/:userId/assign
```

**Body:**
```json
{
  "permissionIds": ["uuid-1", "uuid-2"],
  "granted": true
}
```

**Access:** Systemadmin only

#### 9. Remove Permissions from User
```http
DELETE /api/permissions/user/:userId/remove
```

**Body:**
```json
{
  "permissionIds": ["uuid-1", "uuid-2"]
}
```

**Access:** Systemadmin only

#### 10. Set System Admin Status
```http
PATCH /api/permissions/user/:userId/systemadmin
```

**Body:**
```json
{
  "is_systemadmin": true
}
```

**Access:** Systemadmin only

---

## 🖥️ Frontend Interface

### Access
- **URL**: `/admin/permissions`
- **Access**: System administrators only (`is_systemadmin = true`)
- **Location**: Sidebar menu (only visible to system admins)

### Interface Tabs

#### 1. All Permissions Tab
- View all available permissions in the system
- Filter by resource or action
- Search permissions by name, resource, or description
- Displays permission details in card format

**Features:**
- Search bar for quick filtering
- Resource dropdown filter
- Action dropdown filter
- Clear filters button

#### 2. Role Permissions Tab
- Manage permissions for each role
- Select role from dropdown (admin, reseller, consumer, viewer)
- Toggle permissions on/off with checkboxes
- Save changes button

**How to Use:**
1. Select a role from dropdown
2. Check/uncheck permissions
3. Click "Save Changes" to apply

**Visual Indicators:**
- ✅ Checked = Permission granted
- ❌ Unchecked = Permission not granted
- Purple border = Selected permission

#### 3. User Permissions Tab
- Manage permissions for individual users
- Two-panel layout:
  - Left: User list with search
  - Right: Permissions for selected user

**How to Use:**
1. Search/select user from left panel
2. User details appear at top
3. Toggle permissions in grid below
4. Click "Save User Permissions" to apply

**Visual Indicators:**
- Selected user highlighted in purple
- System admin badge shown
- Checkboxes for each permission

#### 4. System Admins Tab
- Grant or revoke system administrator status
- View all users with system admin status
- One-click toggle for system admin access

**How to Use:**
1. View all users in grid
2. Click "Grant" to make user system admin
3. Click "Revoke" to remove system admin status
4. System admins have purple border and badge

**Warning:** System admins have full access to all permissions and can manage the permission system.

---

## 💡 Usage Examples

### Example 1: Protecting a Route

```javascript
// In your route file
import { requirePermission } from '../middleware/permissions.js';

// Protect route with specific permission
router.post(
  '/users',
  authenticate,
  loadUserProfile,
  requirePermission('users.create'),  // Check permission
  createUser
);
```

### Example 2: Checking Multiple Permissions

```javascript
import { requireAnyPermission } from '../middleware/permissions.js';

// User needs ANY of these permissions
router.get(
  '/reports',
  authenticate,
  loadUserProfile,
  requireAnyPermission(['reports.view', 'dashboard.stats']),
  getReports
);
```

### Example 3: Requiring All Permissions

```javascript
import { requireAllPermissions } from '../middleware/permissions.js';

// User needs ALL of these permissions
router.delete(
  '/users/:id',
  authenticate,
  loadUserProfile,
  requireAllPermissions(['users.delete', 'users.manage']),
  deleteUser
);
```

### Example 4: System Admin Only Route

```javascript
import { requireSystemAdmin } from '../middleware/permissions.js';

// Only system admins can access
router.patch(
  '/permissions/user/:id/systemadmin',
  authenticate,
  loadUserProfile,
  requireSystemAdmin,  // System admin check
  setSystemAdmin
);
```

### Example 5: Frontend Permission Check

```javascript
// In React component
import { useAuth } from '../hooks/useAuth';
import { checkUserPermission } from '../api/backend/permissions';

const MyComponent = () => {
  const { profile } = useAuth();
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    if (profile?.user_id) {
      checkUserPermission(profile.user_id, 'users.create')
        .then(hasPermission => setCanCreate(hasPermission));
    }
  }, [profile]);

  return (
    <div>
      {canCreate && (
        <button onClick={handleCreate}>Create User</button>
      )}
    </div>
  );
};
```

---

## 🏗️ Permission Hierarchy

### Permission Priority (Highest to Lowest)

1. **System Administrator** (`is_systemadmin = true`)
   - Has ALL permissions automatically
   - Cannot be restricted
   - Can manage permission system

2. **User-Specific Permissions** (`user_permissions` table)
   - Overrides role permissions
   - Can grant or revoke specific permissions
   - Takes precedence over role

3. **Role Permissions** (`role_permissions` table)
   - Default permissions for role
   - Applied if no user-specific override
   - Shared by all users with same role

4. **No Permission** (Default)
   - Access denied
   - Returns 403 Forbidden

### Default Role Permissions

#### Admin Role
- Most permissions except systemadmin management
- Can manage users, invoices, products, etc.
- Cannot manage permissions system

#### Reseller Role
- Limited to consumer management
- Can create/view invoices
- Can submit payments
- View-only access to products

#### Consumer Role
- Minimal permissions
- View own invoices
- Submit payments
- Create support tickets

#### Viewer Role
- Read-only access
- Can view but not modify
- No create/update/delete permissions

---

## 🔍 Troubleshooting

### Issue: Permission Check Always Returns False

**Solution:**
1. Check if user has `is_systemadmin = true` (bypasses all checks)
2. Verify permission exists in `permissions` table
3. Check `role_permissions` for user's role
4. Check `user_permissions` for user-specific overrides
5. Ensure permission name matches exactly (case-sensitive)

### Issue: User Can't Access Permissions Page

**Solution:**
1. Verify user has `is_systemadmin = true` in `profiles` table
2. Check sidebar route has `systemAdminOnly: true` flag
3. Clear browser cache and reload
4. Check authentication token is valid

### Issue: Changes Not Reflecting

**Solution:**
1. Clear Redis cache (permissions are cached)
2. Wait a few seconds for cache TTL to expire (5 minutes)
3. Refresh the page
4. Check database directly to verify changes saved

### Issue: Permission Denied Error

**Possible Causes:**
1. User doesn't have required permission
2. Permission name is incorrect
3. User's role changed but cache not cleared
4. User-specific permission override is set to `granted = false`

**Solution:**
1. Check user's permissions via API: `GET /api/permissions/user/:userId`
2. Verify permission name in database
3. Clear cache and retry
4. Check `user_permissions` table for overrides

### Issue: SQL Function Error

**Solution:**
1. Ensure migration `011_create_permissions_system.sql` has been run
2. Verify SQL functions exist:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'has_permission';
   SELECT * FROM pg_proc WHERE proname = 'get_user_permissions';
   ```
3. Re-run migration if functions missing

---

## 📝 Best Practices

### 1. Permission Naming Convention
- Use format: `resource.action`
- Examples: `users.create`, `invoices.delete`, `products.view`
- Be consistent across all permissions

### 2. Role Design
- Keep roles simple and meaningful
- Don't create too many roles
- Use user-specific permissions for exceptions

### 3. System Admin Management
- Limit system admin users (only trusted administrators)
- Regularly audit system admin list
- Use system admin status sparingly

### 4. Caching Strategy
- Permissions are cached for 5 minutes
- Clear cache when permissions change
- Use cache invalidation on permission updates

### 5. Testing Permissions
- Test with different roles
- Test user-specific overrides
- Test system admin bypass
- Test permission denial scenarios

---

## 🔐 Security Considerations

1. **System Admin Access**: Only grant to trusted users
2. **Permission Names**: Keep them descriptive and organized
3. **Audit Trail**: All permission changes are logged in activity logs
4. **Default Deny**: System denies access by default if no permission found
5. **Token Security**: Always use secure authentication tokens

---

## 📚 Additional Resources

- **Migration File**: `backend/migrations/011_create_permissions_system.sql`
- **Quick Reference**: `backend/migrations/PERMISSIONS_QUICK_REFERENCE.sql`
- **Backend Controller**: `backend/routes/controllers/permissions.controller.js`
- **Frontend Component**: `front-end/src/views/Permissions.js`
- **Middleware**: `backend/middleware/permissions.js`

---

## ✅ Quick Start Checklist

- [ ] Run migration `011_create_permissions_system.sql`
- [ ] Set at least one user as system admin
- [ ] Access permissions page at `/admin/permissions`
- [ ] Review default role permissions
- [ ] Test permission checks in your routes
- [ ] Configure permissions for your use case

---

**Last Updated**: 2025
**Version**: 1.0.0

