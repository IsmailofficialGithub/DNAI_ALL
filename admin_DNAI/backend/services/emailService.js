import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import {
  AdminEmailTemplateUserCreated,
  PasswordResetTemplate,
  PasswordResetMagicLinkTemplate,
  TrialPeriodChangeTemplate,
  TrialExtensionTemplate,
  InvoiceCreatedTemplate,
  InviteEmailTemplate,
  TicketCreatedTemplate,
  TicketCreatedAdminNotificationTemplate,
  TicketStatusChangedTemplate,
  TicketReplyTemplate,
  CallLogsReportTemplate,
} from "../utils/emailTemplates.js";
import { encryptPaymentData } from "../utils/encryption.js";

dotenv.config();

/**
 * Email Service for sending transactional emails via SendGrid
 */

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL = process.env.AdminEmail || "no-reply@duhanashrah.ai";
const Support_Sender_Email = process.env.Support_Sender_Email || "support@duhanashrah.ai";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("⚠️  SENDGRID_API_KEY not found in environment variables");
}

/**
 * Send welcome email to new user
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.password - Temporary password
 * @param {string} params.role - User role (user, reseller, consumer, admin)
 * @returns {Promise<Object>} Email send result
 */
import { hasRole } from '../utils/roleUtils.js';

export const sendWelcomeEmail = async ({ email, full_name, password, role = ['user'] }) => {
  try {
    // HARDCODED: Consumers ALWAYS use https://social.duhanashrah.ai/ - no exceptions
    // CLIENT_URL is the admin panel URL - we NEVER use it for consumers
    // This ensures consumers never get redirected to admin panel, regardless of env vars
    const website_url = hasRole(role, 'consumer') 
      ? 'https://social.duhanashrah.ai/'  // Hardcoded - ignores CLIENT_URL completely
      : (process.env.CLIENT_URL || "");   // Only non-consumers use CLIENT_URL (admin panel)

    // Debug log to verify consumer URL is set correctly
    if (hasRole(role, 'consumer')) {
      console.log('🔗 Consumer email - Using HARDCODED URL (CLIENT_URL ignored):', website_url);
    }

    const htmlContent = AdminEmailTemplateUserCreated({
      full_name,
      email,
      password,
      role,
      website_url,
    });

    // Role-based subject line
    const roleSubjects = {
      consumer: `Your DNAI account has been created`,
      reseller: `Your DNAI Reseller account has been created`,
      admin: `Welcome Administrator: ${full_name}`,
      user: `New User Created: ${full_name}`
    };

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: roleSubjects[role] || roleSubjects.user,
      html: htmlContent,
    };

    console.log(`📧 Sending custom welcome email to ${role}:`, email);
    await sgMail.send(msg);
    console.log("✅ Welcome email sent successfully");

    return {
      success: true,
      message: "Welcome email sent successfully",
      email,
    };
  } catch (error) {
    console.error("❌ Error sending welcome email:", error.response?.body || error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.new_password - New password
 * @returns {Promise<Object>} Email send result
 */
export const sendPasswordResetEmail = async ({
  email,
  full_name,
  new_password,
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = PasswordResetTemplate({
      full_name,
      new_password,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: `Password Reset: ${full_name}`,
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
 * Send password reset magic link email (from social.duhanashrah.ai)
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.magic_link - Magic link URL for password reset
 * @returns {Promise<Object>} Email send result
 */
export const sendPasswordResetMagicLinkEmail = async ({
  email,
  full_name,
  magic_link,
}) => {
  try {
    const htmlContent = PasswordResetMagicLinkTemplate({
      full_name: full_name || email.split('@')[0],
      magic_link,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "no-reply@duhanashrah.ai"
      },
      subject: `Reset Your Password - no-reply@duhanashrah.ai`,
      html: htmlContent,
    };

    console.log("📧 Sending password reset magic link email to:", email);
    await sgMail.send(msg);
    console.log("✅ Password reset magic link email sent successfully");

    return {
      success: true,
      message: "Password reset magic link email sent successfully",
      email,
    };
  } catch (error) {
    console.error("❌ Error sending password reset magic link email:", error.response?.body || error);
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
      "⚠️  Email service will not work. Please configure SENDGRID_API_KEY and AdminEmail in .env"
    );
    return false;
  }
};

/**
 * Send trial period change email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.old_trial_date - Previous trial expiry date
 * @param {string} params.new_trial_date - New trial expiry date
 * @returns {Promise<Object>} Email send result
 */
export const sendTrialPeriodChangeEmail = async ({
  email,
  full_name,
  old_trial_date,
  new_trial_date,
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = TrialPeriodChangeTemplate({
      full_name,
      old_trial_date,
      new_trial_date,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: `Trial Period Updated: ${full_name}`,
      html: htmlContent,
    };

    console.log("📧 Sending trial period change email to:", email);
    await sgMail.send(msg);
    console.log("✅ Trial period change email sent successfully");

    return {
      success: true,
      message: "Trial period change email sent successfully",
      email,
    };
  } catch (error) {
    console.error("❌ Error sending trial period change email:", error.response?.body || error);
    throw error;
  }
};

/**
 * Send trial extension email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.new_trial_date - New trial expiry date
 * @param {number} params.extension_days - Number of days extended
 * @returns {Promise<Object>} Email send result
 */
export const sendTrialExtensionEmail = async ({
  email,
  full_name,
  new_trial_date,
  extension_days,
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = TrialExtensionTemplate({
      full_name,
      new_trial_date,
      extension_days,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: `Trial Extended: ${full_name}`,
      html: htmlContent,
    };

    console.log("📧 Sending trial extension email to:", email);
    await sgMail.send(msg);
    console.log("✅ Trial extension email sent successfully");

    return {
      success: true,
      message: "Trial extension email sent successfully",
      email,
    };
  } catch (error) {
    console.error("❌ Error sending trial extension email:", error.response?.body || error);
    throw error;
  }
};

/**
 * Send invitation email to user
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.role - User role (user, reseller, consumer)
 * @param {string} params.invite_url - Invitation signup URL with token
 * @param {string} params.inviter_name - Name of person who sent the invite
 * @returns {Promise<Object>} Email send result
 */
export const sendInviteEmail = async ({
  email,
  role = 'user',
  invite_url,
  inviter_name = 'Admin',
}) => {
  try {
    const website_url = process.env.CLIENT_URL 

    const htmlContent = InviteEmailTemplate({
      email,
      role,
      invite_url,
      website_url,
      inviter_name,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: `You're Invited to Join as ${role.charAt(0).toUpperCase() + role.slice(1)}!`,
      html: htmlContent,
    };

    console.log("📧 Sending invitation email to:", email);
    await sgMail.send(msg);
    console.log("✅ Invitation email sent successfully");

    return {
      success: true,
      message: "Invitation email sent successfully",
      email,
    };
  } catch (error) {
    console.error("❌ Error sending invitation email:", error.response?.body || error);
    throw error;
  }
};

/**
 * Send invoice created email
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.full_name
 * @param {string} params.invoice_number
 * @param {string|number} params.total
 * @param {string} params.due_date
 */
export const sendInvoiceCreatedEmail = async ({ 
  email, 
  full_name, 
  invoice_number, 
  invoice_id = '', 
  user_id = '', 
  issue_date, 
  due_date, 
  subtotal, 
  tax_total, 
  total, 
  items = [], 
  created_by_name = 'Admin', 
  created_by_role = 'admin' 
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";
    
    // Encrypt payment data for secure URL (required)
    if (!invoice_id || !user_id || !invoice_number || !total) {
      throw new Error('Missing required invoice data for payment link encryption');
    }
    
    let encryptedData;
    try {
      encryptedData = encryptPaymentData({
        amount: typeof total === 'number' ? total.toFixed(2) : String(total),
        invoice_id,
        user_id,
        invoice_number
      });
    } catch (encryptError) {
      console.error('Error encrypting payment data:', encryptError);
      throw new Error('Failed to encrypt payment data. Cannot send invoice email.');
    }
    
    const htmlContent = InvoiceCreatedTemplate({
      full_name,
      invoice_number,
      invoice_id: invoice_id || '',
      user_id: user_id || '',
      issue_date,
      subtotal,
      tax_total,
      total: typeof total === 'number' ? total.toFixed(2) : String(total),
      due_date,
      items,
      created_by_name,
      created_by_role,
      website_url,
      encrypted_data: encryptedData,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: `Invoice Created: ${invoice_number}`,
      html: htmlContent,
    };

    console.log("📧 Sending invoice created email to:", email);
    await sgMail.send(msg);
    console.log("✅ Invoice created email sent successfully");
    
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending invoice created email:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket created email
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.ticket_number - Ticket number
 * @param {string} params.subject - Ticket subject
 * @param {string} params.message - Initial ticket message
 * @param {string} params.ticket_id - Ticket ID (optional, for link generation)
 */
export const sendTicketCreatedEmail = async ({
  email,
  full_name,
  ticket_number,
  subject,
  message,
  ticket_id = '',
  attachments = [],
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = TicketCreatedTemplate({
      full_name: full_name || email.split('@')[0],
      ticket_number,
      subject,
      message,
      ticket_id,
      website_url,
      attachments,
    });

    const msg = {
      to: email,
      from: {
        email: Support_Sender_Email,
        name: "DuhaNashrahAi"
      },
      subject: `Support Ticket Created: ${ticket_number}`,
      html: htmlContent,
    };

    console.log("📧 Sending ticket created email to:", email);
    await sgMail.send(msg);
    console.log("✅ Ticket created email sent successfully");

    return { success: true };
  } catch (error) {
    console.error("❌ Error sending ticket created email:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket created notification email to superadmins
 * @param {Object} params
 * @param {string} params.email - Superadmin email
 * @param {string} params.ticket_number - Ticket number
 * @param {string} params.subject - Ticket subject
 * @param {string} params.message - Initial ticket message
 * @param {string} params.user_name - Ticket creator's name
 * @param {string} params.user_email - Ticket creator's email
 * @param {string} params.priority - Ticket priority
 * @param {string} params.category - Ticket category
 * @param {string} params.ticket_id - Ticket ID (optional, for link generation)
 * @param {Array} params.attachments - Array of attachment objects
 */
export const sendTicketCreatedAdminNotification = async ({
  email,
  ticket_number,
  subject,
  message,
  user_name,
  user_email,
  priority = 'medium',
  category = 'general',
  ticket_id = '',
  attachments = [],
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = TicketCreatedAdminNotificationTemplate({
      ticket_number,
      subject,
      message,
      user_name,
      user_email,
      priority,
      category,
      ticket_id,
      website_url,
      attachments,
    });

    const msg = {
      to: email,
      from: {
        email: Support_Sender_Email,
        name: "DuhaNashrahAi"
      },
      subject: `New Ticket Created: ${ticket_number} - Action Required`,
      html: htmlContent,
    };

    console.log("📧 Sending ticket created admin notification to:", email);
    await sgMail.send(msg);
    console.log("✅ Ticket created admin notification sent successfully");

    return { success: true };
  } catch (error) {
    console.error("❌ Error sending ticket created admin notification:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket status changed email
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.ticket_number - Ticket number
 * @param {string} params.old_status - Previous ticket status
 * @param {string} params.new_status - New ticket status
 * @param {string} params.ticket_id - Ticket ID (optional, for link generation)
 */
export const sendTicketStatusChangedEmail = async ({
  email,
  full_name,
  ticket_number,
  old_status,
  new_status,
  ticket_id = '',
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = TicketStatusChangedTemplate({
      full_name: full_name || email.split('@')[0],
      ticket_number,
      old_status,
      new_status,
      ticket_id,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: Support_Sender_Email,
        name: "DuhaNashrahAi"
      },
      subject: `Ticket Status Updated: ${ticket_number}`,
      html: htmlContent,
    };

    console.log("📧 Sending ticket status changed email to:", email);
    await sgMail.send(msg);
    console.log("✅ Ticket status changed email sent successfully");
    
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending ticket status changed email:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket reply email (admin reply)
 * @param {Object} params
 * @param {string} params.email - Recipient email (ticket owner)
 * @param {string} params.full_name - Ticket owner's full name
 * @param {string} params.ticket_number - Ticket number
 * @param {string} params.admin_name - Admin's name who replied
 * @param {string} params.message - Reply message
 * @param {Array} params.attachments - Array of attachment objects with file_name, file_url, file_size
 * @param {string} params.ticket_id - Ticket ID (optional, for link generation)
 */
export const sendTicketReplyEmail = async ({
  email,
  full_name,
  ticket_number,
  admin_name,
  message,
  attachments = [],
  ticket_id = '',
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = TicketReplyTemplate({
      full_name: full_name || email.split('@')[0],
      ticket_number,
      admin_name,
      message,
      attachments,  // Attachments are included as clickable links in the email body
      ticket_id,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: Support_Sender_Email,
        name: "DuhaNashrahAi"
      },
      subject: `New Reply on Ticket ${ticket_number} from ${admin_name}`,
      html: htmlContent,
    };

    console.log("📧 Sending ticket reply email to:", email);
    await sgMail.send(msg);
    console.log("✅ Ticket reply email sent successfully");
    
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending ticket reply email:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

/**
 * Send call logs report email with Excel attachment
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.full_name - User's full name
 * @param {string} params.campaign_name - Campaign/list name
 * @param {number} params.call_count - Number of calls in report
 * @param {Buffer} params.excel_buffer - Excel file buffer
 * @param {string} params.filename - Excel filename
 * @returns {Promise<Object>} Email send result
 */
export const sendCallLogsReportEmail = async ({
  email,
  full_name,
  campaign_name,
  call_count,
  excel_buffer,
  filename,
}) => {
  try {
    const website_url = process.env.CLIENT_URL || "dev.duhanashrah.ai";

    const htmlContent = CallLogsReportTemplate({
      full_name: full_name || email.split('@')[0],
      campaign_name,
      call_count,
      website_url,
    });

    const msg = {
      to: email,
      from: {
        email: SENDER_EMAIL,
        name: "DuhaNashrahAi"
      },
      subject: `Call Logs Report: ${campaign_name}`,
      html: htmlContent,
      attachments: [
        {
          content: excel_buffer.toString('base64'),
          filename: filename,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          disposition: 'attachment',
        },
      ],
    };

    console.log("📧 Sending call logs report email to:", email);
    await sgMail.send(msg);
    console.log("✅ Call logs report email sent successfully");

    return { success: true };
  } catch (error) {
    console.error("❌ Error sending call logs report email:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

/**
 * Send custom email with HTML content
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.from - Sender email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content of the email
 * @returns {Promise<Object>} Email send result
 */
export const sendCustomEmail = async ({ to, from, subject, html }) => {
  try {
    if (!to || !from || !subject || !html) {
      throw new Error('Missing required fields: to, from, subject, html');
    }

    const msg = {
      to: to,
      from: {
        email: from,
        name: "DuhaNashrahAi"
      },
      subject: subject,
      html: html,
    };

    console.log(`📧 Sending custom email to ${to} from ${from}`);
    await sgMail.send(msg);
    console.log("✅ Custom email sent successfully");

    return {
      success: true,
      message: "Email sent successfully",
      to,
      from,
      subject,
    };
  } catch (error) {
    console.error("❌ Error sending custom email:", error.response?.body || error);
    throw error;
  }
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetMagicLinkEmail,
  sendTrialPeriodChangeEmail,
  sendTrialExtensionEmail,
  sendInviteEmail,
  sendInvoiceCreatedEmail,
  sendTicketCreatedEmail,
  sendTicketCreatedAdminNotification,
  sendTicketStatusChangedEmail,
  sendTicketReplyEmail,
  sendCustomEmail,
  testEmailConfiguration,
};