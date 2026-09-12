import { supabaseAdmin } from '../config/database.js';

/**
 * Get reseller settings from app_settings table
 * @returns {Promise<{maxConsumersPerReseller: number|null, minInvoiceAmount: number|null, requireResellerApproval: boolean, allowResellerPriceOverride: boolean}>}
 */
export const getResellerSettings = async () => {
  try {
    const settingKeys = [
      'max_consumers_per_reseller',
      'min_invoice_amount',
      'require_reseller_approval',
      'allow_reseller_price_override'
    ];

    const { data: settings, error } = await supabaseAdmin
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', settingKeys);

    if (error) {
      console.error('Error fetching reseller settings:', error);
      // Return defaults on error
      return {
        maxConsumersPerReseller: null,
        minInvoiceAmount: null,
        requireResellerApproval: false,
        allowResellerPriceOverride: true
      };
    }

    // Convert array to object
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    return {
      maxConsumersPerReseller: settingsMap['max_consumers_per_reseller'] && settingsMap['max_consumers_per_reseller'] !== ''
        ? parseInt(settingsMap['max_consumers_per_reseller'])
        : null,
      minInvoiceAmount: settingsMap['min_invoice_amount'] && settingsMap['min_invoice_amount'] !== ''
        ? parseFloat(settingsMap['min_invoice_amount'])
        : null,
      requireResellerApproval: settingsMap['require_reseller_approval'] === 'true',
      allowResellerPriceOverride: settingsMap['allow_reseller_price_override'] !== 'false' // Default to true
    };
  } catch (error) {
    console.error('Error in getResellerSettings:', error);
    // Return defaults on error
    return {
      maxConsumersPerReseller: null,
      minInvoiceAmount: null,
      requireResellerApproval: false,
      allowResellerPriceOverride: true
    };
  }
};
















