# Inbound Genie Backend

Backend server for sending emails using nodemailer with user-provided credentials.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your SMTP credentials in the `.env` file
   - **Important:** Never commit the `.env` file to version control

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:3001` by default.

## API Endpoints

### POST /email

**Main endpoint for frontend integration** - Send email using user-provided credentials.

**Request Body:**
```json
{
  "from_email": "your-email@gmail.com",
  "to_email": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Plain text email body",
  "html_body": "<h1>HTML email body</h1>",
  "smtp_password": "your-app-password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "message-id-here"
}
```

### POST /api/send-email

Send email using automatic SMTP detection based on email domain.

**Request Body:**
```json
{
  "userEmail": "your-email@gmail.com",
  "appPassword": "your-app-password",
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "text": "Plain text email body",
  "html": "<h1>HTML email body</h1>" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "message-id-here"
}
```

### POST /api/send-email-custom

Send email with custom SMTP configuration.

**Request Body:**
```json
{
  "userEmail": "your-email@example.com",
  "appPassword": "your-app-password",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "secure": false,
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "text": "Plain text email body",
  "html": "<h1>HTML email body</h1>" // optional
}
```

### POST /api/send-system-email

**System email endpoint** - Send system emails (invoices, deactivation codes) using secure server-side SMTP credentials.

This endpoint uses environment variables for SMTP configuration and does not require SMTP credentials in the request.

**Request Body:**
```json
{
  "to_email": "user@example.com",
  "subject": "Email Subject",
  "body": "Plain text email body",
  "html_body": "<h1>HTML email body</h1>",
  "type": "invoice" // optional: "invoice" or "deactivation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "message-id-here"
}
```

**Note:** This endpoint is for system emails only (invoices, deactivation codes). It uses secure SMTP credentials stored in environment variables and should not be used for general email sending.

### GET /api/health

Health check endpoint.

## Supported Email Providers

The `/api/send-email` endpoint automatically detects and configures SMTP for:
- Gmail
- Outlook/Hotmail/Live
- Yahoo
- Other domains (uses smtp.{domain})

For other providers, use `/api/send-email-custom` with custom SMTP settings.

## Getting App Passwords

### Gmail
1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate a new app password
5. Use this password (not your regular Gmail password)

### Outlook
1. Go to Microsoft Account security settings
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate a new app password

### Yahoo
1. Go to Account Security settings
2. Enable 2-Step Verification
3. Generate an app password

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

### Required Variables

- `PORT`: Server port (default: 3001)

### SMTP Configuration (for System Emails)

The following environment variables are required for sending system emails (invoices, deactivation codes):

- `SMTP_HOST`: SMTP server hostname (e.g., `mail.duhanashrah.ai`)
- `SMTP_PORT`: SMTP server port (e.g., `465` for SSL/TLS)
- `SMTP_USER`: SMTP username/email (e.g., `no-replay@duhanashrah.ai`)
- `SMTP_PASSWORD`: SMTP password
- `SMTP_FROM_EMAIL`: Email address to send from (defaults to `SMTP_USER` if not set)
- `SMTP_FROM_NAME`: Display name for sent emails (defaults to `Inbound Genie` if not set)

### Example .env File

```env
# Server Configuration
PORT=3001

# SMTP Email Configuration (Secure SSL/TLS Settings)
SMTP_HOST=mail.duhanashrah.ai
SMTP_PORT=465
SMTP_USER=no-replay@duhanashrah.ai
SMTP_PASSWORD=your-smtp-password-here

# Email From Settings
SMTP_FROM_EMAIL=no-replay@duhanashrah.ai
SMTP_FROM_NAME=Inbound Genie
```

**Note:** Copy `.env.example` to `.env` and fill in your actual credentials. The `.env` file is gitignored and should never be committed to version control.
