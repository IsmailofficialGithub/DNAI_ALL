import sgMail from '../utils/sendgrid.js';
import { supabase } from '../utils/supabase.js';
import { PaymentEmail } from '../emailsTemplete/PaymentEmail.js';

export class EmailService {
    /**
     * Send payment confirmation or failure email
     */
    static async sendPaymentEmail(userId, type, status, amount, invoiceId) {
        try {
            console.log(`📧 [EmailService] Preparing payment email for user ${userId} (${status})`);

            // 1. Get user profile from the security-cleared view
            const { data: profile, error: profileErr } = await supabase
                .from('auth_role_with_profiles')
                .select('email, full_name')
                .eq('user_id', userId)
                .single();

            if (profileErr || !profile?.email) {
                console.error(`❌ [EmailService] Profile Error: ${profileErr?.message || 'No email found'}`);
                return;
            }

            // 2. Generate HTML
            const html = PaymentEmail(
                profile.full_name || profile.email.split('@')[0], 
                amount, 
                status, 
                type, 
                invoiceId
            );

            const subject = status === 'paid' || status === 'success' || status === 'approved'
                ? `Payment Successful - DuhaNashrah AI`
                : `Payment Failed - Action Required`;

            // 3. Send via SendGrid
            const msg = {
                to: profile.email,
                from: process.env.SENDGRID_FROM_EMAIL || 'support@geine-phi.vercel.app',
                subject: subject,
                html: html,
            };

            const [response] = await sgMail.send(msg);
            console.log(`✅ [EmailService] Payment email sent to ${profile.email} (Status: ${response.statusCode})`);

            // 4. Log to email_logs
            await supabase.from('email_logs').insert({
                user_id: userId,
                from_email: msg.from,
                to_email: profile.email,
                subject: subject,
                status: 'sent',
                provider: 'sendgrid',
                sent_at: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [EmailService] SendGrid Crash:', error.response?.body || error.message);
        }
    }
}
