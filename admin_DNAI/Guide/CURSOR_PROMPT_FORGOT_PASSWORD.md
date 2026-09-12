# Cursor Prompt: Implement SendGrid Forgot Password Feature

Copy and paste this prompt into Cursor to implement a complete forgot password feature with SendGrid email service.

---

## Prompt

```
I need to implement a forgot password feature with SendGrid email service. Please implement the following:

### Requirements:

1. **SendGrid Setup & Configuration**
   - Install @sendgrid/mail package
   - Create email service file that initializes SendGrid with API key from environment variables
   - Support environment variables: SENDGRID_API_KEY, SENDER_EMAIL, SENDER_NAME, CLIENT_URL

2. **Email Service** (`backend/services/emailService.js`)
   - Create sendPasswordResetEmail function that:
     - Accepts: email, full_name, reset_token, reset_url (optional)
     - Generates reset URL if not provided: ${CLIENT_URL}/reset-password?token=${reset_token}
     - Sends email using SendGrid
     - Returns success/error response
   - Create testEmailConfiguration function to verify setup

3. **Email Template** (`backend/utils/emailTemplates.js`)
   - Create BaseEmailTemplate function with:
     - Outlook-compatible HTML email structure
     - Table-based layout for email clients
     - Responsive design (600px max width)
     - Company branding colors (#8a3b9a as primary)
     - Footer with company info
   - Create PasswordResetTemplate function that:
     - Uses BaseEmailTemplate
     - Shows user's name
     - Includes reset link button
     - Shows security information (1 hour expiry, don't share link)
     - Includes fallback text link if button doesn't work

4. **Backend Routes** (`backend/routes/auth.routes.js`)
   - POST /api/auth/forgot-password - Request password reset
   - POST /api/auth/reset-password - Reset password with token
   - GET /api/auth/verify-reset-token/:token - Verify token validity

5. **Backend Controller** (`backend/controllers/auth.controller.js`)
   - forgotPassword function:
     - Validates email input
     - Finds user by email (use your auth system - Supabase/your DB)
     - Generates secure random token (32 bytes, hex)
     - Sets token expiry (1 hour from now)
     - Stores token in user metadata or database
     - Sends password reset email
     - Returns success (don't reveal if email exists - security)
   - resetPassword function:
     - Validates token and new_password
     - Checks password strength (min 8 characters)
     - Finds user with matching valid token
     - Verifies token hasn't expired
     - Updates user password
     - Clears reset token from storage
     - Returns success
   - verifyResetToken function:
     - Validates token parameter
     - Checks if token exists and is not expired
     - Returns token validity status

6. **Token Management**
   - Generate tokens using crypto.randomBytes(32).toString('hex')
   - Store tokens in user metadata or database table
   - Set expiry to 1 hour from generation
   - Clear tokens after successful password reset

7. **Error Handling**
   - Handle invalid/expired tokens gracefully
   - Don't reveal if email exists in system (prevent enumeration)
   - Provide clear error messages for invalid inputs
   - Log errors for debugging

8. **Security Best Practices**
   - Use HTTPS in production
   - Validate all inputs
   - Set reasonable token expiry
   - Clear tokens after use
   - Rate limiting (mention in comments)

### Implementation Notes:

- Use your existing authentication system (Supabase, custom DB, etc.)
- Follow your project's code style and patterns
- Use your existing error handling utilities
- Integrate with your existing email service if you have one
- Register routes in your main server file

### Environment Variables Needed:

```env
SENDGRID_API_KEY=SG.your_api_key_here
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Your Company Name
CLIENT_URL=http://localhost:3000
```

### Testing Checklist:

- [ ] Email service initializes correctly
- [ ] Forgot password endpoint generates token
- [ ] Email is sent successfully
- [ ] Reset password endpoint validates token
- [ ] Token expiry works correctly
- [ ] Password is updated successfully
- [ ] Token is cleared after use
- [ ] Invalid tokens are rejected
- [ ] Expired tokens are rejected

Please implement all the above components following best practices and your codebase patterns.
```

---

## Usage Instructions

1. **Copy the prompt above** (everything between the triple backticks)
2. **Open Cursor** in your target codebase
3. **Paste the prompt** into the chat
4. **Review the implementation** and adjust as needed for your specific:
   - Authentication system (Supabase, custom DB, etc.)
   - Code style and patterns
   - Existing utilities and helpers
   - Project structure

## Customization Tips

Before using the prompt, you may want to customize:

1. **Authentication System**: Update references to match your auth system (Supabase, Firebase, custom, etc.)
2. **Database**: Adjust how tokens are stored (user metadata, separate table, etc.)
3. **Email Styling**: Modify colors, branding, and layout to match your design
4. **Error Messages**: Adjust messages to match your application's tone
5. **Token Storage**: Choose between user metadata, database table, or Redis cache
6. **Password Requirements**: Adjust minimum length and complexity rules

## Additional Features to Request

After the base implementation, you can request:

- Rate limiting middleware for forgot password endpoint
- Frontend components for forgot/reset password forms
- Password strength meter
- Token resend functionality
- Email templates for other use cases (welcome, notifications, etc.)

---

## Example Follow-up Prompts

After initial implementation:

```
Add rate limiting to the forgot password endpoint - limit to 3 requests per email per hour.
```

```
Create a React component for the forgot password form with validation and loading states.
```

```
Add a password strength indicator to the reset password form.
```

```
Implement token resend functionality if user doesn't receive the email.
```

