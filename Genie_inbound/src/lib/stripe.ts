import { loadStripe, Stripe } from '@stripe/stripe-js';

const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';

// Initialize Stripe outside of any component to satisfy Stripe's optimization requirements
// and avoid the "Stripe Developers" developer-only overlay in test mode.
export const stripePromise: Promise<Stripe | null> | null = stripeKey && !stripeKey.includes('your_stripe')
  ? loadStripe(stripeKey)
  : null;

/**
 * Helper to get the stripe instance safely
 */
export const getStripe = async (): Promise<Stripe | null> => {
  return stripePromise;
};
