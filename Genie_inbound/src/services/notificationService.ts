import { supabase } from '../lib/supabase';

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (
  userId: string,
  notification: NotificationData
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: notification.type,
      p_title: notification.title,
      p_message: notification.message,
      p_metadata: notification.metadata || {},
    });
    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in createNotification:', error);
    return { success: false, error: error.message || 'Failed to create notification' };
  }
};

/**
 * Notification helpers for common actions
 */
export const NotificationHelpers = {
  /**
   * Notify when a phone number is imported and activated
   */
  async numberActivated(userId: string, phoneNumber: string, label?: string): Promise<void> {
    await createNotification(userId, {
      type: 'number_activated',
      title: 'Phone Number Activated',
      message: `Your phone number ${phoneNumber}${label ? ` (${label})` : ''} has been successfully activated and is ready to receive calls.`,
      metadata: { phone_number: phoneNumber, phone_label: label },
    });
  },

  /**
   * Notify when an agent becomes active
   */
  async agentActivated(userId: string, agentName: string, agentId: string): Promise<void> {
    await createNotification(userId, {
      type: 'agent_activated',
      title: 'Agent Activated',
      message: `Your voice agent "${agentName}" is now active and ready to handle calls.`,
      metadata: { agent_id: agentId, agent_name: agentName },
    });
  },

  /**
   * Notify when credits are deducted
   */
  async creditsDeducted(
    userId: string,
    creditsDeducted: number,
    reason: string,
    remainingBalance?: number
  ): Promise<void> {
    const balanceText = remainingBalance !== undefined
      ? ` Your remaining balance: ${remainingBalance.toFixed(2)} credits.`
      : '';

    await createNotification(userId, {
      type: 'credits_deducted',
      title: 'Credits Deducted',
      message: `${creditsDeducted.toFixed(2)} credits have been deducted for ${reason}.${balanceText}`,
      metadata: {
        credits_deducted: creditsDeducted,
        reason,
        remaining_balance: remainingBalance,
      },
    });
  },

  /**
   * Notify when agent is created
   */
  async agentCreated(userId: string, agentName: string, agentId: string, creditsUsed: number): Promise<void> {
    const creditMessage = creditsUsed > 0 ? ` ${creditsUsed} credits were deducted.` : '';
    await createNotification(userId, {
      type: 'agent_created',
      title: 'Agent Created Successfully',
      message: `Your voice agent "${agentName}" has been created successfully.${creditMessage}`,
      metadata: { agent_id: agentId, agent_name: agentName, credits_used: creditsUsed },
    });
  },

  /**
   * Notify when number is imported
   */
  async numberImported(userId: string, phoneNumber: string, label?: string): Promise<void> {
    await createNotification(userId, {
      type: 'number_imported',
      title: 'Phone Number Imported',
      message: `Phone number ${phoneNumber}${label ? ` (${label})` : ''} has been successfully imported and will be activated shortly.`,
      metadata: { phone_number: phoneNumber, phone_label: label },
    });
  },

  /**
   * Notify when credits are low
   */
  async lowCredits(userId: string, currentBalance: number, threshold: number = 10): Promise<void> {
    await createNotification(userId, {
      type: 'low_credits',
      title: 'Low Credit Balance',
      message: `Your credit balance is low (${currentBalance.toFixed(2)} credits). Please purchase more credits to continue using services.`,
      metadata: { current_balance: currentBalance, threshold },
    });
  },

  /**
   * Notify when call credits are deducted
   */
  async callCreditsDeducted(
    userId: string,
    creditsDeducted: number,
    callDuration: number,
    agentName: string,
    remainingBalance?: number
  ): Promise<void> {
    const balanceText = remainingBalance !== undefined
      ? ` Your remaining balance: ${remainingBalance.toFixed(2)} credits.`
      : '';

    await createNotification(userId, {
      type: 'call_credits_deducted',
      title: 'Call Credits Deducted',
      message: `${creditsDeducted.toFixed(2)} credits deducted for a ${Math.round(callDuration / 60)}-minute call with "${agentName}".${balanceText}`,
      metadata: {
        credits_deducted: creditsDeducted,
        call_duration: callDuration,
        agent_name: agentName,
        remaining_balance: remainingBalance,
      },
    });
  },
};
