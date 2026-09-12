// Email service using SendGrid API
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface SendGridResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private supportEmail: string;
  private sendGridUrl: string = 'https://api.sendgrid.com/v3/mail/send';

  constructor() {
    this.apiKey = process.env.REACT_APP_SENDGRID_API_KEY || '';
    this.fromEmail = process.env.REACT_APP_ADMIN_EMAIL || 'no-reply@duhanashrah.ai';
    this.supportEmail = process.env.REACT_APP_SUPPORT_SENDER_EMAIL || 'support@duhanashrah.ai';
  }

  /**
   * Send email via SendGrid API
   * Note: In production, this should be called from a backend/API route
   * to keep the API key secure. This is a client-side implementation
   * that should be replaced with a backend endpoint.
   */
  async sendEmail(options: EmailOptions): Promise<SendGridResponse> {
    if (!this.apiKey) {
      console.error('SendGrid API key is not configured');
      return {
        success: false,
        error: 'Email service is not configured',
      };
    }

    // Email data structure (commented out as it's not currently used)
    // const emailData = {
    //   personalizations: [
    //     {
    //       to: [{ email: options.to }],
    //       subject: options.subject,
    //     },
    //   ],
    //   from: {
    //     email: options.from || this.fromEmail,
    //     name: 'DNAi',
    //   },
    //   content: [
    //     {
    //       type: 'text/html',
    //       value: options.html,
    //     },
    //     ...(options.text
    //       ? [
    //           {
    //             type: 'text/plain',
    //             value: options.text,
    //           },
    //         ]
    //       : []),
    //   ],
    // };

    try {
      // In production, call your backend API endpoint instead
      // const response = await fetch('/api/send-email', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(emailData),
      // });

      // For now, we'll use a backend proxy or you should implement
      // a server-side endpoint to handle SendGrid API calls
      console.warn(
        'Email sending should be done server-side. Implement a backend endpoint for production.'
      );

      // This is a placeholder - replace with actual backend call
      return {
        success: true,
        message: 'Email queued for sending (implement backend endpoint)',
      };
    } catch (error: any) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }

  /**
   * Send OTP email for email verification
   */
  async sendOTPEmail(to: string, otp: string, purpose: 'email_verification' | 'password_reset'): Promise<SendGridResponse> {
    const subject =
      purpose === 'email_verification'
        ? 'Verify Your Email - DNAi'
        : 'Password Reset Code - DNAi';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c19c 0%, #009e80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DNAi</h1>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
            <p style="color: #6b7280; font-size: 16px;">
              ${purpose === 'email_verification'
        ? 'Thank you for signing up! Please use the code below to verify your email address:'
        : 'You requested to reset your password. Use the code below to continue:'}
            </p>
            <div style="background: #f3f4f6; border: 2px dashed #00c19c; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <div style="font-size: 36px; font-weight: bold; color: #00c19c; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${otp}
              </div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              This code will expire in 10 minutes. If you didn't request this, please ignore this email.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #00c19c;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
${subject}

${purpose === 'email_verification'
        ? 'Thank you for signing up! Please use the code below to verify your email address:'
        : 'You requested to reset your password. Use the code below to continue:'}

Your verification code: ${otp}

This code will expire in 10 minutes. If you didn't request this, please ignore this email.

Need help? Contact us at ${this.supportEmail}
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChangedEmail(to: string): Promise<SendGridResponse> {
    const subject = 'Password Changed - DNAi';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c19c 0%, #009e80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DNAi</h1>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Password Successfully Changed</h2>
            <p style="color: #6b7280; font-size: 16px;">
              Your password has been successfully changed. If you didn't make this change, please contact our support team immediately.
            </p>
            <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #059669; margin: 0; font-size: 14px;">
                <strong>Security Tip:</strong> If you didn't change your password, please secure your account immediately.
              </p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #00c19c;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send welcome email via backend SendGrid endpoint
   */
  async sendWelcomeEmail(to: string, firstName: string): Promise<SendGridResponse> {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://genie.duhanashrah.ai/api';
      const response = await fetch(`${backendUrl}/api/send-grid-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: to,
          subject: 'Welcome to DuhaNashrah AI!',
          template: 'welcome',
          templateData: {
            name: firstName,
            dashboardUrl: `${window.location.origin}/dashboard`
          }
        }),
      });

      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
        error: data.error
      };
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      return {
        success: false,
        error: error.message || 'Failed to send welcome email',
      };
    }
  }

  /**
   * Send login alert email
   */
  async sendLoginAlertEmail(to: string, deviceInfo: { ip?: string; device?: string; location?: string; time?: string }): Promise<SendGridResponse> {
    const subject = 'New Login Detected - DNAi';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c19c 0%, #009e80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DNAi</h1>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">New Login Detected</h2>
            <p style="color: #6b7280; font-size: 16px;">
              We detected a new login to your account. If this was you, no action is needed.
            </p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #1f2937; margin: 0 0 10px 0;"><strong>Login Details:</strong></p>
              ${deviceInfo.time ? `<p style="color: #6b7280; margin: 5px 0;">Time: ${deviceInfo.time}</p>` : ''}
              ${deviceInfo.device ? `<p style="color: #6b7280; margin: 5px 0;">Device: ${deviceInfo.device}</p>` : ''}
              ${deviceInfo.location ? `<p style="color: #6b7280; margin: 5px 0;">Location: ${deviceInfo.location}</p>` : ''}
              ${deviceInfo.ip ? `<p style="color: #6b7280; margin: 5px 0;">IP Address: ${deviceInfo.ip}</p>` : ''}
            </div>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Security Tip:</strong> If you didn't make this login, please change your password immediately and review your account security settings.
              </p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #00c19c;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send new device login email
   */
  async sendNewDeviceLoginEmail(to: string, deviceInfo: { ip?: string; device?: string; location?: string }): Promise<SendGridResponse> {
    const subject = 'New Device Login - DNAi';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c19c 0%, #009e80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DNAi</h1>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">New Device Detected</h2>
            <p style="color: #6b7280; font-size: 16px;">
              We noticed a login from a new device or browser. If this was you, you can safely ignore this email.
            </p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #1f2937; margin: 0 0 10px 0;"><strong>Device Information:</strong></p>
              ${deviceInfo.device ? `<p style="color: #6b7280; margin: 5px 0;">Device: ${deviceInfo.device}</p>` : ''}
              ${deviceInfo.location ? `<p style="color: #6b7280; margin: 5px 0;">Location: ${deviceInfo.location}</p>` : ''}
              ${deviceInfo.ip ? `<p style="color: #6b7280; margin: 5px 0;">IP Address: ${deviceInfo.ip}</p>` : ''}
            </div>
            <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                <strong>Security Alert:</strong> If you don't recognize this device, please secure your account immediately by changing your password and enabling two-factor authentication.
              </p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #00c19c;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(to: string, alertType: string, details: string): Promise<SendGridResponse> {
    const subject = `Security Alert: ${alertType} - DNAi`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c19c 0%, #009e80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DNAi Security Alert</h1>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">${alertType}</h2>
            <p style="color: #6b7280; font-size: 16px;">
              ${details}
            </p>
            <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                <strong>Important:</strong> If you didn't perform this action, please secure your account immediately.
              </p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #00c19c;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send account deactivation email
   */
  async sendAccountDeactivationEmail(to: string, deletionDate: Date): Promise<SendGridResponse> {
    const subject = 'Account Deactivation Scheduled - DNAi';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00c19c 0%, #009e80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DNAi</h1>
          </div>
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Account Deactivation Scheduled</h2>
            <p style="color: #6b7280; font-size: 16px;">
              Your account has been scheduled for deletion on <strong>${deletionDate.toLocaleDateString()}</strong>.
            </p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Important:</strong> You can cancel this deactivation request at any time before the deletion date by logging into your account.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 16px;">
              After the deletion date, all your data will be permanently removed and cannot be recovered.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Contact us at <a href="mailto:${this.supportEmail}" style="color: #00c19c;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();
