// Backend API endpoint for sending emails via SendGrid
// This should be deployed as a serverless function (Vercel, Netlify, etc.)
// or as an Express.js endpoint

/**
 * IMPORTANT: This file should NOT be in the React app's src folder.
 * Deploy this as a separate backend service or serverless function.
 * 
 * Example for Vercel serverless function:
 * - Create: api/send-email.js in your project root
 * - Vercel will automatically deploy it as a serverless function
 */

const sgMail = require('@sendgrid/mail');

// Set SendGrid API key from environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text, from } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare email message
    const msg = {
      to,
      from: from || process.env.ADMIN_EMAIL || 'no-reply@duhanashrah.ai',
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    };

    // Send email via SendGrid
    await sgMail.send(msg);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email',
    });
  }
}

// For Express.js server, use this instead:
/*
const express = require('express');
const router = express.Router();

router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, html, text, from } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const msg = {
      to,
      from: from || process.env.ADMIN_EMAIL || 'no-reply@duhanashrah.ai',
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    await sgMail.send(msg);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email',
    });
  }
});

module.exports = router;
*/
