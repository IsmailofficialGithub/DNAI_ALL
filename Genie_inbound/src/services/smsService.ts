// SMS service for phone verification
// In production, this should call a backend API endpoint
// that uses services like Twilio, AWS SNS, or similar

interface SMSOptions {
  to: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class SMSService {
  /**
   * Send SMS via backend API
   * Note: In production, this should be called from a backend/API route
   * to keep API keys secure. This is a client-side placeholder.
   */
  async sendSMS(options: SMSOptions): Promise<SMSResponse> {
    // In production, call your backend API endpoint
    // const response = await fetch('/api/send-sms', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     to: options.to,
    //     message: options.message
    //   })
    // });
    // return await response.json();

    // Placeholder implementation
    console.warn('SMS sending should be done server-side. Implement a backend endpoint for production.');
    console.log('SMS would be sent to:', options.to);
    console.log('Message:', options.message);

    return {
      success: true,
      message: 'SMS queued for sending (implement backend endpoint)',
    };
  }

  /**
   * Send phone verification OTP
   */
  async sendVerificationOTP(phoneNumber: string, otp: string): Promise<SMSResponse> {
    const message = `Your DNAi verification code is: ${otp}. This code will expire in 10 minutes.`;
    
    return this.sendSMS({
      to: phoneNumber,
      message,
    });
  }
}

export const smsService = new SMSService();
