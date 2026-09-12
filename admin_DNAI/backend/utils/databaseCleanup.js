import { supabaseAdmin } from '../config/database.js';

/**
 * Robustly clears all data associated with a user across all schemas
 * @param {string} userId - UUID of the user to clean up
 * @returns {Promise<boolean>} - True if successful
 */
export const performFullUserCleanup = async (userId) => {
  if (!userId) return false;

  // Tables that reference auth.users or profiles and block deletion
  const tablesToClear = [
    { schema: 'inbound', table: 'call_logs', column: 'owner_user_id' },
    { schema: 'inbound', table: 'genie_bots', column: 'owner_user_id' },
    { schema: 'inbound', table: 'genie_contact_lists', column: 'owner_user_id' },
    { schema: 'inbound', table: 'genie_leads', column: 'owner_user_id' },
    { schema: 'inbound', table: 'genie_scheduled_calls', column: 'owner_user_id' },
    { schema: 'inbound', table: 'agent_calls', column: 'user_id' },
    { schema: 'inbound', table: 'agent_analytics', column: 'user_id' },
    { schema: 'inbound', table: 'call_analytics', column: 'user_id' },
    { schema: 'inbound', table: 'inbound_numbers', column: 'user_id' },
    { schema: 'inbound', table: 'call_history', column: 'user_id' },
    { schema: 'inbound', table: 'call_recordings', column: 'user_id' },
    { schema: 'inbound', table: 'call_schedules', column: 'user_id' },
    { schema: 'inbound', table: 'holidays', column: 'user_id' },
    { schema: 'inbound', table: 'inbound_analytics', column: 'user_id' },
    { schema: 'inbound', table: 'voice_agents', column: 'user_id' },
    { schema: 'inbound', table: 'user_subscriptions', column: 'user_id' },
    { schema: 'inbound', table: 'purchases', column: 'user_id' },
    { schema: 'inbound', table: 'bank_account_details', column: 'user_id' },
    { schema: 'inbound', table: 'payment_proofs', column: 'user_id' },
    { schema: 'inbound', table: 'coupon_usage', column: 'user_id' },
    { schema: 'inbound', table: 'user_credits', column: 'user_id' },
    { schema: 'inbound', table: 'email_logs', column: 'user_id' },
    { schema: 'inbound', table: 'user_emails', column: 'user_id' },
    { schema: 'inbound', table: 'email_templates', column: 'user_id' },
    { schema: 'inbound', table: 'ai_prompts', column: 'user_id' },
    { schema: 'inbound', table: 'login_activity', column: 'user_id' },
    { schema: 'inbound', table: 'password_history', column: 'user_id' },
    { schema: 'inbound', table: 'two_factor_auth', column: 'user_id' },
    { schema: 'inbound', table: 'phone_verification_tokens', column: 'user_id' },
    { schema: 'inbound', table: 'security_events', column: 'user_id' },
    { schema: 'inbound', table: 'notifications', column: 'user_id' },
    { schema: 'inbound', table: 'kyc_verifications', column: 'user_id' },
    { schema: 'inbound', table: 'leads', column: 'user_id' },
    { schema: 'inbound', table: 'credit_transactions', column: 'user_id' },
    { schema: 'billing', table: 'credit_transactions', column: 'user_id' },
    { schema: 'billing', table: 'invoices', column: 'user_id' },
    { schema: 'billing', table: 'offers', column: 'created_by' },
    { schema: 'content', table: 'ads', column: 'created_by' },
    { schema: 'content', table: 'analysis', column: 'user_id' },
    { schema: 'content', table: 'brands', column: 'owner_user_id' },
    { schema: 'admin', table: 'support_attachments', column: 'uploaded_by' },
    { schema: 'admin', table: 'support_messages', column: 'sender_id' },
    { schema: 'admin', table: 'support_tickets', column: 'user_id' },
    { schema: 'admin', table: 'api_keys', column: 'created_by' },
    { schema: 'public', table: 'user_permissions', column: 'user_id' },
    { schema: 'public', table: 'user_product_access', column: 'user_id' },
    { schema: 'public', table: 'user_package_access', column: 'user_id' },
    { schema: 'public', table: 'templates', column: 'owner_user_id' },
    { schema: 'public', table: 'whatsapp_applications', column: 'created_by' },
    { schema: 'public', table: 'knowledge_bases', column: 'user_id' },
    { schema: 'public', table: 'account_deactivation_requests', column: 'user_id' }
  ];

  console.log(`🧹 Starting full user data cleanup for user: ${userId}`);

  for (const item of tablesToClear) {
    try {
      await supabaseAdmin
        .schema(item.schema)
        .from(item.table)
        .delete()
        .eq(item.column, userId);
    } catch (err) {
      console.warn(`⚠️ Warning: Failed to clear ${item.schema}.${item.table}:`, err.message);
    }
  }

  // Activity logs and audit trails should be nullified instead of deleted to preserve history
  const auditLogsToNullify = [
    { schema: 'content', table: 'activity_logs', column: 'actor_id' },
    { schema: 'content', table: 'activity_logs', column: 'target_id' },
    { schema: 'admin', table: 'error_logs', column: 'user_id' },
    { schema: 'admin', table: 'support_messages', column: 'read_by' },
    { schema: 'admin', table: 'support_tickets', column: 'assigned_to' },
    { schema: 'public', table: 'app_settings', column: 'updated_by' }
  ];

  for (const item of auditLogsToNullify) {
    try {
      await supabaseAdmin
        .schema(item.schema)
        .from(item.table)
        .update({ [item.column]: null })
        .eq(item.column, userId);
    } catch (err) {
      console.warn(`⚠️ Warning: Failed to nullify ${item.schema}.${item.table}:`, err.message);
    }
  }

  // Finally delete the profile
  try {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    
    if (profileError) {
      console.error('❌ Error deleting profile:', profileError);
      return false;
    }
  } catch (err) {
    console.error('❌ Error deleting profile:', err);
    return false;
  }

  return true;
};
