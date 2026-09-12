/**
 * Example usage of the email API
 * 
 * This file demonstrates how to use the backend email API
 * Run the server first: npm start
 */

// Example 1: Send email with automatic SMTP detection (Gmail)
async function sendEmailGmail() {
  const response = await fetch('http://localhost:3001/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail: 'your-email@gmail.com',
      appPassword: 'your-gmail-app-password',
      to: 'recipient@example.com',
      subject: 'Test Email from Inbound Genie',
      text: 'This is a plain text email body.',
      html: '<h1>This is an HTML email body</h1><p>You can use HTML formatting here.</p>'
    })
  });

  const result = await response.json();
  console.log('Email result:', result);
}

// Example 2: Send email with custom SMTP settings
async function sendEmailCustom() {
  const response = await fetch('http://localhost:3001/api/send-email-custom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail: 'your-email@example.com',
      appPassword: 'your-app-password',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      secure: false,
      to: 'recipient@example.com',
      subject: 'Test Email with Custom SMTP',
      text: 'This is a plain text email body.',
      html: '<h1>This is an HTML email body</h1>'
    })
  });

  const result = await response.json();
  console.log('Email result:', result);
}

// Example 3: Health check
async function checkHealth() {
  const response = await fetch('http://localhost:3001/api/health');
  const result = await response.json();
  console.log('Server status:', result);
}

// Uncomment to test:
// sendEmailGmail();
// sendEmailCustom();
// checkHealth();
