import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "./use-toast";
import { convertToHtmlEmail, EmailDesignStyle } from "@/lib/htmlEmail";

/**
 * Parses ugly raw SMTP errors into highly readable, actionable user descriptions.
 */
const getFriendlyErrorMessage = (errorMsg: string): { title: string; description: string } => {
  const lowercaseMsg = errorMsg.toLowerCase();

  // 1. Connection Timeout (ETIMEDOUT)
  if (lowercaseMsg.includes("etimedout") || lowercaseMsg.includes("timeout")) {
    return {
      title: "Connection Timeout",
      description: "We could not connect to your SMTP server. Please verify your SMTP host, port (e.g. 587), and ensure your hosting provider or network does not block outgoing connections on this port.",
    };
  }

  // 2. Connection Refused (ECONNREFUSED)
  if (lowercaseMsg.includes("econnrefused") || lowercaseMsg.includes("connection refused")) {
    return {
      title: "Connection Refused",
      description: "The SMTP server refused the connection. Please double-check your hostname and port, and verify if SSL/TLS settings are configured correctly.",
    };
  }

  // 3. DNS Lookup Failure (ENOTFOUND / host lookup)
  if (lowercaseMsg.includes("enotfound") || lowercaseMsg.includes("getaddrinfo")) {
    return {
      title: "SMTP Server Not Found",
      description: "Could not find the SMTP server hostname. Please verify that the SMTP host field is spelled correctly in your email settings.",
    };
  }

  // 4. Authentication Failure (535 / auth / credentials / login)
  if (
    lowercaseMsg.includes("authentication") ||
    lowercaseMsg.includes("535") ||
    lowercaseMsg.includes("auth") ||
    lowercaseMsg.includes("login") ||
    lowercaseMsg.includes("credentials")
  ) {
    return {
      title: "Authentication Failed",
      description: "The SMTP server rejected your credentials. Please double-check your email address and verify that your SMTP password or App Password is correct.",
    };
  }

  // 5. Quota / Rate Limit Exceeded (429 / limit / quota / too many)
  if (
    lowercaseMsg.includes("quota") ||
    lowercaseMsg.includes("limit") ||
    lowercaseMsg.includes("too many") ||
    lowercaseMsg.includes("429") ||
    lowercaseMsg.includes("452")
  ) {
    return {
      title: "Email Limit Exceeded",
      description: "You have exceeded your email provider's sending limit or quota. Please try again later or upgrade your email provider plan.",
    };
  }

  // 6. Recipient Rejected (550 / 553 / 554 / invalid recipient)
  if (
    lowercaseMsg.includes("550") ||
    lowercaseMsg.includes("553") ||
    lowercaseMsg.includes("554") ||
    lowercaseMsg.includes("recipient") ||
    lowercaseMsg.includes("rejected")
  ) {
    return {
      title: "Recipient Rejected",
      description: "The recipient email address was rejected by the SMTP server. Please verify that the recipient email is valid and spelled correctly.",
    };
  }

  // Fallback to a cleaner standard message
  return {
    title: "Email Sending Failed",
    description: errorMsg.replace(/^(error:\s*)+/i, "") || "An unexpected error occurred while trying to send your email. Please check your SMTP configuration.",
  };
};

interface SendEmailOptions {
  fromEmail: string;
  toEmail: string;
  toPhoneNumber?: string;
  subject: string;
  body: string;
  smtpPassword?: string;
  designStyle?: EmailDesignStyle;
  accentColor?: string;
  companyName?: string;
}

// Get backend URL from environment variable
// This should point to your backend server that handles email sending
const getBackendUrl = () => {
  const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
  
  console.log('[Email Hook] Environment variable REACT_APP_BACKEND_URL:', envBackendUrl);
  
  // If no environment variable is set, use default localhost:3001
  // This assumes your backend server is running on port 3001
  if (!envBackendUrl) {
    console.warn('[Email Hook] REACT_APP_BACKEND_URL is not set. Using default: http://localhost:3001');
    return 'http://localhost:3001';
  }
  
  // Ensure it's a full URL (not relative)
  if (!envBackendUrl.startsWith('http://') && !envBackendUrl.startsWith('https://')) {
    return `http://${envBackendUrl}`;
  }
  return envBackendUrl;
};

export const useSendEmail = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const sendEmail = async (options: SendEmailOptions): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated. Please log in.",
        variant: "destructive",
      });
      return { success: false, error: "User not authenticated" };
    }

    if (!options.smtpPassword) {
      toast({
        title: "Configuration Error",
        description: "SMTP password is required. Please check your email settings.",
        variant: "destructive",
      });
      return { success: false, error: "SMTP password is required" };
    }

    setSending(true);
    let logData: any = null;

    try {
      // Convert body to HTML email
      const htmlBody = convertToHtmlEmail(
        options.subject,
        options.body,
        {
          previewMode: false,
          style: options.designStyle || "modern",
          accentColor: options.accentColor || "#4F46E5",
          companyName: options.companyName,
        }
      );

      // Create email log entry
      const { data: logDataResult, error: logError } = await supabase
        .from("email_logs")
        .insert({
          user_id: user.id,
          from_email: options.fromEmail,
          to_email: options.toEmail,
          to_phone_number: options.toPhoneNumber || null,
          subject: options.subject,
          body: options.body,
          status: "pending",
        })
        .select()
        .single();

      if (logError) {
        console.error("Error creating email log:", logError);
      } else {
        logData = logDataResult;
      }

      // Get backend URL for email sending
      // The backend uses the user's SMTP credentials from the database to send emails
      const backendUrl = getBackendUrl();
      
      console.log('[Email Hook] Backend URL:', backendUrl);
      
      // Remove trailing slash if present and construct full URL
      const cleanBackendUrl = backendUrl.replace(/\/$/, '');
      const emailEndpoint = `${cleanBackendUrl}/api/email`;
      
      // Ensure we're using an absolute URL
      if (!emailEndpoint.startsWith('http://') && !emailEndpoint.startsWith('https://')) {
        throw new Error(`Invalid backend URL: ${emailEndpoint}. Must be an absolute URL.`);
      }
      
      // Call backend API to send email using user's SMTP credentials
      // The backend will use the smtp_password to authenticate and send the email
      console.log('[Email Hook] Calling backend endpoint:', emailEndpoint);
      
      const response = await fetch(emailEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_email: options.fromEmail, // User's email from database
          to_email: options.toEmail,
          subject: options.subject,
          body: options.body,
          html_body: htmlBody,
          smtp_password: options.smtpPassword, // SMTP password from database
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error('[Email Hook] Non-JSON response received:', textResponse.substring(0, 200));
        
        // If we got HTML, it means we hit the wrong endpoint (probably React dev server)
        if (textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')) {
          throw new Error(
            `Backend server not found at ${emailEndpoint}. ` +
            `Please ensure your backend server is running and REACT_APP_BACKEND_URL is correctly set in .env file. ` +
            `Received HTML response instead of JSON, which suggests the request went to the React dev server instead of the backend.`
          );
        }
        
        throw new Error(`Invalid response from backend: ${textResponse.substring(0, 100)}`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      // Update log status to sent
      if (logData) {
        await supabase
          .from("email_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", logData.id);
      }

      toast({
        title: "Email Sent",
        description: `Email sent successfully to ${options.toEmail}`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error sending email:", error);

      // Update log status to failed if log was created
      if (logData) {
        try {
          await supabase
            .from("email_logs")
            .update({
              status: "failed",
              error_message: error.message || "Failed to send email",
            })
            .eq("id", logData.id);
        } catch (logError) {
          console.error("Error updating email log:", logError);
        }
      } else if (options.toEmail) {
        // Try to find the most recent pending log if we don't have logData
        try {
          const { data: logs } = await supabase
            .from("email_logs")
            .select("id")
            .eq("user_id", user.id)
            .eq("to_email", options.toEmail)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (logs) {
            await supabase
              .from("email_logs")
              .update({
                status: "failed",
                error_message: error.message || "Failed to send email",
              })
              .eq("id", logs.id);
          }
        } catch (logError) {
          console.error("Error updating email log:", logError);
        }
      }

      const rawError = error.message || "Failed to send email";
      const { title, description } = getFriendlyErrorMessage(rawError);
      toast({
        title: title,
        description: description,
        variant: "destructive",
      });

      return { success: false, error: rawError };
    } finally {
      setSending(false);
    }
  };

  return {
    sendEmail,
    sending,
  };
};
