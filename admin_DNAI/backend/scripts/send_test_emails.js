import nodemailer from 'nodemailer';
import templatesDefault, * as templates from '../utils/emailTemplates.js';

// Usage: node scripts/send_test_emails.js target@example.com [TemplateName,OtherTemplate]
const [, , targetEmail, templatesArg] = process.argv;

if (!targetEmail) {
  console.error('Usage: node scripts/send_test_emails.js target@example.com [TemplateName,OtherTemplate]');
  process.exit(1);
}

// SMTP config from env
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
let FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@duhanashrah.ai';

let transporter;
let usingEthereal = false;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  console.warn('SMTP configuration not fully provided — creating Ethereal test account (emails will not be delivered to real inboxes).');
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
  usingEthereal = true;
  // If not set, override FROM_EMAIL to Ethereal user for testing visibility
  if (!process.env.FROM_EMAIL) {
    // note: Ethereal inboxes accept any from, but using the test account makes preview clearer
    FROM_EMAIL = testAccount.user;
  }
} else {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE || (SMTP_PORT === 465),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}


// Prepare list of template functions to send
let templateNames = Object.keys(templatesDefault || {}).filter(k => typeof templatesDefault[k] === 'function');
if (templatesArg) {
  const requested = templatesArg.split(',').map(s => s.trim()).filter(Boolean);
  templateNames = templateNames.filter(n => requested.includes(n));
  if (templateNames.length === 0) {
    console.error('No matching templates found for:', requested);
    process.exit(3);
  }
}

// Sample args for templates that need special params
const sampleArgs = {
  AdminEmailTemplateUserCreated: { full_name: 'Alice Example', email: 'alice@example.com', password: 'Demo@123', role: 'user', website_url: process.env.CLIENT_URL || 'https://example.com' },
  PasswordResetTemplate: { full_name: 'Alice Example', new_password: 'NewPass123!' },
  PasswordResetMagicLinkTemplate: { full_name: 'Alice Example', magic_link: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/reset` : 'https://example.com/reset' },
  TrialPeriodChangeTemplate: { full_name: 'Alice Example', old_trial_date: '2025-01-01', new_trial_date: '2025-01-08', website_url: process.env.CLIENT_URL || 'https://example.com' },
  TrialExtensionTemplate: { full_name: 'Alice Example', new_trial_date: '2025-01-08', extension_days: 3, website_url: process.env.CLIENT_URL || 'https://example.com' },
  InviteEmailTemplate: { full_name: 'Alice Example', email: targetEmail, role: 'user', invite_url: process.env.CLIENT_URL || 'https://example.com/invite', inviter_name: 'Admin' },
  InvoiceCreatedTemplate: { full_name: 'Alice Example', invoice_number: 'INV-TEST-001', issue_date: '01 Jun 2026', due_date: '08 Jun 2026', subtotal: 100, tax_total: 10, total: 110, items: [{ name: 'Service', quantity: 1, price: 100 }], created_by_name: 'Admin', created_by_role: 'Administrator', website_url: process.env.CLIENT_URL || 'https://example.com', encrypted_data: 'test-encrypted' },
  TicketCreatedTemplate: { full_name: 'Alice Example', ticket_number: 'TICKET-TEST-01', subject: 'Testing', message: 'This is a test ticket', ticket_id: 'ticket-test-01', website_url: process.env.CLIENT_URL || 'https://example.com', attachments: [] },
  TicketCreatedAdminNotificationTemplate: { ticket_number: 'TICKET-TEST-01', subject: 'Testing', message: 'This is a test ticket', user_name: 'Alice Example', user_email: targetEmail, priority: 'high', category: 'general', ticket_id: 'ticket-test-01', website_url: process.env.CLIENT_URL || 'https://example.com', attachments: [] },
  TicketStatusChangedTemplate: { full_name: 'Alice Example', ticket_number: 'TICKET-TEST-01', old_status: 'open', new_status: 'in_progress', ticket_id: 'ticket-test-01', website_url: process.env.CLIENT_URL || 'https://example.com' },
  TicketReplyTemplate: { full_name: 'Alice Example', ticket_number: 'TICKET-TEST-01', admin_name: 'Support Team', message: 'This is a reply', attachments: [], ticket_id: 'ticket-test-01', website_url: process.env.CLIENT_URL || 'https://example.com' },
  PasswordResetMagicLinkTemplate: { full_name: 'Alice Example', magic_link: process.env.CLIENT_URL || 'https://example.com/reset' },
  CallLogsReportTemplate: { full_name: 'Alice Example', campaign_name: 'Test Campaign', call_count: 5, website_url: process.env.CLIENT_URL || 'https://example.com' },
  EmailVerificationTemplate: { full_name: 'Alice Example', token: 'ABC123', confirmation_url: process.env.CLIENT_URL || 'https://example.com/confirm' }
};

(async () => {
  for (const name of templateNames) {
    try {
      const fn = templatesDefault[name];
      if (typeof fn !== 'function') continue;
      const args = sampleArgs[name] || {};
      let html;
      try {
        html = fn(args);
      } catch (e) {
        console.error(`Error generating template ${name}:`, e.message);
        continue;
      }

      const mail = {
        from: FROM_EMAIL,
        to: targetEmail,
        subject: `${name} - Test Email`,
        html
      };

      const info = await transporter.sendMail(mail);
      console.log(`Sent ${name} -> ${targetEmail}  MessageId: ${info.messageId}`);
      // If using Ethereal, print preview URL
      try {
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) console.log(`Preview URL for ${name}: ${preview}`);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Failed to send:', name, err && err.message ? err.message : err);
    }
  }
  console.log('All done.');
})();

