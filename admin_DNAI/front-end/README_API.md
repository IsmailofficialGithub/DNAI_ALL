# Frontend API Usage Guide

## 🚀 Quick Start

### Using the New Backend API

All data operations now go through the backend API. Import functions from `api/backend`:

```javascript
import { 
  getAdminUsers, 
  createUser, 
  updateUserRole, 
  deleteUser, 
  resetUserPassword 
} from './api/backend';

// Or for consumers
import { 
  getConsumers, 
  createConsumer, 
  updateConsumer, 
  deleteConsumer 
} from './api/backend';
```

---

## 📚 API Reference

### Users API

#### `getAdminUsers()`
Get all users (excluding consumers)

```javascript
const users = await getAdminUsers();
// Returns: Array of user objects or { error: string }
```

#### `getUserById(userId)`
Get a specific user by ID

```javascript
const user = await getUserById('user-uuid');
// Returns: User object or { error: string }
```

#### `createUser(userData)`
Create a new user (sends welcome email automatically)

```javascript
const result = await createUser({
  email: 'user@example.com',
  password: 'SecurePass123!',
  full_name: 'John Doe',
  role: 'admin' // or 'user', 'viewer', 'consumer'
});
// Returns: { success: true, user: {...}, message: string } or { error: string }
```

#### `updateUserRole(userId, role, fullName?)`
Update user's role and optionally their name

```javascript
const result = await updateUserRole(
  'user-uuid', 
  'admin', 
  'John Smith' // optional
);
// Returns: { success: true, user: {...}, message: string } or { error: string }
```

#### `deleteUser(userId)`
Delete a user (admin only)

```javascript
const result = await deleteUser('user-uuid');
// Returns: { success: true, message: string } or { error: string }
```

#### `resetUserPassword(userId)`
Reset user's password (sends email with new password)

```javascript
const result = await resetUserPassword('user-uuid');
// Returns: { success: true, email: string, message: string } or { error: string }
```

---

### Consumers API

#### `getConsumers()`
Get all consumers

```javascript
const consumers = await getConsumers();
// Returns: Array of consumer objects or { error: string }
```

#### `getConsumerById(consumerId)`
Get a specific consumer by ID

```javascript
const consumer = await getConsumerById('consumer-uuid');
// Returns: Consumer object or { error: string }
```

#### `createConsumer(consumerData)`
Create a new consumer

```javascript
const result = await createConsumer({
  email: 'consumer@example.com',
  password: 'SecurePass123!',
  full_name: 'Jane Doe',
  phone: '+1234567890' // optional
});
// Returns: { success: true, user: {...}, message: string } or { error: string }
```

#### `updateConsumer(consumerId, updateData)`
Update consumer information

```javascript
const result = await updateConsumer('consumer-uuid', {
  full_name: 'Jane Smith',
  phone: '+1234567890'
});
// Returns: { success: true, user: {...}, message: string } or { error: string }
```

#### `deleteConsumer(consumerId)`
Delete a consumer

```javascript
const result = await deleteConsumer('consumer-uuid');
// Returns: { success: true, message: string } or { error: string }
```

---

## 🎯 Usage Examples

### Example 1: Fetching and Displaying Users

```javascript
import { useEffect, useState } from 'react';
import { getAdminUsers } from './api/backend';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const result = await getAdminUsers();
        
        if (result.error) {
          setError(result.error);
        } else {
          setUsers(result);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.full_name} - {user.role}</div>
      ))}
    </div>
  );
}
```

### Example 2: Creating a User

```javascript
import { useState } from 'react';
import { createUser } from './api/backend';
import toast from 'react-hot-toast';

function CreateUserForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const result = await createUser(formData);
    
    if (result.success) {
      toast.success('User created successfully! Welcome email sent.');
      // Clear form or redirect
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Example 3: Resetting Password

```javascript
import { resetUserPassword } from './api/backend';
import toast from 'react-hot-toast';

async function handleResetPassword(userId) {
  const result = await resetUserPassword(userId);
  
  if (result.success) {
    toast.success(`Password reset email sent to ${result.email}`);
  } else {
    toast.error(result.error);
  }
}
```

---

## 🔐 Authentication

All API calls automatically include the JWT token from your Supabase session. Make sure users are logged in before making API calls.

### How it works:
1. User logs in via Supabase Auth
2. JWT token stored in session
3. `apiClient` automatically attaches token to all requests
4. Backend verifies token and checks permissions

---

## 🌐 API Client (Advanced)

For more control, you can use the API client directly:

```javascript
import { apiClient } from './api/backend';

// Make custom requests
const response = await apiClient.users.getAll();
const user = await apiClient.users.getById('user-id');
const result = await apiClient.users.create({ ... });
```

### API Client Structure:
```javascript
apiClient = {
  auth: {
    me(),
    logout()
  },
  users: {
    getAll(),
    getById(id),
    create(data),
    update(id, data),
    delete(id),
    resetPassword(id)
  },
  consumers: {
    getAll(),
    getById(id),
    create(data),
    update(id, data),
    delete(id)
  }
}
```

---

## ⚙️ Configuration

### Environment Variables (.env):
```env
# Backend API URL (required)
REACT_APP_API_URL=http://localhost:5000/api

# Supabase (for auth only)
REACT_APP_SUPABASE_URL_PRODUCTION=your_url
REACT_APP_SUPABASE_ANON_KEY_PRODUCTION=your_key
```

### Backend Must Be Running:
```bash
cd backend
npm run dev
```

Verify backend is running: `http://localhost:5000/health`

---

## 🎁 Features

### Automatic Features:
- ✅ **Email Notifications**: Welcome emails and password resets sent automatically
- ✅ **JWT Authentication**: Handled automatically
- ✅ **Error Handling**: Consistent error format
- ✅ **Loading States**: Easy to implement with promises
- ✅ **Type Safety**: Clear function signatures

### Backend Handles:
- 🔐 Authentication & Authorization
- 📧 Email sending (welcome, password reset)
- ✅ Input validation
- 🛡️ Security (rate limiting, CORS)
- 📝 Logging & monitoring

---

## 📖 More Documentation

- **Setup Guide**: See `FRONTEND_SETUP.md`
- **Migration Guide**: See `MIGRATION_GUIDE.md`
- **Backend API**: See `../backend/README.md`
- **Architecture**: See `../ARCHITECTURE_FLOW.md`

---

## 🆘 Need Help?

### Common Issues:

**"Network Error"**
- Backend not running → `cd backend && npm run dev`
- Wrong API URL → Check `.env` file

**"Unauthorized"**
- User not logged in → Redirect to login
- Invalid token → Try logging out and back in

**"Failed to fetch"**
- CORS issue → Check backend CORS settings
- Backend crashed → Check backend terminal

---

**Happy Coding! 🚀**

