import nodemailer from 'nodemailer';
import { supabase } from '../utils/supabase.js';
import sgMail from '../utils/sendgrid.js';
import { WellcomeEmail } from '../emailsTemplete/WellcomeEmail.js';

/**
 * Helper to determine SMTP config based on email domain
 */
const getSmtpConfig = (email, password) => {
    const domain = email.split('@')[1].toLowerCase();
    const baseConfig = {
        connectionTimeout: 5000, // 5 seconds connection timeout
        greetingTimeout: 5000,   // 5 seconds greeting timeout
        socketTimeout: 8000      // 8 seconds socket inactivity timeout
    };

    if (domain.includes('gmail.com')) {
        return {
            ...baseConfig,
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: email, pass: password }
        };
    } else if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com')) {
        return {
            ...baseConfig,
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false,
            auth: { user: email, pass: password }
        };
    } else if (domain.includes('yahoo.com')) {
        return {
            ...baseConfig,
            host: 'smtp.mail.yahoo.com',
            port: 587,
            secure: false,
            auth: { user: email, pass: password }
        };
    }
    return {
        ...baseConfig,
        host: `smtp.${domain}`,
        port: 587,
        secure: false,
        auth: { user: email, pass: password }
    };
};

/**
 * POST /api/send-email
 * Send email using user-provided email credentials
 */
export const sendEmail = async (req, res, next) => {
    try {
        const { userEmail, appPassword, to, subject, text, html } = req.body;

        if (!userEmail || !appPassword || !to || !subject || (!text && !html)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields. Please provide: userEmail, appPassword, to, subject, and either text or html'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userEmail) || !emailRegex.test(to)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }

        const smtpConfig = getSmtpConfig(userEmail, appPassword);
        const transporter = nodemailer.createTransport(smtpConfig);

        const mailOptions = {
            from: userEmail,
            to: to,
            subject: subject,
            text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
            html: html || text
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/send-email-custom
 * Send email with custom SMTP configuration
 */
export const sendEmailCustom = async (req, res, next) => {
    try {
        const { userEmail, appPassword, smtpHost, smtpPort = 587, secure = false, to, subject, text, html } = req.body;

        if (!userEmail || !appPassword || !smtpHost || !to || !subject || (!text && !html)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: secure === true || secure === 'true',
            auth: { user: userEmail, pass: appPassword },
            connectionTimeout: 5000, // 5 seconds connection timeout
            greetingTimeout: 5000,   // 5 seconds greeting timeout
            socketTimeout: 8000      // 8 seconds socket inactivity timeout
        });

        const mailOptions = {
            from: userEmail,
            to,
            subject,
            text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
            html: html || text
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /email
 * Legacy endpoint for frontend integration
 */
export const sendEmailLegacy = async (req, res, next) => {
    try {
        const { from_email, to_email, subject, body, html_body, smtp_password } = req.body;

        if (!from_email || !to_email || !subject || !smtp_password) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const smtpConfig = getSmtpConfig(from_email, smtp_password);
        const transporter = nodemailer.createTransport(smtpConfig);

        const mailOptions = {
            from: from_email,
            to: to_email,
            subject,
            text: body || (html_body ? html_body.replace(/<[^>]*>/g, '') : ''),
            html: html_body || body
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/send-system-email
 */
export const sendSystemEmail = async (req, res, next) => {
    try {
        const { to_email, subject, body, html_body } = req.body;

        if (!to_email || !subject || (!body && !html_body)) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = parseInt(process.env.SMTP_PORT || '465');
        const smtpUser = process.env.SMTP_USER;
        const smtpPassword = process.env.SMTP_PASSWORD;
        const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
        const smtpFromName = process.env.SMTP_FROM_NAME || 'Inbound Genie';

        if (!smtpHost || !smtpUser || !smtpPassword) {
            return res.status(500).json({ success: false, error: 'SMTP configuration is missing' });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPassword },
            connectionTimeout: 5000, // 5 seconds connection timeout
            greetingTimeout: 5000,   // 5 seconds greeting timeout
            socketTimeout: 8000      // 8 seconds socket inactivity timeout
        });

        const mailOptions = {
            from: `"${smtpFromName}" <${smtpFromEmail}>`,
            to: to_email,
            subject,
            text: body || (html_body ? html_body.replace(/<[^>]*>/g, '') : ''),
            html: html_body || body
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/send-agent-email
 */
export const sendAgentEmail = async (req, res, next) => {
    try {
        if (!supabase) throw new Error('Supabase not configured');

        const { agent_id, to_email, subject, body, html_body, company_name, from_email_id, user_id } = req.body;

        // agent_id is optional if from_email_id is provided (for manual leads)
        if ((!agent_id && !from_email_id) || !to_email || !subject || (!body && !html_body)) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        let finalUserId = user_id;
        let finalCompanyName = company_name;
        let agent = null;

        if (agent_id) {
            const { data: agentData, error: agentError } = await supabase
                .from('voice_agents')
                .select('id, name, company_name, user_id')
                .eq('id', agent_id)
                .single();

            if (agentData) {
                agent = agentData;
                if (!finalUserId) finalUserId = agent.user_id;
                if (!finalCompanyName) finalCompanyName = agent.company_name;
            }
        }

        let emailQuery = supabase
            .from('user_emails')
            .select('id, email, smtp_password, user_id, email_type, is_primary, created_at')
            .is('deleted_at', null);

        if (from_email_id) {
            emailQuery = emailQuery.eq('id', from_email_id);
        } else if (agent_id) {
            emailQuery = emailQuery.eq('assigned_agent_id', agent_id);
        } else {
            return res.status(400).json({ success: false, error: 'Either agent_id or from_email_id must be provided' });
        }

        const { data: emailAccounts, error: emailError } = await emailQuery;

        if (emailError || !emailAccounts || emailAccounts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: from_email_id ? 'Selected email account is missing SMTP configuration' : 'No email account assigned to this agent' 
            });
        }

        // Priority selection when multiple email accounts are assigned to this agent
        let emailAccount = emailAccounts[0];
        if (emailAccounts.length > 1) {
            const priorityOrder = {
                'sales': 10,
                'lead': 9,
                'info': 8,
                'general': 7,
                'support': 6,
                'marketing': 5,
                'billing': 4,
                'careers': 3
            };
            
            emailAccounts.sort((a, b) => {
                const scoreA = priorityOrder[a.email_type?.toLowerCase()] || 1;
                const scoreB = priorityOrder[b.email_type?.toLowerCase()] || 1;
                
                if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                }
                if (a.is_primary !== b.is_primary) {
                    return a.is_primary ? -1 : 1;
                }
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
            
            emailAccount = emailAccounts[0];
        }

        if (!emailAccount.smtp_password) {
            return res.status(404).json({ 
                success: false, 
                error: 'Email account is missing SMTP configuration' 
            });
        }

        if (!finalUserId) finalUserId = emailAccount.user_id;

        const smtpConfig = getSmtpConfig(emailAccount.email, emailAccount.smtp_password);
        const transporter = nodemailer.createTransport(smtpConfig);

        const mailOptions = {
            from: finalCompanyName ? `${finalCompanyName} <${emailAccount.email}>` : emailAccount.email,
            to: to_email,
            subject,
            text: body || (html_body ? html_body.replace(/<[^>]*>/g, '') : ''),
            html: html_body || body
        };

        let info = null;
        let retryCount = 0;
        const maxRetries = 3;
        let lastSendError = null;

        while (retryCount < maxRetries) {
            try {
                info = await transporter.sendMail(mailOptions);
                break; // Success! Break out of the loop
            } catch (sendError) {
                lastSendError = sendError;
                retryCount++;
                
                // If it's a permanent error (like auth or invalid address or quota limit exceeded), don't retry!
                const errorText = sendError.message?.toLowerCase() || '';
                const isPermanent = errorText.includes('quota') || 
                                    errorText.includes('limit') || 
                                    errorText.includes('auth') || 
                                    errorText.includes('login') || 
                                    errorText.includes('535') ||
                                    errorText.includes('550') || 
                                    errorText.includes('554') || 
                                    errorText.includes('invalid');
                                    
                if (isPermanent) {
                    break;
                }
                
                // Wait 1 second before retrying transient network errors
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!info) {
            const errorText = lastSendError?.message?.toLowerCase() || '';
            const isLimitExceeded = errorText.includes('quota') || 
                                    errorText.includes('limit') || 
                                    errorText.includes('too many') || 
                                    errorText.includes('429') || 
                                    errorText.includes('452');
                                    
            const isAuthFailure = errorText.includes('auth') || 
                                  errorText.includes('login') || 
                                  errorText.includes('535') || 
                                  errorText.includes('credential') || 
                                  errorText.includes('authenticated');

            const statusMessage = isLimitExceeded 
                ? 'Email limit/quota exceeded: ' + lastSendError.message
                : isAuthFailure
                    ? 'SMTP Authentication failed: ' + lastSendError.message
                    : 'Failed to deliver email after ' + maxRetries + ' attempts: ' + lastSendError.message;

            // Logging send failure
            try {
                await supabase.from('email_logs').insert({
                    user_id: finalUserId,
                    from_email: emailAccount.email,
                    to_email,
                    subject,
                    body: body || html_body,
                    status: 'failed',
                    error_message: statusMessage,
                    sent_at: new Date().toISOString()
                });
            } catch (logError) {
                console.error('Logging send failure error:', logError);
            }

            const statusCode = isLimitExceeded ? 429 : (isAuthFailure ? 401 : 500);
            return res.status(statusCode).json({
                success: false,
                error: statusMessage
            });
        }

        // Logging success
        try {
            await supabase.from('email_logs').insert({
                user_id: finalUserId,
                from_email: emailAccount.email,
                to_email,
                subject,
                body: body || html_body,
                status: 'sent',
                sent_at: new Date().toISOString()
            });
        } catch (logError) {
            console.error('Logging success error:', logError);
        }

        res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/send-grid-email
 * Send email using SendGrid
 */
export const sendGridEmail = async (req, res, next) => {
    try {
        const { to_email, subject, body, html_body, from_email, template, templateData } = req.body;

        if (!to_email || !subject) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: to_email and subject are required' 
            });
        }

        let finalHtml = html_body || body;
        let finalSubject = subject;

        // If a template is specified, use it
        if (template === 'welcome') {
            const name = templateData?.name || 'User';
            const dashboardUrl = templateData?.dashboardUrl || process.env.FRONTEND_URL || 'https://geine-phi.vercel.app';
            finalHtml = WellcomeEmail(name, dashboardUrl);
            finalSubject = subject || 'Welcome to DuhaNashrah AI';
        } else if (!body && !html_body) {
            return res.status(400).json({ 
                success: false, 
                error: 'Either body/html_body or a valid template must be provided' 
            });
        }

        const msg = {
            to: to_email,
            from: from_email || process.env.SENDGRID_FROM_EMAIL || 'support@yourdomain.com',
            subject: finalSubject,
            text: body || (finalHtml ? finalHtml.replace(/<[^>]*>/g, '') : ''),
            html: finalHtml
        };

        if (!process.env.SENDGRID_API_KEY) {
            return res.status(500).json({ success: false, error: 'SendGrid API key not configured' });
        }

        const [response] = await sgMail.send(msg);
        
        // Log to supabase if available
        if (supabase) {
            try {
                await supabase.from('email_logs').insert({
                    from_email: msg.from,
                    to_email,
                    subject,
                    body: body || html_body,
                    status: 'sent',
                    provider: 'sendgrid',
                    sent_at: new Date().toISOString()
                });
            } catch (logError) {
                console.error('Logging error:', logError);
            }
        }

        res.json({ 
            success: true, 
            message: 'Email sent successfully via SendGrid',
            statusCode: response.statusCode
        });
    } catch (error) {
        if (error.response) {
            console.error('SendGrid error response:', error.response.body);
            return res.status(error.response.status || 500).json({
                success: false,
                error: error.response.body.errors?.[0]?.message || 'SendGrid failed to send email'
            });
        }
        next(error);
    }
};
