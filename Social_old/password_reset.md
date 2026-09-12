setupGuide with Templete 

# SendGrid Forgot Password Implementation Guide

This guide provides step-by-step instructions for setting up SendGrid email service and implementing a forgot password feature with password reset email templates.

---

## Table of Contents

1. [SendGrid Setup](#sendgrid-setup)
2. [Backend Implementation](#backend-implementation)
3. [Email Template](#email-template)
4. [Frontend Integration](#frontend-integration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## SendGrid Setup

### Step 1: Create SendGrid Account

1. Go to [https://sendgrid.com](https://sendgrid.com)
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

### Step 2: Create API Key

1. Navigate to **Settings** → **API Keys** in the SendGrid dashboard
2. Click **Create API Key**
3. Name it (e.g., "Production API Key" or "Development API Key")
4. Select **Full Access** or **Restricted Access** with Mail Send permissions
5. Click **Create & View**
6. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!

### Step 3: Verify Sender Identity

#### Option A: Single Sender Verification (Recommended for Development)

1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in the form:
   - **From Email Address**: `noreply@yourdomain.com`
   - **From Name**: Your Company Name
   - **Reply To**: `support@yourdomain.com`
   - **Company Address**: Your business address
   - **Company Website**: Your website URL
4. Click **Create**
5. Check your email and click the verification link
6. Wait for approval (usually instant)

#### Option B: Domain Authentication (Recommended for Production)

1. Go to **Settings** → **Sender Authentication**
2. Click **Authenticate Your Domain**
3. Follow the DNS configuration steps
4. Add the provided DNS records to your domain
5. Wait for verification (can take up to 48 hours)

### Step 4: Configure Environment Variables

Add the following to your `.env` file:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Your Company Name
CLIENT_URL=http://localhost:3000  # Your frontend URL
```

**Security Note**: Never commit your `.env` file to version control. Add it to `.gitignore`.

---

## Backend Implementation

### Step 1: Install SendGrid Package

```bash
npm install @sendgrid/mail
```

### Step 2: Create Email Service

Create `backend/services/emailService.js`:

```javascript
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import { PasswordResetTemplate } from "../utils/emailTemplates.js";

dotenv.config();

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || "noreply@yourdomain.com";
const SENDER_NAME = process.env.SENDER_NAME || "Your Company Name";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("⚠️  SENDGRID_API_KEY not found in environment variables");
}

/**
 * Send password reset email with reset link
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.reset_token - Password reset token
 * @param {string} params.reset_url - Full reset URL (optional, will be generated if not provided)
 * @returns {Promise<Object>} Email send result
 */
export const sendPasswordResetEmail = async ({
  email,
  full_name,
  reset_token,
  reset_url = null,
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "http://localhost:3000";
    
    // Generate reset URL if not provided
    const resetLink = reset_url || `${website_url}/reset-password?token=${reset_token}`;

    const htmlContent = PasswordResetTemplate({
      full_name,
      reset_link: resetLink,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      subject: `Password Reset Request - ${full_name || email}`,
      html: htmlContent,
    };

    console.log("📧 Sending password reset email to:", email);
    await sgMail.send(msg);
    console.log("✅ Password reset email sent successfully");

    return {
      success: true,
      message: "Password reset email sent successfully",
      email,
    };
  } catch (error) {
    console.error("❌ Error sending password reset email:", error.response?.body || error);
    throw error;
  }
};

/**
 * Test email configuration
 * @returns {Promise<boolean>} True if email is configured correctly
 */
export const testEmailConfiguration = async () => {
  try {
    if (!SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }
    
    console.log("✅ SendGrid email service is configured");
    return true;
  } catch (error) {
    console.error("❌ Email configuration error:", error.message);
    console.warn(
      "⚠️  Email service will not work. Please configure SENDGRID_API_KEY and SENDER_EMAIL in .env"
    );
    return false;
  }
};

export default {
  sendPasswordResetEmail,
  testEmailConfiguration,
};
```

### Step 3: Create Password Reset Email Template

Create `backend/utils/emailTemplates.js`:

```javascript
/**
 * Base Email Template - Unified styling for all emails
 * Outlook-compatible version using table-based layouts
 */
const BaseEmailTemplate = ({
  title = 'Email',
  subtitle = '',
  content = '',
  buttonText = '',
  buttonUrl = '',
  footerText = ''
} = {}) => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${title}</title>
    <style type="text/css">
      body, td, th, p, span, div, h1, h2, h3, h4, h5, h6 {
        font-family: Verdana, Geneva, sans-serif;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; width: 100%; background-color: #f7f7f9; font-family: Verdana, Geneva, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; background-color: #f7f7f9;">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width: 600px; max-width: 600px; background-color: #ffffff;">
            
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 32px 0 16px 0; background-color: #ffffff;">
                <h1 style="margin: 0; color: #8a3b9a; font-size: 28px; font-weight: bold;">Your Company</h1>
              </td>
            </tr>

            <!-- Title Header -->
            <tr>
              <td style="padding: 24px 40px 16px 40px; background-color: #8a3b9a; color: #ffffff;">
                <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0; color: #ffffff;">${title}</h1>
                ${subtitle ? `<p style="margin: 0; font-size: 15px; color: #ffffff;">${subtitle}</p>` : ''}
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 32px 40px; color: #232347; font-size: 16px; line-height: 1.5;">
                ${content}
                
                ${buttonText && buttonUrl ? `
                <!-- CTA Button -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 16px 0;">
                  <tr>
                    <td align="center" style="padding: 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" style="background-color: #8a3b9a; padding: 14px 38px; border-radius: 8px;">
                            <a href="${buttonUrl}" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: bold; font-size: 18px; display: block;">
                              ${buttonText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                ` : ''}

                ${footerText ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0 0 0;">
                  <tr>
                    <td align="center" style="font-size: 14px; color: #66698c;">
                      ${footerText}
                    </td>
                  </tr>
                </table>
                ` : ''}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 28px 40px 24px 40px; background-color: #fafbfc;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-top: 1px solid #e6e6ec; padding: 0 0 16px 0;"></td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size: 15px; color: #8889a8; padding-top: 8px;">
                      Questions? Contact us at support@yourdomain.com
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size: 13px; color: #a5a6be; padding-top: 4px;">
                      © ${new Date().getFullYear()} Your Company. All Rights Reserved
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

/**
 * Password Reset Email Template
 * @param {Object} params
 * @param {string} params.full_name - User's full name
 * @param {string} params.reset_link - Password reset link with token
 * @param {string} params.website_url - Website URL
 */
export const PasswordResetTemplate = ({
  full_name = "User",
  reset_link = "#",
  website_url = "#",
} = {}) => {
  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #8a3b9a;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      We received a request to reset your password. Click the button below to create a new password:
    </p>

    <!-- Security Info -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #8a3b9a;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347;">
                Security Information
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347;">
                • This link will expire in <strong>1 hour</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347;">
                • If you didn't request this, please ignore this email
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c;">
                For security reasons, never share this link with anyone.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: 'Password Reset Request',
    subtitle: 'Reset your password securely',
    content,
    buttonText: 'Reset Password',
    buttonUrl: reset_link,
    footerText: 'If the button doesn\'t work, copy and paste this link into your browser: ' + reset_link
  });
};

export default {
  PasswordResetTemplate,
};
```

### Step 4: Create Forgot Password Route

Create `backend/routes/auth.routes.js`:

```javascript
import express from 'express';
import { forgotPassword, resetPassword, verifyResetToken } from '../controllers/auth.controller.js';

const router = express.Router();

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', resetPassword);

/**
 * @route   GET /api/auth/verify-reset-token/:token
 * @desc    Verify reset token validity
 * @access  Public
 */
router.get('/verify-reset-token/:token', verifyResetToken);

export default router;
```

### Step 5: Create Auth Controller

Create `backend/controllers/auth.controller.js`:

```javascript
import crypto from 'crypto';
import { supabase, supabaseAdmin } from '../config/database.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

/**
 * Forgot Password - Generate reset token and send email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid email address is required'
      });
    }

    // Find user by email
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to process request'
      });
    }

    const user = users.users.find(u => u.email === email.toLowerCase());

    // Don't reveal if user exists (security best practice)
    if (!user) {
      // Return success even if user doesn't exist (prevents email enumeration)
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in user metadata or database
    // Option 1: Store in user metadata (Supabase)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          reset_token: resetToken,
          reset_token_expiry: tokenExpiry.toISOString()
        }
      }
    );

    if (updateError) {
      console.error('❌ Error storing reset token:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate reset token'
      });
    }

    // Get user profile for full name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    // Generate reset URL
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send password reset email
    try {
      await sendPasswordResetEmail({
        email: user.email,
        full_name: profile?.full_name || user.email.split('@')[0],
        reset_token: resetToken,
        reset_url: resetUrl
      });
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request'
    });
  }
};

/**
 * Reset Password - Verify token and update password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    // Validate input
    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Token and new password are required'
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Find user with matching reset token
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to process request'
      });
    }

    const user = users.users.find(u => 
      u.user_metadata?.reset_token === token &&
      u.user_metadata?.reset_token_expiry &&
      new Date(u.user_metadata.reset_token_expiry) > new Date()
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Token',
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: new_password,
        user_metadata: {
          ...user.user_metadata,
          reset_token: null,
          reset_token_expiry: null
        }
      }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to reset password'
      });
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An error occurred while resetting your password'
    });
  }
};

/**
 * Verify Reset Token - Check if token is valid
 * @route   GET /api/auth/verify-reset-token/:token
 * @access  Public
 */
export const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Token is required'
      });
    }

    // Find user with matching reset token
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to verify token'
      });
    }

    const user = users.users.find(u => 
      u.user_metadata?.reset_token === token &&
      u.user_metadata?.reset_token_expiry &&
      new Date(u.user_metadata.reset_token_expiry) > new Date()
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Token',
        message: 'Invalid or expired reset token'
      });
    }

    res.json({
      success: true,
      message: 'Token is valid'
    });

  } catch (error) {
    console.error('❌ Verify token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to verify token'
    });
  }
};
```

### Step 6: Register Routes

In your main server file (e.g., `backend/server.js`):

```javascript
import authRoutes from './routes/auth.routes.js';

// ... other imports and setup

app.use('/api/auth', authRoutes);
```

---

## Frontend Integration

### Step 1: Create Forgot Password Component

Create `frontend/src/components/ForgotPassword.jsx`:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      setMessage(response.data.message);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Forgot Password</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', marginTop: '5px' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#8a3b9a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      {message && <p style={{ color: 'green', marginTop: '15px' }}>{message}</p>}
      {error && <p style={{ color: 'red', marginTop: '15px' }}>{error}</p>}
    </div>
  );
};

export default ForgotPassword;
```

### Step 2: Create Reset Password Component

Create `frontend/src/components/ResetPassword.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Verify token on mount
    if (token) {
      axios.get(`/api/auth/verify-reset-token/${token}`)
        .then(() => setVerifying(false))
        .catch(() => {
          setError('Invalid or expired reset token');
          setVerifying(false);
        });
    } else {
      setError('No reset token provided');
      setVerifying(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/api/auth/reset-password', {
        token,
        new_password: password
      });
      setMessage(response.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return <div>Verifying token...</div>;
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ width: '100%', padding: '10px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            style={{ width: '100%', padding: '10px', marginTop: '5px' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#8a3b9a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
      {message && <p style={{ color: 'green', marginTop: '15px' }}>{message}</p>}
      {error && <p style={{ color: 'red', marginTop: '15px' }}>{error}</p>}
    </div>
  );
};

export default ResetPassword;
```

---

## Testing

### 1. Test Email Configuration

```javascript
import { testEmailConfiguration } from './services/emailService.js';

testEmailConfiguration();
```

### 2. Test Forgot Password Flow

1. Send a POST request to `/api/auth/forgot-password` with an email
2. Check your email inbox for the reset link
3. Click the link and verify it redirects to the reset password page
4. Enter a new password and submit
5. Try logging in with the new password

### 3. Test Token Expiry

1. Request a password reset
2. Wait for the token to expire (1 hour)
3. Try to use the expired token
4. Verify it returns an error

---

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Verify `SENDGRID_API_KEY` is set correctly
2. **Check Sender Verification**: Ensure sender email is verified in SendGrid
3. **Check Spam Folder**: Emails might be going to spam
4. **Check SendGrid Dashboard**: Look for errors in Activity Feed

### Token Not Working

1. **Check Token Storage**: Verify token is being stored in user metadata
2. **Check Token Expiry**: Ensure expiry time is set correctly
3. **Check Token Comparison**: Verify token comparison logic

### Common Errors

- **401 Unauthorized**: Invalid SendGrid API key
- **403 Forbidden**: Sender not verified
- **Token Invalid**: Token expired or doesn't exist
- **Email Not Received**: Check spam folder, verify sender email

---

## Security Best Practices

1. **Rate Limiting**: Implement rate limiting on forgot password endpoint
2. **Token Expiry**: Set reasonable token expiry (1 hour recommended)
3. **Token Storage**: Store tokens securely (hashed if possible)
4. **Email Enumeration**: Don't reveal if email exists in system
5. **HTTPS Only**: Always use HTTPS in production
6. **Password Strength**: Enforce strong password requirements

---

## Additional Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)
- [Email Template Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding-html-emails/)

---

## Support

For issues or questions:
- Check SendGrid dashboard for email delivery status
- Review server logs for errors
- Verify environment variables are set correctly
- Test email configuration using the test function