import { analyzeCallTranscript } from '../services/callAnalysis.js';
import { supabase } from '../utils/supabase.js';

/**
 * Upsert lead into page_leads table based on analysis
 */
async function upsertLeadFromAnalysis(call, analysis) {
    try {
        if (!supabase) return;

        const customer = analysis.customer || {};
        const phoneNumber = customer.phone_number || call.phone_number;
        const email = customer.email;

        let status = 'general';
        if (analysis.is_lead && analysis.lead_strength === 'hot') status = 'hot';
        else if (analysis.is_lead && analysis.lead_strength === 'warm') status = 'warm';
        else if (analysis.is_lead && analysis.lead_strength === 'cold') status = 'cold';
        else if (analysis.call_type === 'support') status = 'support';
        else if (analysis.call_type === 'order') status = 'order';
        else if (analysis.call_type === 'appointment') status = 'appointment';

        let botName = null;
        if (call.bot_id) {
            const { data: bot } = await supabase.from('bots').select('name').eq('id', call.bot_id).single();
            botName = bot?.name || null;
        }

        const leadData = {
            user_id: call.user_id,
            name: customer.name || call.contact_name,
            email: email,
            phone: phoneNumber,
            address: customer.address,
            bot_name: botName,
            status: status,
            call_id: call.id,
            call_type: analysis.call_type,
            lead_strength: analysis.lead_strength,
            sentiment: analysis.sentiment,
            urgency_level: analysis.urgency_level,
            confidence_score: analysis.confidence_score,
            transcript: call.transcript,
            extracted_data: analysis,
            is_lead: analysis.is_lead,
            source: 'call',
            last_call_at: call.completed_at || call.started_at,
            updated_at: new Date().toISOString()
        };

        let existingLead = null;
        if (phoneNumber) {
            const { data } = await supabase.from('leads').select('id').eq('user_id', call.user_id).eq('phone', phoneNumber).maybeSingle();
            existingLead = data;
        }
        if (!existingLead && email) {
            const { data } = await supabase.from('leads').select('id').eq('user_id', call.user_id).eq('email', email).maybeSingle();
            existingLead = data;
        }

        if (existingLead) {
            await supabase.from('leads').update(leadData).eq('id', existingLead.id);
        } else if (analysis.is_lead || phoneNumber || email) {
            await supabase.from('leads').insert(leadData);
        }
    } catch (error) {
        console.error('Lead upsert failed:', error);
    }
}

export const analyzeCall = async (req, res, next) => {
    try {
        if (!supabase) throw new Error('Supabase not configured');

        const { callId } = req.body;
        if (!callId) return res.status(400).json({ success: false, error: 'callId is required' });

        const { data: call, error: callError } = await supabase.from('call_history').select('*').eq('id', callId).single();
        if (callError || !call) return res.status(404).json({ success: false, error: 'Call not found' });

        if (call.analyzed && call.analysis) return res.json({ success: true, message: 'Already analyzed', analysis: call.analysis });
        if (!call.transcript) return res.status(400).json({ success: false, error: 'Transcript is empty' });

        const analysisResult = await analyzeCallTranscript(call.transcript);
        if (!analysisResult.success) {
            await supabase.from('call_history').update({ analyzed: true, analysis: { error: analysisResult.error } }).eq('id', callId);
            return res.status(500).json({ success: false, error: analysisResult.error });
        }

        const analysis = analysisResult.analysis;
        await supabase.from('call_history').update({
            analyzed: true,
            analysis: analysis,
            sentiment: analysis.sentiment,
            urgency_level: analysis.urgency_level,
            is_lead: analysis.is_lead,
            updated_at: new Date().toISOString()
        }).eq('id', callId);

        // Credit deduction logic can stay here or be in a service
        try {
            const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'billing_config').maybeSingle();
            const creditsPerMinute = settings?.value?.credit_rates?.call_per_minute || 3.0;
            if (call.call_duration && call.user_id) {
                await supabase.rpc('deduct_call_credits', {
                    p_user_id: call.user_id,
                    p_call_id: call.id,
                    p_agent_id: call.agent_id,
                    p_duration_seconds: call.call_duration,
                    p_credits_per_minute: creditsPerMinute
                });
            }
        } catch (e) { console.error('Credit error:', e); }

        await upsertLeadFromAnalysis(call, analysis);

        res.json({ success: true, analysis, callId: call.id });
    } catch (error) {
        next(error);
    }
};
