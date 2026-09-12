import { supabase } from '../lib/supabase';
import { getSystemSettings } from './systemSettingsService';

/**
 * Credit Service
 * Handles all credit-related operations
 */

export interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
  services_paused: boolean;
  low_credit_threshold: number;
}

export interface CreditRates {
  purchase_rate: number;
  call_per_minute: number;
  agent_creation: number;
  number_import: number;
}

/**
 * Credit constants (Fallback defaults)
 */
export const CREDIT_RATES: CreditRates = {
  purchase_rate: 0,
  call_per_minute: 0,
  agent_creation: 0,
  number_import: 0,
};

/**
 * Initialize inbound credits for a new user
 * This follows the specific schema and structure requested by the user
 */
export const initializeInboundCredits = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const now = new Date().toISOString();
    const metadata = {
      plan: "free",
      credits: 100,
      plan_id: "free",
      plan_type: "free",
      plan_status: "active",
      plan_created_at: now,
      plan_updated_at: now
    };

    const { error } = await (supabase as any)
      .schema('inbound')
      .from('user_credits')
      .upsert({
        user_id: userId,
        balance: 100.00,
        total_purchased: 0.00,
        total_used: 0.00,
        services_paused: false,
        low_credit_threshold: 10.00,
        metadata: metadata,
        created_at: now,
        updated_at: now,
        auto_topup_enabled: false,
        low_credit_notified: false
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error initializing inbound credits:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Exception in initializeInboundCredits:', error);
    return { success: false, error: error.message || 'Failed to initialize credits' };
  }
};

/**
 * Get dynamic credit rates from system settings
 */
export const getDynamicCreditRates = async (): Promise<CreditRates> => {
  try {
    const settings = await getSystemSettings();
    return settings.credit_rates;
  } catch (error) {
    console.error('Error fetching dynamic credit rates:', error);
    return CREDIT_RATES;
  }
};

/**
 * Get user's current credit balance
 */
export const getCreditBalance = async (userId: string): Promise<CreditBalance | null> => {
  try {
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance, total_purchased, total_used, services_paused, low_credit_threshold')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credits record exists, create one
        const { data: newData, error: createError } = await supabase
          .from('user_credits')
          .insert({ user_id: userId, balance: 0, total_purchased: 0, total_used: 0 })
          .select()
          .single();

        if (createError) {
          console.error('Error creating credits record:', createError);
          return null;
        }

        return {
          balance: newData.balance,
          total_purchased: newData.total_purchased,
          total_used: newData.total_used,
          services_paused: newData.services_paused,
          low_credit_threshold: newData.low_credit_threshold,
        };
      }
      console.error('Error fetching credit balance:', error);
      return null;
    }

    return {
      balance: data.balance,
      total_purchased: data.total_purchased,
      total_used: data.total_used,
      services_paused: data.services_paused,
      low_credit_threshold: data.low_credit_threshold,
    };
  } catch (error) {
    console.error('Error in getCreditBalance:', error);
    return null;
  }
};

/**
 * Check if user has enough credits for an operation
 */
export const hasEnoughCredits = async (
  userId: string,
  requiredCredits: number
): Promise<{ hasEnough: boolean; currentBalance: number; message?: string }> => {
  try {
    const balance = await getCreditBalance(userId);

    if (!balance) {
      return {
        hasEnough: false,
        currentBalance: 0,
        message: 'Unable to check credit balance. Please try again.',
      };
    }

    if (balance.services_paused) {
      return {
        hasEnough: false,
        currentBalance: balance.balance,
        message: 'Your services are paused due to insufficient credits. Please purchase credits to continue.',
      };
    }

    if (balance.balance < requiredCredits) {
      return {
        hasEnough: false,
        currentBalance: balance.balance,
        message: `Insufficient credits. This operation requires ${requiredCredits} credits. Your current balance: ${balance.balance.toFixed(2)} credits.`,
      };
    }

    return {
      hasEnough: true,
      currentBalance: balance.balance,
    };
  } catch (error) {
    console.error('Error checking credits:', error);
    return {
      hasEnough: false,
      currentBalance: 0,
      message: 'Error checking credit balance. Please try again.',
    };
  }
};

/**
 * Deduct credits for call usage
 * This should typically be called by a backend webhook when a call completes
 * But we provide this for manual calls if needed
 */
export const deductCallCredits = async (
  userId: string,
  callId: string,
  agentId: string,
  durationSeconds: number
): Promise<{ success: boolean; creditsDeducted: number; error?: string }> => {
  try {
    // Get dynamic rate
    const rates = await getDynamicCreditRates();
    const creditsPerMinute = rates.call_per_minute;
    const creditsToDeduct = (durationSeconds / 60.0) * creditsPerMinute;

    const { data, error } = await supabase.rpc('deduct_call_credits', {
      p_user_id: userId,
      p_call_id: callId,
      p_agent_id: agentId,
      p_duration_seconds: durationSeconds,
      p_credits_per_minute: creditsPerMinute,
    });

    if (error) {
      console.error('Error deducting call credits:', error);
      return {
        success: false,
        creditsDeducted: 0,
        error: error.message || 'Failed to deduct credits',
      };
    }

    return {
      success: true,
      creditsDeducted: data || creditsToDeduct,
    };
  } catch (error: any) {
    console.error('Error in deductCallCredits:', error);
    return {
      success: false,
      creditsDeducted: 0,
      error: error.message || 'Failed to deduct credits',
    };
  }
};

/**
 * Deduct credits for agent creation
 */
export const deductAgentCreationCredits = async (
  userId: string,
  agentId: string,
  agentName: string
): Promise<{ success: boolean; creditsDeducted: number; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('deduct_agent_creation_credits', {
      p_user_id: userId,
      p_agent_id: agentId,
      p_agent_name: agentName,
    });

    if (error) {
      console.error('Error deducting agent creation credits:', error);
      return {
        success: false,
        creditsDeducted: 0,
        error: error.message || 'Failed to deduct credits',
      };
    }

    return {
      success: true,
      creditsDeducted: data || 5.0,
    };
  } catch (error: any) {
    console.error('Error in deductAgentCreationCredits:', error);
    return {
      success: false,
      creditsDeducted: 0,
      error: error.message || 'Failed to deduct credits',
    };
  }
};
