/**
 * Email Templates for User Management
 * All templates use the unified styling from text.html
 */
import { hasRole } from './roleUtils.js';

/**
 * Base Email Template - Unified styling for all emails
 * Outlook-compatible version using table-based layouts
 * @param {Object} params
 * @param {string} params.title - Email title/header text
 * @param {string} params.subtitle - Subtitle/date text (optional)
 * @param {string} params.content - Main HTML content
 * @param {string} params.buttonText - CTA button text (optional)
 * @param {string} params.buttonUrl - CTA button URL (optional)
 * @param {string} params.footerText - Footer text (optional)
 * @returns {string} HTML email template
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
  <title>${title} - DuhaNashrah ai</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { margin:0; padding:0; background:#f4f5f7; font-family:'Manrope', Arial, sans-serif; color:#333 }
    .wrapper { width:100%; table-layout:fixed; background:#f4f5f7; padding:40px 20px; box-sizing:border-box }
    .main-container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.05) }
    .header-table { width:100%; border-collapse:collapse }
    .contact-btn { color:#00B48D; text-decoration:none; font-size:15px; font-weight:600 }
    .content { padding:20px 40px }
    .title { text-align:center; font-size:24px; font-weight:700; color:#111; margin:0 0 18px }
    .subtitle { text-align:center; font-size:14px; color:#6b7280; margin:6px 0 18px }
    .greeting { font-size:16px; margin-bottom:12px }
    .message { font-size:16px; line-height:1.6; color:#444; margin-bottom:18px }
    .code-container { background:#F1F1F1; border-radius:8px; padding:14px 25px; margin:20px auto; text-align:center; display:inline-block }
    .code-box { display:inline-block; width:auto; padding:0 20px; letter-spacing:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; height:55px; line-height:55px; font-size:26px; font-weight:700; color:#111 }
    .cta { display:block; text-align:center; margin:26px 0 }
    .btn { background:#00B48D; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600 }
    .expire-text { text-align:center; font-size:14px; color:#6b7280; margin-bottom:16px }
    .help-text { font-size:15px; line-height:1.6; color:#555; margin-bottom:12px }
    .signature { font-size:16px; color:#444; margin-bottom:24px }
    .footer-area { margin-top:20px; position:relative }
    .green-footer { background:#00B48D; padding:30px 20px 25px; text-align:center; color:#fff; border-top-left-radius:90% 100%; border-top-right-radius:90% 100%; border-bottom-left-radius:12px; border-bottom-right-radius:12px }
    .footer-img-left { width:150px; max-width:100%; height:auto; display:block }
    .footer-img-right { width:180px; max-width:100%; height:auto; display:block }
    .social-icons { text-align:center; margin-bottom:12px }
    .social-icon img { width:30px; height:30px }
    .copyright { font-size:14px; opacity:0.9 }
    @media only screen and (max-width:600px) { .wrapper{padding:20px 10px} .content{padding:20px} .code-box{font-size:24px;padding:0 16px} .footer-img-right{width:130px} .footer-img-left{width:120px} }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-container">
      <!-- Header Table -->
      <table class="header-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; padding: 30px 40px 10px;">
        <tr>
          <td align="left" valign="middle">
            <div class="logo">
              <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/DnaiLogo.png" alt="DuhaNashrah ai" style="height:45px; width:auto; display:block; border:0;" />
            </div>
          </td>
          <td align="right" valign="middle">
            <a href="https://social.duhanashrah.ai/contact" class="contact-btn">Contact Us</a>
          </td>
        </tr>
      </table>
      <div class="content">
        <h1 class="title">${title}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        <div class="greeting"></div>
        <div class="message">${content}</div>
        ${buttonText && buttonUrl ? `<div class="cta"><a href="${buttonUrl}" class="btn" target="_blank" rel="noopener">${buttonText}</a></div>` : ''}
        ${footerText ? `<div style="text-align:center; color:#6b7280; font-size:13px; margin-top:6px">${footerText}</div>` : ''}
      </div>
      <div class="footer-area">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:-40px; position:relative; z-index:10">
          <tr>
            <td align="left" valign="bottom"><img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/beeba.png" alt="Beeba" class="footer-img-left" /></td>
            <td align="right" valign="bottom"><img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/genie.png" alt="Genie" class="footer-img-right" /></td>
          </tr>
        </table>
        <div class="green-footer">
          <h2 style="margin:0 0 12px 0; font-size:20px; font-weight:700;">DuhaNashrah ai</h2>
          <div class="social-icons">
            <a href="#" class="social-icon" aria-label="Facebook"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" alt="facebook" /></a>
            <a href="#" class="social-icon" aria-label="Twitter"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitter.png" alt="twitter" /></a>
            <a href="#" class="social-icon" aria-label="Instagram"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" alt="instagram" /></a>
          </div>
          <div class="copyright">© 2026 DuhaNashrah ai</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Welcome Email Template - User Created
 * @param {Object} params
 * @param {string} params.full_name - User's full name
 * @param {string} params.email - User's email
 * @param {string} params.password - Temporary password
 * @param {string} params.role - User role (user, reseller, consumer, admin)
 * @param {string} params.website_url - Website URL
 */
export const AdminEmailTemplateUserCreated = ({
  full_name = "John Doe",
  email = "johndoe@example.com",
  password = "Demo@123456",
  role = "user",
  website_url = process.env.CLIENT_URL || "#",
} = {}) => {
  // Role-based welcome messages
  const roleMessages = {
    consumer: {
      title: 'Welcome Consumer!',
      subtitle: 'Your Account has been created',
      greeting: `Hello <strong style="color: #00B48D;">${full_name}</strong>,`,
      message: `Welcome to DuhaNashrahAi! We're thrilled to have you as a consumer. Your account has been successfully created and you can start exploring our services right away.`,
      buttonText: 'Login Now'
    },
    reseller: {
      title: 'Welcome Reseller!',
      subtitle: 'Your reseller account is ready',
      greeting: `Hello <strong style="color: #00B48D;">${full_name}</strong>,`,
      message: `Welcome to DuhaNashrahAi! We're excited to have you join our reseller network. Your account has been successfully created and you can start managing your business right away.`,
      buttonText: 'Go to Dashboard'
    },
    admin: {
      title: 'Welcome Administrator!',
      subtitle: 'Your admin account is ready',
      greeting: `Hello <strong style="color: #00B48D;">${full_name}</strong>,`,
      message: `Welcome to DuhaNashrahAi! Your administrator account has been successfully created. You now have full access to manage the platform.`,
      buttonText: 'Access Admin Panel'
    },
    user: {
      title: 'Welcome Aboard!',
      subtitle: 'Your account is ready',
      greeting: `Hello <strong style="color: #00B48D;">${full_name}</strong>,`,
      message: `Thank you for joining us! We're excited to have you as part of our community. Your account has been successfully created.`,
      buttonText: 'Get Started'
    }
  };

  // Normalize role for roleMessages lookup (handles both string and array)
  const roleForLookup = Array.isArray(role) ? role[0] : role;
  const roleInfo = roleMessages[roleForLookup] || roleMessages.user;

  // HARDCODED: Consumers ALWAYS redirect to https://social.duhanashrah.ai/ - no exceptions
  // IGNORES website_url parameter and CLIENT_URL env var completely for consumers
  // This ensures consumers NEVER get admin panel URL, even if accidentally passed
  let finalWebsiteUrl;
  if (hasRole(role, 'consumer')) {
    finalWebsiteUrl = 'https://social.duhanashrah.ai/'; // Hardcoded - never use CLIENT_URL
    console.log('📧 Email Template - Consumer: Using HARDCODED URL (ignoring any passed URL):', finalWebsiteUrl);
  } else {
    finalWebsiteUrl = website_url || process.env.CLIENT_URL || "#";
  }

  const content = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 0 0 12px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          ${roleInfo.greeting}
        </td>
      </tr>
      <tr>
        <td style="padding: 0 0 20px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          ${roleInfo.message}
        </td>
      </tr>
    </table>

    <!-- Account Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Your Account Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Name:</strong> ${full_name}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Email:</strong> ${email}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Password:</strong> <span class="mono-num" style="background-color: #ffffff; padding: 4px 8px; font-weight: bold; color: #00B48D; font-family: 'Courier New', Courier, monospace;">${password}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
            For security, please change your password after logging in.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: roleInfo.title,
    subtitle: roleInfo.subtitle,
    content,
    buttonText: roleInfo.buttonText,
    buttonUrl: finalWebsiteUrl,
    footerText: 'If you didn\'t create this account, you can safely ignore this email.'
  });
};

/**
 * Password Reset Email Template
 */
export const PasswordResetTemplate = ({
  full_name = "User",
  new_password = "NewPassword123!",
  website_url = process.env.CLIENT_URL || "#",
} = {}) => {
  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      Your password has been successfully reset. Below is your new login password:
    </p>

    <!-- Password Info - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Your New Password
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Name:</strong> ${full_name}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>New Password:</strong> <span class="mono-num" style="background-color: #ffffff; padding: 4px 8px; font-weight: bold; color: #00B48D; font-family: 'Courier New', Courier, monospace;">${new_password}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
            For security, please change your password after logging in.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: 'Password Reset',
    subtitle: 'Your password has been updated',
    content
  });
};

/**
 * Trial Period Change Email Template
 */
export const TrialPeriodChangeTemplate = ({
  full_name = "User",
  old_trial_date = "2025-01-01",
  new_trial_date = "2025-01-08",
  website_url = process.env.CLIENT_URL || "#",
} = {}) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      Your trial period has been successfully updated! Here are the details:
    </p>

    <!-- Trial Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Trial Period Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Previous Expiry:</strong> ${formatDate(old_trial_date)}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>New Expiry:</strong> <span style="color: #00B48D; font-weight: bold;">${formatDate(new_trial_date)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
            Your trial has been extended. Enjoy all features until the new date!
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: 'Trial Period Updated',
    subtitle: 'Your trial has been extended',
    content,
    buttonText: 'Go to Dashboard',
    buttonUrl: `${website_url}/consumer/dashboard`
  });
};

/**
 * Trial Extension Email Template
 */
export const TrialExtensionTemplate = ({
  full_name = "User",
  new_trial_date = "2025-01-08",
  extension_days = 3,
  website_url = "#",
} = {}) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      Great news — your trial has been extended! We've added <strong>${extension_days} extra days</strong> to your trial period.
    </p>

    <!-- Extension Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Your Updated Trial Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>New Trial End Date:</strong> <span style="color: #00B48D; font-weight: bold;">${formatDate(new_trial_date)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Extended By:</strong> <span class="mono-num" style="color: #00B48D; font-weight: bold; font-family: 'Courier New', Courier, monospace;">${extension_days} days</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
            If you did not request this extension, please contact support immediately.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: 'Trial Extended 🎉',
    subtitle: 'Enjoy your extended trial',
    content,
    buttonText: 'Go to Dashboard',
    buttonUrl: `${website_url}/consumer/dashboard`
  });
};

/**
 * Invitation Email Template
 */
export const InviteEmailTemplate = ({
  full_name = "User",
  email = "user@example.com",
  role = "user",
  invite_url = "#",
  inviter_name = "Admin",
} = {}) => {
  const roleLabels = {
    user: "User",
    reseller: "Reseller",
    consumer: "Consumer"
  };

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      <strong style="color: #00B48D;">${inviter_name}</strong> has invited you to join as a <strong>${roleLabels[role] || role}</strong>. Complete your registration to get started!
    </p>

    <!-- Invitation Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Invitation Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Email:</strong> ${email}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Role:</strong> <span style="color: #00B48D; font-weight: bold;">${roleLabels[role] || role}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
            This invitation link expires in 7 days. Please complete your registration soon!
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: 'You\'re Invited!',
    subtitle: 'Join us today',
    content,
    buttonText: 'Accept Invitation',
    buttonUrl: invite_url
  });
};

/**
 * Invoice Created Email Template
 */
export const InvoiceCreatedTemplate = ({
  full_name = 'Customer',
  invoice_number = 'INV-0001',
  issue_date = '20 Nov 2025',
  due_date = '27 Nov 2025',
  subtotal = 0.0,
  tax_total = 0.0,
  total = 0.0,
  items = [], // [{ name, quantity, price, description? }]
  created_by_name = 'Admin',
  created_by_role = 'Administrator',
  website_url = '#',
  encrypted_data = null // Encrypted payment data
} = {}) => {

  if (!encrypted_data) {
    throw new Error('Encrypted payment data is required to generate payment URL');
  }

  const normalizedWebsiteUrl = website_url.replace(/\/+$/, '');
  const paymentUrl = `${normalizedWebsiteUrl}/payment?data=${encodeURIComponent(encrypted_data)}`;
  const invoiceUrl = `${normalizedWebsiteUrl}/invoice/${invoice_number}`;

  const formatCurrency = (amount) => {
    return `$${Number(amount).toFixed(2)}`;
  };

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      Thank you for your business! Here's your invoice summary:
    </p>

    <!-- Invoice Details Table -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0; border-collapse: collapse;">
      <tr style="background-color: #f9f9fb;">
        <td style="padding: 12px; border-bottom: 2px solid #e6e6ec; font-weight: bold; color: #232347;">Description</td>
        <td style="padding: 12px; border-bottom: 2px solid #e6e6ec; font-weight: bold; color: #232347; text-align: center;">Qty</td>
        <td style="padding: 12px; border-bottom: 2px solid #e6e6ec; font-weight: bold; color: #232347; text-align: right;">Price</td>
        <td style="padding: 12px; border-bottom: 2px solid #e6e6ec; font-weight: bold; color: #232347; text-align: right;">Amount</td>
      </tr>

      ${items.map(item => `
        <tr>
          <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f4; color: #232347;">
            <strong>${item.name || 'Item'}</strong>${item.description ? `<br/><span style="font-size: 14px; color: #66698c;">${item.description}</span>` : ''}
          </td>
          <td style="padding: 14px 12px; text-align: center;" class="mono-num">${item.quantity || 1}</td>
          <td style="padding: 14px 12px; text-align: right;" class="mono-num">${formatCurrency(item.price || 0)}</td>
          <td style="padding: 14px 12px; text-align: right;" class="mono-num">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
        </tr>
      `).join('')}

      <tr>
        <td colspan="3" style="padding: 12px; border-top: 2px solid #e6e6ec; text-align: right;">Subtotal:</td>
        <td style="padding: 12px; text-align: right;" class="mono-num">${formatCurrency(subtotal)}</td>
      </tr>
      <tr>
        <td colspan="3" style="padding: 8px 12px; text-align: right;">Tax:</td>
        <td style="padding: 8px 12px; text-align: right;" class="mono-num">${formatCurrency(tax_total)}</td>
      </tr>
      <tr style="background-color: #f9f9fb;">
        <td colspan="3" style="padding: 14px 12px; font-weight: bold; font-size: 18px; text-align: right;">Total Amount:</td>
        <td style="padding: 14px 12px; font-weight: bold; font-size: 18px; color: #00B48D; text-align: right;" class="mono-num">${formatCurrency(total)}</td>
      </tr>
    </table>

    <!-- Payment Info - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Payment Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Invoice #:</strong> <span class="mono-num" style="color: #00B48D; font-weight: bold; font-family: 'Courier New', Courier, monospace;">${invoice_number}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Issue Date:</strong> ${issue_date}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Due Date:</strong> ${due_date}
              </td>
            </tr>
            <tr>
              <td style="padding: 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          <strong>Created By:</strong> ${created_by_name} (${created_by_role})
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: `Invoice ${invoice_number}`,
    subtitle: `Date: ${issue_date}`,
    content,
    buttonText: 'Pay Now',
    buttonUrl: paymentUrl,
    footerText: `Questions about this invoice? Contact us at support@duhanashrah.ai`
  });
};

/**
 * Ticket Created Email Template
 */
export const TicketCreatedTemplate = ({
  full_name = 'Customer',
  ticket_number = 'TICKET-0001',
  subject = 'Support Request',
  message = 'Initial message',
  ticket_id = '',
  website_url = '#',
  attachments = [],
} = {}) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const normalizedWebsiteUrl = website_url.replace(/\/+$/, '');
  const viewTicketUrl = ticket_id 
    ? `${normalizedWebsiteUrl}/support-widget?ticket_id=${ticket_id}`
    : normalizedWebsiteUrl;

  // Truncate message if too long for email preview
  const messagePreview = message.length > 200 
    ? message.substring(0, 200) + '...'
    : message;

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format attachments list
  let attachmentsHtml = '';
  if (attachments && attachments.length > 0) {
    attachmentsHtml = `
      <tr>
        <td style="padding: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          <strong>Attachments:</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0 0 0; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
          <ul style="margin: 0; padding-left: 20px; color: #66698c;">
            ${attachments.map(att => `
              <li style="margin: 4px 0;">
                <a href="${att.file_url || att.file_path}" style="color: #00B48D; text-decoration: none;">${att.file_name}</a>
                ${att.file_size ? ` <span style="color: #999; font-size: 12px;">(${formatFileSize(att.file_size)})</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      Thank you for contacting our support team! We've received your support ticket and will get back to you soon.
    </p>

    <!-- Ticket Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Your Support Ticket Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Ticket Number:</strong> <span class="mono-num" style="color: #00B48D; font-weight: bold; font-family: 'Courier New', Courier, monospace;">${ticket_number}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Subject:</strong> ${subject}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Created:</strong> ${formatDate(new Date().toISOString())}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Your Message:</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0 0 0; color: #66698c; font-family: Verdana, Geneva, sans-serif; font-style: italic; border-left: 3px solid #00B48D; padding-left: 12px;">
                ${messagePreview}
              </td>
            </tr>
            ${attachmentsHtml}
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
                Our support team will review your ticket and respond as soon as possible. You can view and reply to your ticket using the button below.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: `Support Ticket Created: ${ticket_number}`,
    subtitle: `We've received your request`,
    content,
    buttonText: 'View Your Ticket',
    buttonUrl: viewTicketUrl,
    footerText: `Need immediate assistance? Reply to this email or contact us at info@duhanashrah.ai`
  });
};

/**
 * Ticket Created Admin Notification Email Template (for Superadmins)
 */
export const TicketCreatedAdminNotificationTemplate = ({
  ticket_number = 'TICKET-0001',
  subject = 'Support Request',
  message = 'Initial message',
  user_name = 'Customer',
  user_email = 'customer@example.com',
  priority = 'medium',
  category = 'general',
  ticket_id = '',
  website_url = '#',
  attachments = [],
} = {}) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const normalizedWebsiteUrl = website_url.replace(/\/+$/, '');
  const viewTicketUrl = ticket_id 
    ? `${normalizedWebsiteUrl}/customers?ticket_id=${ticket_id}`
    : normalizedWebsiteUrl;

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format attachments list
  let attachmentsHtml = '';
  if (attachments && attachments.length > 0) {
    attachmentsHtml = `
      <tr>
        <td style="padding: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          <strong>Attachments:</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0 0 0; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
          <ul style="margin: 0; padding-left: 20px; color: #66698c;">
            ${attachments.map(att => `
              <li style="margin: 4px 0;">
                <a href="${att.file_url || att.file_path}" style="color: #00B48D; text-decoration: none;">${att.file_name}</a>
                ${att.file_size ? ` <span style="color: #999; font-size: 12px;">(${formatFileSize(att.file_size)})</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">Superadmin</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      A new support ticket has been created and requires your review. Please review the ticket details below.
    </p>

    <!-- Ticket Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                New Ticket Details
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Ticket Number:</strong> <span class="mono-num" style="color: #00B48D; font-weight: bold; font-family: 'Courier New', Courier, monospace;">${ticket_number}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Subject:</strong> ${subject}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Created By:</strong> ${user_name} (${user_email})
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Priority:</strong> <span style="text-transform: capitalize; color: #00B48D; font-weight: bold;">${priority}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Category:</strong> ${category || 'General'}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Created:</strong> ${formatDate(new Date().toISOString())}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Message:</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0 0 0; color: #66698c; font-family: Verdana, Geneva, sans-serif; font-style: italic; border-left: 3px solid #00B48D; padding-left: 12px; white-space: pre-wrap;">
                ${message.replace(/\n/g, '<br>')}
              </td>
            </tr>
            ${attachmentsHtml}
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
                Please review this ticket and respond as soon as possible.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: `New Ticket Created: ${ticket_number}`,
    subtitle: `Action Required - Please Review`,
    content,
    buttonText: 'View & Respond to Ticket',
    buttonUrl: viewTicketUrl,
    footerText: `This is an automated notification. Please review the ticket in the admin panel.`
  });
};

/**
 * Ticket Status Changed Email Template
 */
export const TicketStatusChangedTemplate = ({
  full_name = 'Customer',
  ticket_number = 'TICKET-0001',
  old_status = 'open',
  new_status = 'in_progress',
  ticket_id = '',
  website_url = '#',
} = {}) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const statusLabels = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    pending: 'Pending'
  };

  const statusMessages = {
    open: 'Your ticket is now open and waiting for our team to review it.',
    in_progress: 'Our support team is now working on your ticket and will update you soon.',
    resolved: 'Your ticket has been resolved! Please let us know if you need any further assistance.',
    closed: 'Your ticket has been closed. If you need to reopen it, please create a new ticket.',
    pending: 'Your ticket is pending additional information. Please check for any updates from our team.'
  };

  const normalizedWebsiteUrl = website_url.replace(/\/+$/, '');
  const viewTicketUrl = ticket_id 
    ? `${normalizedWebsiteUrl}/support-widget?ticket_id=${ticket_id}`
    : normalizedWebsiteUrl;

  const statusMessage = statusMessages[new_status] || 'Your ticket status has been updated.';

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      We wanted to let you know that your support ticket status has been updated!
    </p>

    <!-- Status Change Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Ticket Status Update
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Ticket Number:</strong> <span class="mono-num" style="color: #00B48D; font-weight: bold; font-family: 'Courier New', Courier, monospace;">${ticket_number}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Previous Status:</strong> <span style="text-transform: capitalize;">${statusLabels[old_status] || old_status}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>New Status:</strong> <span style="color: #00B48D; font-weight: bold; text-transform: capitalize;">${statusLabels[new_status] || new_status}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Updated:</strong> ${formatDate(new Date().toISOString())}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
                ${statusMessage}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: `Ticket Status Updated: ${ticket_number}`,
    subtitle: `Status changed to ${statusLabels[new_status] || new_status}`,
    content,
    buttonText: 'View Your Ticket',
    buttonUrl: viewTicketUrl,
    footerText: `Have questions about this update? Reply to this email or contact us at info@duhanashrah.ai`
  });
};

/**
 * Ticket Reply Email Template (Admin Reply)
 */
export const TicketReplyTemplate = ({
  full_name = 'Customer',
  ticket_number = 'TICKET-0001',
  admin_name = 'Support Team',
  message = 'Reply message',
  attachments = [],
  ticket_id = '',
  website_url = '#',
} = {}) => {
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const normalizedWebsiteUrl = website_url.replace(/\/+$/, '');
  const viewTicketUrl = ticket_id 
    ? `${normalizedWebsiteUrl}/support-widget?ticket_id=${ticket_id}`
    : normalizedWebsiteUrl;

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format attachments list
  let attachmentsHtml = '';
  if (attachments && attachments.length > 0) {
    attachmentsHtml = `
      <tr>
        <td style="padding: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          <strong>Attachments:</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0 0 0; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
          <ul style="margin: 0; padding-left: 20px; color: #66698c;">
            ${attachments.map(att => `
              <li style="margin: 4px 0;">
                <a href="${att.file_url || att.file_path}" style="color: #00B48D; text-decoration: none;">${att.file_name}</a>
                ${att.file_size ? ` <span style="color: #999; font-size: 12px;">(${formatFileSize(att.file_size)})</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  const content = `
    <p style="margin: 0 0 12px 0; color: #232347;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    
    <p style="margin: 0 0 20px 0; color: #232347;">
      You have received a reply from <strong style="color: #00B48D;">${admin_name}</strong> regarding your support ticket.
    </p>

    <!-- Reply Details - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Reply from ${admin_name}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Ticket Number:</strong> <span class="mono-num" style="color: #00B48D; font-weight: bold; font-family: 'Courier New', Courier, monospace;">${ticket_number}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Replied on:</strong> ${formatDate(new Date().toISOString())}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                <strong>Message:</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0 0 0; color: #66698c; font-family: Verdana, Geneva, sans-serif; font-style: italic; border-left: 3px solid #00B48D; padding-left: 12px; white-space: pre-wrap;">
                ${message.replace(/\n/g, '<br>')}
              </td>
            </tr>
            ${attachmentsHtml}
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
                You can view the full conversation and reply to this ticket using the button below.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: `New Reply on Ticket: ${ticket_number}`,
    subtitle: `Reply from ${admin_name}`,
    content,
    buttonText: 'View & Reply to Ticket',
    buttonUrl: viewTicketUrl,
    footerText: `This is an automated notification from Duha Nashrah support team. Please do not reply directly to this email. Use the button above to reply to your ticket.`
  });
};

/**
 * Password Reset Magic Link Email Template
 * From social.duhanashrah.ai
 * @param {Object} params
 * @param {string} params.full_name - User's full name
 * @param {string} params.magic_link - Password reset magic link URL
 * @returns {string} HTML email template
 */
export const PasswordResetMagicLinkTemplate = ({
  full_name = "User",
  magic_link = "#",
} = {}) => {
  const content = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 0 0 12px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          Hello <strong style="color: #00B48D;">${full_name}</strong>,
        </td>
      </tr>
      <tr>
        <td style="padding: 0 0 20px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
          We received a request to reset your password for your social.duhanashrah.ai account. Click the button below to reset your password:
        </td>
      </tr>
    </table>

    <!-- Magic Link Info - Outlook compatible -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #00B48D;">
      <tr>
        <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Reset Your Password
              </td>
            </tr>
            <tr>
              <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                Click the button above to reset your password. This link will expire in 1 hour for security reasons.
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Alternative link (if button doesn't work) -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0 0 0;">
      <tr>
        <td style="padding: 0 0 8px 0; font-size: 14px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
          If the button doesn't work, copy and paste this link into your browser:
        </td>
      </tr>
      <tr>
        <td style="padding: 0; word-break: break-all; font-size: 13px; color: #00B48D; font-family: 'Courier New', Courier, monospace;">
          <a href="${magic_link}" style="color: #00B48D; text-decoration: underline;">${magic_link}</a>
        </td>
      </tr>
    </table>
  `;

  return BaseEmailTemplate({
    title: 'Reset Your Password',
    subtitle: 'Password reset request from social.duhanashrah.ai',
    content,
    buttonText: 'Reset Password',
    buttonUrl: magic_link,
    footerText: 'This email was sent from social.duhanashrah.ai. If you didn\'t request a password reset, please ignore this email.'
  });
};

/**
 * Call Logs Report Email Template
 */
export const CallLogsReportTemplate = ({
  full_name = 'Agent',
  campaign_name = 'Call Logs',
  call_count = 0,
  website_url = '#',
} = {}) => {
  const content = `
    <p style="margin: 0 0 12px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
      Hello <strong style="color: #00B48D;">${full_name}</strong>,
    </p>
    <p style="margin: 0 0 12px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
      Your dialer list <strong>"${campaign_name}"</strong> has been completed successfully!
    </p>
    <p style="margin: 0 0 12px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
      We've generated a comprehensive report with all call information. The Excel file is attached to this email.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 12px; background-color: #f8f9fa; border-radius: 8px; font-family: Verdana, Geneva, sans-serif;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #232347; font-weight: 600;">Campaign/List:</td>
              <td style="padding: 4px 0; color: #66698c;">${campaign_name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #232347; font-weight: 600;">Total Calls:</td>
              <td style="padding: 4px 0; color: #66698c;">${call_count}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #232347; font-weight: 600;">Report Date:</td>
              <td style="padding: 4px 0; color: #66698c;">${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 12px 0 0 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
      The attached Excel file contains all information about each call, including:
    </p>
    <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
      <li>Contact name and phone number</li>
      <li>Call status (completed, failed, etc.)</li>
      <li>Call duration and timestamps</li>
      <li>Lead status</li>
      <li>Call transcript (if available)</li>
      <li>Bot name and agent information</li>
    </ul>
  `;

  return BaseEmailTemplate({
    title: `Call Logs Report: ${campaign_name}`,
    subtitle: `Your dialer list has been completed`,
    content,
    footerText: `Questions about your call logs? Contact us at info@duhanashrah.ai`
  });
};

/**
 * Email Verification Template (new design)
 * Uses the provided HTML/CSS design. Placeholders: `full_name`, `token`, `confirmation_url`.
 */
export const EmailVerificationTemplate = ({
  full_name = 'User',
  token = '123456',
  confirmation_url = '#'
} = {}) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email Verification - DuhaNashrah ai</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #f4f5f7;
    font-family: 'Manrope', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #333333;
  }
  .wrapper {
    width: 100%;
    table-layout: fixed;
    background-color: #f4f5f7;
    padding: 40px 20px;
    box-sizing: border-box;
    font-family: 'Manrope', Arial, sans-serif;
  }
  .main-container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    font-family: 'Manrope', Arial, sans-serif;
  }
  .header-table {
    width: 100%;
    border-collapse: collapse;
  }
  .contact-btn {
    color: #00B48D;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
  }
  .content {
    padding: 20px 40px;
  }
  .title {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    color: #111111;
    margin: 0 0 30px 0;
  }
  .greeting {
    font-size: 16px;
    margin-bottom: 15px;
  }
  .message {
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 25px;
    color: #444444;
  }
  .code-container {
    background-color: #F1F1F1; 
    border-radius: 8px;
    padding: 14px 25px;
    margin: 30px auto;
    text-align: center;
    display: inline-block;
  }
  .code-box {
    width: 45px;
    height: 55px;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    display: inline-block;
    text-align: center;
    line-height: 55px;
    font-size: 26px;
    font-weight: 700;
    color: #111111;
    margin: 5px;
    vertical-align: middle;
    font-family: 'Manrope', Arial, sans-serif;
  }
  .expire-text {
    text-align: center;
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 30px;
  }
  .help-text {
    font-size: 15px;
    line-height: 1.6;
    color: #555555;
    margin-bottom: 20px;
  }
  .link {
    color: #00B48D;
    text-decoration: none;
    font-weight: 500;
  }
  .signature {
    font-size: 16px;
    line-height: 1.6;
    color: #444444;
    margin-bottom: 40px;
  }
  .footer-area {
    position: relative;
    background-color: #ffffff;
    margin-top: 20px;
  }
  .green-footer {
    background-color: #00B48D;
    padding: 30px 20px 25px;
    text-align: center;
    color: #ffffff;
    position: relative;
    overflow: hidden;
    border-top-left-radius: 90% 100%;
    border-top-right-radius: 90% 100% ;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }
  .footer-img-left {
    width: 150px;
    max-width: 100%;
    height: auto;
    display: block;
  }
  .footer-img-right {
    width: 180px;
    max-width: 100%;
    height: auto;
    display: block;
  }
  .footer-cell-left {
    padding-left: 20px;
  }
  .footer-cell-right {
    padding-right: -20px;
  }
  .footer-logo {
    font-family: 'Manrope', Arial, sans-serif;
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 15px 0;
  }
  .social-icons {
    text-align: center;
    margin-bottom: 15px;
  }
  .social-icon {
    display: inline-block;
    text-align: center;
    line-height: 32px;
    color: #ffffff;
    text-decoration: none;
    margin: 0 8px;
  }
  .social-icon img {
    width: 30px;
    height: 30px;
    vertical-align: middle;
    border: 0;
    display: inline-block;
    margin-top: -3px;
  }
  .copyright {
    font-size: 14px;
    opacity: 0.9;
  }
  @media only screen and (max-width: 600px) {
    .wrapper { padding: 20px 10px; }
    .content { padding: 20px 20px; }
    .code-container { padding: 14px 20px; gap: 10px; }
    .code-box { width: 40px; height: 50px; font-size: 24px; }
    .footer-img-left { width: 120px; }
    .footer-img-right { width: 130px; }
  }

  @media only screen and (max-width: 480px) {
    .title { font-size: 22px; margin: 0 0 20px 0; }
    .code-container { padding: 14px 10px; gap: 6px; }
    .code-box { width: 35px; height: 45px; font-size: 22px; }
    .green-footer { padding: 40px 15px 20px; border-top-left-radius: 50% 40px; border-top-right-radius: 50% 40px; }
    .footer-img-left { width: 100px; }
    .footer-img-right { width: 115px; }
    .footer-cell-left { padding-left: 10px; }
    .footer-cell-right { padding-right: 10px; }
  }
  
  @media only screen and (max-width: 360px) {
    .code-container { padding: 12px 5px; gap: 4px; }
    .code-box { width: 30px; height: 40px; font-size: 20px; }
    .footer-img-left { width: 80px; }
    .footer-img-right { width: 95px; }
    .footer-cell-left { padding-left: 5px; }
    .footer-cell-right { padding-right: 5px; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="main-container">
    <!-- Header Table -->
    <table class="header-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; padding: 30px 40px 10px;">
      <tr>
        <td align="left" valign="middle">
          <div class="logo">
            <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/DnaiLogo.png" alt="DNAi Duha Nashrah" style="height: 45px; width: auto; border: 0;" />
          </div>
        </td>
        <td align="right" valign="middle">
          <a href="https://social.duhanashrah.ai/contact" class="contact-btn">Contact Us</a>
        </td>
      </tr>
    </table>
    <div class="content">
      <h1 class="title">Email Verification</h1>
      <div class="greeting">Hello ${full_name},</div>
      <div class="message">Your account is nearly set up. Please use this code to verify your email address.</div>
     <div style="text-align: center; margin: 30px 0;">
  <div class="code-container">
    <div class="code-box" style="width:auto;padding:0 20px;letter-spacing:12px;">
      ${token}
    </div>
  </div>
</div>
      <div class="expire-text"><strong>Code will expire in 5 minutes.</strong></div>
      <div class="help-text">Code expired? Please <a href="#" class="link">sign up</a> again to get a new code.</div>
      <div class="help-text">If you're having issues with email verification or creating an account, please <a href="#" class="link">Contact Us</a> If you did not make this request, you can ignore this email. No account will be created.</div>
<div class="help-text">
If you're having issues verifying your email, you can also click the link below:
</div>

<div style="text-align:center;margin-bottom:30px;">
<a href="${confirmation_url}" style="background:#00B48D;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
Verify Email
</a>
</div>
      <div class="signature">Thank you,<br>The DuhaNashrah Team</div>
    </div>
    <div class="footer-area">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: -50px; position: relative; z-index: 10;">
        <tr>
          <td align="left" valign="bottom" class="footer-cell-left">
            <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/beeba.png" alt="Beeba" class="footer-img-left" />
          </td>
          <td align="right" valign="bottom" class="footer-cell-right">
            <img src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/styling-image/genie.png" alt="Genie" class="footer-img-right" />
          </td>
        </tr>
      </table>
      <div class="green-footer">
        <h2 class="footer-logo" style="margin-top: 20px;">DuhaNashrah ai</h2>
        
        <div class="social-icons">
          <a href="#" class="social-icon" aria-label="Facebook">
            <img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" alt="Facebook" />
          </a>
          <a href="#" class="social-icon" aria-label="Twitter">
            <img src="https://img.icons8.com/ios-filled/50/ffffff/twitter.png" alt="Twitter" />
          </a>
          <a href="#" class="social-icon" aria-label="Instagram">
            <img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" alt="Instagram" />
          </a>
        </div>
        
        <div class="copyright">© 2026 DuhaNashrah ai</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

  return html;
}

export default { 
  AdminEmailTemplateUserCreated, 
  PasswordResetTemplate, 
  PasswordResetMagicLinkTemplate,
  TrialPeriodChangeTemplate, 
  TrialExtensionTemplate, 
  InviteEmailTemplate,
  InvoiceCreatedTemplate,
  TicketCreatedTemplate,
  TicketCreatedAdminNotificationTemplate,
  TicketStatusChangedTemplate,
  TicketReplyTemplate,
  CallLogsReportTemplate,
  EmailVerificationTemplate
};
export { AdminEmailTemplateUserCreated as _Admin, PasswordResetTemplate as _Reset, EmailVerificationTemplate as _Verify };
