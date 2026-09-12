-- ============================================================================
-- Section 1: Row Level Security (RLS) Enablement & Policies
-- ============================================================================


-- 1. billing.invoices
ALTER TABLE billing.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_select_policy" ON billing.invoices;
CREATE POLICY "invoices_select_policy" ON billing.invoices
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = receiver_id OR auth.uid() = sender_id);

-- 2. billing.offers
ALTER TABLE billing.offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers_select_policy" ON billing.offers;
CREATE POLICY "offers_select_policy" ON billing.offers
    FOR SELECT USING (true);

-- 3. content.linkedin_analytics_cache
ALTER TABLE content.linkedin_analytics_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "linkedin_analytics_cache_select_policy" ON content.linkedin_analytics_cache;
CREATE POLICY "linkedin_analytics_cache_select_policy" ON content.linkedin_analytics_cache
    FOR SELECT TO authenticated USING (true);

-- 4. inbound.leads
ALTER TABLE inbound.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_select_policy" ON inbound.leads;
CREATE POLICY "leads_select_policy" ON inbound.leads
    FOR SELECT TO authenticated USING (true);

-- 5. inbound.system_settings
ALTER TABLE inbound.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to system_settings" ON inbound.system_settings;
CREATE POLICY "Allow public read access to system_settings" ON inbound.system_settings
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admins to update system_settings" ON inbound.system_settings;
CREATE POLICY "Allow admins to update system_settings" ON inbound.system_settings
    FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_systemadmin = true));

-- 6. public.chat_log
ALTER TABLE public.chat_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_log_select_policy" ON public.chat_log;
CREATE POLICY "chat_log_select_policy" ON public.chat_log
    FOR SELECT TO authenticated USING (true);

-- 7. public.templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_select_policy" ON public.templates;
CREATE POLICY "templates_select_policy" ON public.templates
    FOR SELECT USING (is_public = true OR owner_user_id = auth.uid());
DROP POLICY IF EXISTS "templates_modify_policy" ON public.templates;
CREATE POLICY "templates_modify_policy" ON public.templates
    FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- 8. public.vapi_accounts
ALTER TABLE public.vapi_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vapi_accounts_select_policy" ON public.vapi_accounts;
CREATE POLICY "vapi_accounts_select_policy" ON public.vapi_accounts
    FOR SELECT TO authenticated USING (true);

-- 9. admin.support_attachments (Table policies)
ALTER TABLE admin.support_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_attachments_insert_own_ticket_row" ON admin.support_attachments;
CREATE POLICY "support_attachments_insert_own_ticket_row" ON admin.support_attachments
    FOR INSERT TO authenticated WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM admin.support_tickets t
            WHERE t.id = ticket_id
            AND (t.user_id = auth.uid() OR lower(t.user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
        )
    );
DROP POLICY IF EXISTS "support_attachments_select_own_ticket_row" ON admin.support_attachments;
CREATE POLICY "support_attachments_select_own_ticket_row" ON admin.support_attachments
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM admin.support_tickets t
            WHERE t.id = ticket_id
            AND (t.user_id = auth.uid() OR lower(t.user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
        )
    );

-- 10. Storage objects policies (support-attachments bucket)
DROP POLICY IF EXISTS "support_attachments_insert_own_ticket" ON storage.objects;
CREATE POLICY "support_attachments_insert_own_ticket" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'support-attachments'
        AND (
            (
                split_part(name, '/', 1) = 'support'
                AND split_part(name, '/', 3) = 'ticket'
                AND EXISTS (
                    SELECT 1 FROM admin.support_tickets t
                    WHERE t.id::text = split_part(name, '/', 2)
                    AND (t.user_id = auth.uid() OR lower(t.user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
                )
            )
            OR split_part(name, '/', 1) = auth.uid()::text
            OR (split_part(name, '/', 1) = 'support' AND split_part(name, '/', 3) = '' AND auth.uid() IS NOT NULL)
        )
    );

DROP POLICY IF EXISTS "support_attachments_select_own_ticket" ON storage.objects;
CREATE POLICY "support_attachments_select_own_ticket" ON storage.objects
    FOR SELECT TO authenticated USING (
        bucket_id = 'support-attachments'
        AND (
            (
                split_part(name, '/', 1) = 'support'
                AND split_part(name, '/', 3) = 'ticket'
                AND EXISTS (
                    SELECT 1 FROM admin.support_tickets t
                    WHERE t.id::text = split_part(name, '/', 2)
                    AND (t.user_id = auth.uid() OR lower(t.user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
                )
            )
            OR split_part(name, '/', 1) = auth.uid()::text
            OR (split_part(name, '/', 1) = 'support' AND split_part(name, '/', 3) = '' AND auth.uid() IS NOT NULL)
        )
    );

-- 11. inbound.inbound_retail_agent_test_calls
ALTER TABLE inbound.inbound_retail_agent_test_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own test calls" ON inbound.inbound_retail_agent_test_calls;
CREATE POLICY "Users can view own test calls"
  ON inbound.inbound_retail_agent_test_calls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own test calls" ON inbound.inbound_retail_agent_test_calls;
CREATE POLICY "Users can insert own test calls"
  ON inbound.inbound_retail_agent_test_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own test calls" ON inbound.inbound_retail_agent_test_calls;
CREATE POLICY "Users can update own test calls"
  ON inbound.inbound_retail_agent_test_calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- Section 2: Trigger Bindings
-- ============================================================================


-- 1. admin.support_messages triggers
DROP TRIGGER IF EXISTS update_ticket_stats_trigger ON admin.support_messages;
CREATE TRIGGER update_ticket_stats_trigger
    AFTER INSERT ON admin.support_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_ticket_stats();

DROP TRIGGER IF EXISTS update_ticket_unread_status_trigger ON admin.support_messages;
CREATE TRIGGER update_ticket_unread_status_trigger
    AFTER INSERT ON admin.support_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_ticket_unread_status();

-- 2. billing.invoice_payments triggers
DROP TRIGGER IF EXISTS update_invoice_payments_updated_at_trigger ON billing.invoice_payments;
CREATE TRIGGER update_invoice_payments_updated_at_trigger
    BEFORE UPDATE ON billing.invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payments_updated_at();

DROP TRIGGER IF EXISTS update_invoice_status_on_payment_trigger ON billing.invoice_payments;
CREATE TRIGGER update_invoice_status_on_payment_trigger
    AFTER INSERT OR UPDATE ON billing.invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_invoice_status_on_payment();

-- 3. billing.packages triggers
DROP TRIGGER IF EXISTS update_packages_updated_at_trigger ON billing.packages;
CREATE TRIGGER update_packages_updated_at_trigger
    BEFORE UPDATE ON billing.packages
    FOR EACH ROW EXECUTE FUNCTION public.update_packages_updated_at();

-- 4. content.ads triggers
DROP TRIGGER IF EXISTS update_ads_updated_at_trigger ON content.ads;
CREATE TRIGGER update_ads_updated_at_trigger
    BEFORE UPDATE ON content.ads
    FOR EACH ROW EXECUTE FUNCTION public.update_ads_updated_at();

DROP TRIGGER IF EXISTS calculate_ads_total_budget_trigger ON content.ads;
CREATE TRIGGER calculate_ads_total_budget_trigger
    BEFORE INSERT OR UPDATE ON content.ads
    FOR EACH ROW EXECUTE FUNCTION public.calculate_ads_total_budget();

-- 5. inbound.call_history triggers
DROP TRIGGER IF EXISTS update_call_history_updated_at_trigger ON inbound.call_history;
CREATE TRIGGER update_call_history_updated_at_trigger
    BEFORE UPDATE ON inbound.call_history
    FOR EACH ROW EXECUTE FUNCTION public.update_call_history_updated_at();

-- 6. inbound.call_logs triggers
DROP TRIGGER IF EXISTS update_call_logs_updated_at_trigger ON inbound.call_logs;
CREATE TRIGGER update_call_logs_updated_at_trigger
    BEFORE UPDATE ON inbound.call_logs
    FOR EACH ROW EXECUTE FUNCTION public.update_call_logs_updated_at();

-- 7. inbound.genie_bots triggers
DROP TRIGGER IF EXISTS update_genie_bots_updated_at_trigger ON inbound.genie_bots;
CREATE TRIGGER update_genie_bots_updated_at_trigger
    BEFORE UPDATE ON inbound.genie_bots
    FOR EACH ROW EXECUTE FUNCTION public.update_genie_bots_updated_at();

-- 8. inbound.genie_scheduled_calls triggers
DROP TRIGGER IF EXISTS update_genie_scheduled_calls_updated_at_trigger ON inbound.genie_scheduled_calls;
CREATE TRIGGER update_genie_scheduled_calls_updated_at_trigger
    BEFORE UPDATE ON inbound.genie_scheduled_calls
    FOR EACH ROW EXECUTE FUNCTION public.update_genie_scheduled_calls_updated_at();

DROP TRIGGER IF EXISTS notify_campaign_completion_trigger ON inbound.genie_scheduled_calls;
CREATE TRIGGER notify_campaign_completion_trigger
    AFTER UPDATE ON inbound.genie_scheduled_calls
    FOR EACH ROW EXECUTE FUNCTION public.notify_campaign_completion();

-- 9. public.knowledge_bases triggers
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at_trigger ON public.knowledge_bases;
CREATE TRIGGER update_knowledge_base_updated_at_trigger
    BEFORE UPDATE ON public.knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_base_updated_at();

-- 10. public.knowledge_base_documents triggers
DROP TRIGGER IF EXISTS update_knowledge_base_document_updated_at_trigger ON public.knowledge_base_documents;
CREATE TRIGGER update_knowledge_base_document_updated_at_trigger
    BEFORE UPDATE ON public.knowledge_base_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_base_document_updated_at();

-- 11. public.knowledge_base_faqs triggers
DROP TRIGGER IF EXISTS update_knowledge_base_faq_updated_at_trigger ON public.knowledge_base_faqs;
CREATE TRIGGER update_knowledge_base_faq_updated_at_trigger
    BEFORE UPDATE ON public.knowledge_base_faqs
    FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_base_faq_updated_at();

-- 12. public.products triggers
DROP TRIGGER IF EXISTS update_products_updated_at_trigger ON public.products;
CREATE TRIGGER update_products_updated_at_trigger
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_products_updated_at();

-- 13. inbound.email_templates triggers
DROP TRIGGER IF EXISTS sync_email_templates_columns_trigger ON inbound.email_templates;
CREATE TRIGGER sync_email_templates_columns_trigger
    BEFORE INSERT OR UPDATE ON inbound.email_templates
    FOR EACH ROW EXECUTE FUNCTION inbound.sync_email_templates_columns();

-- 14. inbound.user_emails triggers
DROP TRIGGER IF EXISTS sync_user_emails_email_trigger ON inbound.user_emails;
CREATE TRIGGER sync_user_emails_email_trigger
    BEFORE INSERT OR UPDATE ON inbound.user_emails
    FOR EACH ROW EXECUTE FUNCTION inbound.sync_user_emails_email();

-- 15. inbound.voice_agents triggers
DROP TRIGGER IF EXISTS update_inbound_agent_updated_at_trigger ON inbound.voice_agents;
CREATE TRIGGER update_inbound_agent_updated_at_trigger
    BEFORE UPDATE ON inbound.voice_agents
    FOR EACH ROW EXECUTE FUNCTION inbound.update_inbound_agent_updated_at();

-- 16. auth.users (Sync new user to profiles)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Standard set_updated_at triggers for remaining tables containing updated_at column

DROP TRIGGER IF EXISTS update_updated_at_trigger ON admin.api_keys;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON admin.api_keys
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON admin.support_tickets;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON admin.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON billing.invoices;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON billing.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON billing.offers;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON billing.offers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON content.brands;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON content.brands
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON content.linkedin_analytics_cache;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON content.linkedin_analytics_cache
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON content.post_schedule;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON content.post_schedule
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON content.posts;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON content.posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON content.social_accounts;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON content.social_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.after_hours_messages;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.after_hours_messages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.agent_analytics;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.agent_analytics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.agent_documents;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.agent_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.ai_prompts;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.ai_prompts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.bank_account_details;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.bank_account_details
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.call_analytics;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.call_analytics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.call_recordings;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.call_recordings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.call_schedules;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.call_schedules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.coupon_codes;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.coupon_codes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.holiday_messages;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.holiday_messages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.holidays;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.holidays
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.inbound_analytics;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.inbound_analytics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.inbound_numbers;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.inbound_numbers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.kyc_verifications;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.leads;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.package_features;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.package_features
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.package_variables;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.package_variables
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.payment_proofs;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.payment_proofs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.purchases;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.purchases
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.schedule_overrides;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.schedule_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.system_settings;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.two_factor_auth;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.two_factor_auth
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.user_credits;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.user_credits
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.user_emails;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.user_emails
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.user_subscriptions;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.weekly_availability;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.weekly_availability
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.account_deactivation_requests;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.account_deactivation_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.app_settings;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.linkedin_organizations;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.linkedin_organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.permissions;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.permissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.product_databases;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.product_databases
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.profiles;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.social_posting_strategies;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.social_posting_strategies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.strategies;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.strategies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.templates;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.user_permissions;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.user_permissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON public.whatsapp_applications;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON public.whatsapp_applications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON inbound.inbound_retail_agent_test_calls;
CREATE TRIGGER update_updated_at_trigger
    BEFORE UPDATE ON inbound.inbound_retail_agent_test_calls
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
