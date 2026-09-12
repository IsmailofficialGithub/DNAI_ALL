import nodemailer from 'nodemailer';

/**
 * Send email using user-provided SMTP credentials
 * This function is used by the backend API endpoint
 * 
 * @param {Object} options - Email options
 * @param {string} options.from_email - Sender's email address (from database)
 * @param {string} options.to_email - Recipient's email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Plain text email body
 * @param {string} options.html_body - HTML email body (optional)
 * @param {string} options.smtp_password - SMTP password/app password (from database)
 * @returns {Promise<Object>} - Result with success status and messageId or error
 */
export async function sendEmailWithSMTP(options) {
  const { from_email, to_email, subject, body, html_body, smtp_password } = options;

  // Validate required fields
  if (!from_email || !to_email || !subject || !smtp_password) {
    throw new Error('Missing required fields: from_email, to_email, subject, and smtp_password are required');
  }

  if (!body && !html_body) {
    throw new Error('Either body or html_body must be provided');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(from_email) || !emailRegex.test(to_email)) {
    throw new Error('Invalid email format');
  }

  // Determine SMTP settings based on email domain
  const emailDomain = from_email.split('@')[1].toLowerCase();
  let smtpConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: from_email,
      pass: smtp_password
    }
  };

  // Configure SMTP for different email providers
  if (emailDomain.includes('gmail.com')) {
    smtpConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: from_email,
        pass: smtp_password
      }
    };
  } else if (emailDomain.includes('outlook.com') || emailDomain.includes('hotmail.com') || emailDomain.includes('live.com')) {
    smtpConfig = {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: from_email,
        pass: smtp_password
      }
    };
  } else if (emailDomain.includes('yahoo.com')) {
    smtpConfig = {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
      auth: {
        user: from_email,
        pass: smtp_password
      }
    };
  } else {
    // For other domains, try common SMTP settings
    smtpConfig = {
      host: `smtp.${emailDomain}`,
      port: 587,
      secure: false,
      auth: {
        user: from_email,
        pass: smtp_password
      }
    };
  }

  // Create transporter
  const transporter = nodemailer.createTransport(smtpConfig);

  // Verify connection
  await transporter.verify();

  // Prepare email options - prefer html_body if available, otherwise use body
  const html = html_body || (body ? body.replace(/\n/g, '<br>') : '');
  const text = body || (html_body ? html_body.replace(/<[^>]*>/g, '') : '');

  const mailOptions = {
    from: from_email, // Use the email from database
    to: to_email,
    subject: subject,
    text: text,
    html: html
  };

  // Send email
  const info = await transporter.sendMail(mailOptions);

  return {
    success: true,
    message: 'Email sent successfully',
    messageId: info.messageId
  };
}
