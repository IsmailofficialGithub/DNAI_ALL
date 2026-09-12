/**
 * Environment Variable Validation
 * Ensures all required environment variables are set
 */

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appName: string;
  appUrl: string;
  stripePublishableKey?: string;
  stripeCheckoutWebhookUrl?: string;
  stripePaymentWebhookUrl?: string;
  botCreationWebhookUrl?: string;
  phoneNumberWebhookUrl?: string;
}

/**
 * Validates and returns environment configuration
 */
export const validateEnv = (): { valid: boolean; config: Partial<EnvConfig>; errors: string[] } => {
  const errors: string[] = [];
  const config: Partial<EnvConfig> = {};

  // Required environment variables
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const appName = process.env.REACT_APP_APP_NAME || 'DNAi';
  const appUrl = process.env.REACT_APP_APP_URL || window.location.origin;

  if (!supabaseUrl) {
    errors.push('REACT_APP_SUPABASE_URL is not set');
  } else {
    config.supabaseUrl = supabaseUrl;
  }

  if (!supabaseAnonKey) {
    errors.push('REACT_APP_SUPABASE_ANON_KEY is not set');
  } else {
    config.supabaseAnonKey = supabaseAnonKey;
  }

  config.appName = appName;
  config.appUrl = appUrl;

  // Optional but recommended environment variables
  const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  const stripeCheckoutWebhookUrl = process.env.REACT_APP_STRIPE_CHECKOUT_WEBHOOK_URL;
  const stripePaymentWebhookUrl = process.env.REACT_APP_STRIPE_PAYMENT_WEBHOOK_URL;
  const botCreationWebhookUrl = process.env.REACT_APP_BOT_CREATION_WEBHOOK_URL;
  const phoneNumberWebhookUrl = process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;

  if (stripePublishableKey) {
    config.stripePublishableKey = stripePublishableKey;
  } else {
    console.warn('REACT_APP_STRIPE_PUBLISHABLE_KEY is not set. Payment features will not work.');
  }

  if (stripeCheckoutWebhookUrl) {
    config.stripeCheckoutWebhookUrl = stripeCheckoutWebhookUrl;
  } else {
    console.warn('REACT_APP_STRIPE_CHECKOUT_WEBHOOK_URL is not set. Payment checkout will not work.');
  }

  if (stripePaymentWebhookUrl) {
    config.stripePaymentWebhookUrl = stripePaymentWebhookUrl;
  } else {
    console.warn('REACT_APP_STRIPE_PAYMENT_WEBHOOK_URL is not set. Payment verification will not work.');
  }

  if (botCreationWebhookUrl) {
    config.botCreationWebhookUrl = botCreationWebhookUrl;
  } else {
    console.warn('REACT_APP_BOT_CREATION_WEBHOOK_URL is not set. Agent creation webhook will not work.');
  }

  if (phoneNumberWebhookUrl) {
    config.phoneNumberWebhookUrl = phoneNumberWebhookUrl;
  } else {
    console.warn('REACT_APP_PHONE_NUMBER_WEBHOOK_URL is not set. Phone number import webhook will not work.');
  }

  return {
    valid: errors.length === 0,
    config,
    errors,
  };
};

/**
 * Get environment configuration (validates on first call)
 */
let envConfig: Partial<EnvConfig> | null = null;

export const getEnvConfig = (): Partial<EnvConfig> => {
  if (!envConfig) {
    const validation = validateEnv();
    if (!validation.valid) {
      console.error('Environment validation failed:', validation.errors);
      // In production, you might want to show an error page
      if (process.env.NODE_ENV === 'production') {
        console.error('Critical environment variables are missing. Please check your configuration.');
      }
    }
    envConfig = validation.config;
  }
  return envConfig;
};
