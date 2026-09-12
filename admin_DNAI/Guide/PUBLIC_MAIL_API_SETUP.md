# Public Mail API - React Vite Setup Guide

Simple guide for integrating the Public Mail API into a React Vite application.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Setup](#environment-setup)
5. [Basic Usage](#basic-usage)
6. [Complete Example](#complete-example)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## 🎯 Overview

The Public Mail API allows you to send emails from your React Vite application using API key authentication.

**Endpoint:** `POST /api/public/mail`

**Authentication:** API Key (via `api_key` in request body)

---

## 📦 Prerequisites

- React Vite app set up
- API key from backend `.env` file (`MAIL_API_KEY`)
- Backend server running and accessible

---

## 🚀 Installation

### Step 1: Create React Vite App (if not already created)

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
```

### Step 2: Install Axios (for API calls)

```bash
npm install axios
```

---

## ⚙️ Environment Setup

### 1. Create `.env` file in your React Vite project root

Create a `.env` file (or `.env.local` for local development):

```env
VITE_API_URL=https://duhanashrah.ai/api
VITE_MAIL_API_KEY=23222KKSKAJ2322I2I
```

**Important:** In Vite, environment variables must be prefixed with `VITE_` to be accessible in the browser.

### 2. Update `.gitignore`

Make sure your `.gitignore` includes:

```
.env
.env.local
.env*.local
```

---

## 💻 Basic Usage

### Simple Email Send Function

Create a utility file `src/utils/emailService.js`:

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_KEY = import.meta.env.VITE_MAIL_API_KEY;

/**
 * Send email via Public Mail API
 * @param {Object} emailData - Email data
 * @param {string} emailData.to - Recipient email address
 * @param {string} emailData.from - Sender email address
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.html - HTML content of the email
 * @returns {Promise<Object>} API response
 */
export const sendEmail = async ({ to, from, subject, html }) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/public/mail`,
      {
        to,
        from,
        subject,
        html,
        api_key: API_KEY,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
};
```

---

## 📝 Complete Example

### React Component Example

Create `src/components/ContactForm.jsx`:

```jsx
import { useState } from 'react';
import { sendEmail } from '../utils/emailService';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    to: '',
    from: '',
    subject: '',
    html: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await sendEmail(formData);

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Email sent successfully!',
        });
        // Reset form
        setFormData({
          to: '',
          from: '',
          subject: '',
          html: '',
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error?.message || 'Failed to send email',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Send Email</h2>
      
      {message.text && (
        <div
          style={{
            padding: '10px',
            marginBottom: '20px',
            borderRadius: '4px',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="to" style={{ display: 'block', marginBottom: '5px' }}>
            To:
          </label>
          <input
            type="email"
            id="to"
            name="to"
            value={formData.to}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="from" style={{ display: 'block', marginBottom: '5px' }}>
            From:
          </label>
          <input
            type="email"
            id="from"
            name="from"
            value={formData.from}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="subject" style={{ display: 'block', marginBottom: '5px' }}>
            Subject:
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="html" style={{ display: 'block', marginBottom: '5px' }}>
            HTML Content:
          </label>
          <textarea
            id="html"
            name="html"
            value={formData.html}
            onChange={handleChange}
            required
            rows="10"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontFamily: 'monospace',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Sending...' : 'Send Email'}
        </button>
      </form>
    </div>
  );
};

export default ContactForm;
```

### Usage in App.jsx

```jsx
import ContactForm from './components/ContactForm';

function App() {
  return (
    <div className="App">
      <ContactForm />
    </div>
  );
}

export default App;
```

---

## ⚠️ Error Handling

### API Response Structure

**Success Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "to": "recipient@example.com",
    "from": "sender@example.com",
    "subject": "Email Subject"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Missing or invalid fields
- `UNAUTHORIZED` - Invalid API key
- `SERVER_ERROR` - Server-side error
- `RATE_LIMIT_EXCEEDED` - Too many requests (20 per minute)

### Enhanced Error Handling Example

```javascript
export const sendEmail = async ({ to, from, subject, html }) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/public/mail`,
      {
        to,
        from,
        subject,
        html,
        api_key: API_KEY,
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data;
      return {
        success: false,
        error: {
          code: errorData.error?.code || 'UNKNOWN_ERROR',
          message: errorData.error?.message || 'Failed to send email',
        },
      };
    } else if (error.request) {
      // Request made but no response received
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'No response from server. Please check your connection.',
        },
      };
    } else {
      // Error in request setup
      return {
        success: false,
        error: {
          code: 'REQUEST_ERROR',
          message: error.message,
        },
      };
    }
  }
};
```

---

## ✅ Best Practices

### 1. **Environment Variables Security**

- Never commit `.env` files to version control
- Use different API keys for development and production
- In production, use environment variables from your hosting platform

### 2. **API Key Management**

- Store API key in environment variables, never hardcode
- Use `.env.local` for local development (already in `.gitignore`)

### 3. **Input Validation**

Add client-side validation before sending:

```javascript
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateForm = (formData) => {
  if (!validateEmail(formData.to)) {
    return { valid: false, error: 'Invalid recipient email' };
  }
  if (!validateEmail(formData.from)) {
    return { valid: false, error: 'Invalid sender email' };
  }
  if (!formData.subject.trim()) {
    return { valid: false, error: 'Subject is required' };
  }
  if (!formData.html.trim()) {
    return { valid: false, error: 'HTML content is required' };
  }
  return { valid: true };
};
```

### 4. **Loading States**

Always show loading states during API calls to improve UX:

```javascript
const [loading, setLoading] = useState(false);

// In handler
setLoading(true);
try {
  // API call
} finally {
  setLoading(false);
}
```

### 5. **Rate Limiting**

The API has rate limiting (20 requests per minute). Implement retry logic with exponential backoff if needed.

### 6. **HTTPS in Production**

Always use HTTPS in production to protect API keys in transit.

---

## 🔧 Troubleshooting

### Issue: "Invalid API key"

**Solution:** 
- Check that `VITE_MAIL_API_KEY` in your `.env` matches `MAIL_API_KEY` in backend `.env`
- Ensure `.env` file is in the project root
- Restart the Vite dev server after changing `.env`

### Issue: "Network Error"

**Solution:**
- Verify backend server is running
- Check `VITE_API_URL` points to correct backend URL
- Check CORS configuration in backend

### Issue: "Email not received"

**Solution:**
- Check SendGrid logs in backend
- Verify sender email is verified in SendGrid account
- Check spam/junk folder

---

## 📚 Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Axios Documentation](https://axios-http.com/docs/intro)
- [React Documentation](https://react.dev/)

---

## 🎉 Quick Start Checklist

- [ ] Create React Vite app
- [ ] Install axios (`npm install axios`)
- [ ] Create `.env` file with `VITE_API_URL` and `VITE_MAIL_API_KEY`
- [ ] Create `src/utils/emailService.js` with `sendEmail` function
- [ ] Create component using the email service
- [ ] Test the integration
- [ ] Handle errors appropriately
- [ ] Add loading states

---

**Need Help?** Check the backend logs or API response for detailed error messages.

