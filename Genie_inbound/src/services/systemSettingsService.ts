import { supabase } from '../lib/supabase';

export interface SystemSettings {
    credit_rates: {
        purchase_rate: number;
        call_per_minute: number;
        agent_creation: number;
        number_import: number;
    };
}

const DEFAULT_SETTINGS: SystemSettings = {
    credit_rates: {
        purchase_rate: 6,
        call_per_minute: 4,
        agent_creation: 5,
        number_import: 3,
    },
};

/**
 * Fetch system settings from the database
 */
export const getSystemSettings = async (): Promise<SystemSettings> => {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'inbound_billing_config')
            .maybeSingle();

        if (error) {
            console.error('Error fetching system settings:', error);
            return DEFAULT_SETTINGS;
        }

        if (!data) {
            console.warn('System settings not found in database, using defaults');
            return DEFAULT_SETTINGS;
        }

        let settings = data.value;
        if (typeof settings === 'string') {
            try {
                settings = JSON.parse(settings);
            } catch (e) {
                console.error('Error parsing system settings JSON:', e);
                return DEFAULT_SETTINGS;
            }
        }

        return (settings as any) || DEFAULT_SETTINGS;
    } catch (err) {
        console.error('Error in getSystemSettings:', err);
        return DEFAULT_SETTINGS;
    }
};

/**
 * Update system settings
 * (Typically called by admin)
 */
export const updateSystemSettings = async (settings: SystemSettings): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('system_settings')
            .update({
                value: settings,
                updated_at: new Date().toISOString(),
            })
            .eq('key', 'inbound_billing_config');

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('Error updating system settings:', err);
        return { success: false, error: err.message };
    }
};
