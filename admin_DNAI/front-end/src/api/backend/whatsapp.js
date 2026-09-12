import { createClient } from '../../lib/supabase/Production/client';

const API_URL = process.env.REACT_APP_Server_Url || 'http://localhost:5000/api';

/**
 * Create new WhatsApp application
 */
export const createWhatsAppApplication = async (name, phone, purpose) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, phone, purpose })
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to create WhatsApp application' };
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Create WhatsApp application error:', error);
    return { error: 'Failed to create WhatsApp application' };
  }
};

/**
 * Get all WhatsApp applications
 */
export const getWhatsAppApplications = async () => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch WhatsApp applications' };
    }

    return { success: true, data: data.data || [] };
  } catch (error) {
    console.error('Get WhatsApp applications error:', error);
    return { error: 'Failed to fetch WhatsApp applications' };
  }
};

/**
 * Get WhatsApp application by ID
 */
export const getWhatsAppApplication = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch WhatsApp application' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get WhatsApp application error:', error);
    return { error: 'Failed to fetch WhatsApp application' };
  }
};

/**
 * Update WhatsApp application
 */
export const updateWhatsAppApplication = async (id, updates) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to update WhatsApp application' };
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Update WhatsApp application error:', error);
    return { error: 'Failed to update WhatsApp application' };
  }
};

/**
 * Delete WhatsApp application
 */
export const deleteWhatsAppApplication = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to delete WhatsApp application' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Delete WhatsApp application error:', error);
    return { error: 'Failed to delete WhatsApp application' };
  }
};

/**
 * Connect WhatsApp application (initiate connection, generate QR)
 */
export const connectWhatsAppApplication = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to connect WhatsApp application' };
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Connect WhatsApp application error:', error);
    return { error: 'Failed to connect WhatsApp application' };
  }
};

/**
 * Disconnect WhatsApp application
 */
export const disconnectWhatsAppApplication = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to disconnect WhatsApp application' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Disconnect WhatsApp application error:', error);
    return { error: 'Failed to disconnect WhatsApp application' };
  }
};

/**
 * Reconnect WhatsApp application
 */
export const reconnectWhatsAppApplication = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}/reconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to reconnect WhatsApp application' };
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Reconnect WhatsApp application error:', error);
    return { error: 'Failed to reconnect WhatsApp application' };
  }
};

/**
 * Get QR code for WhatsApp application
 */
export const getQRCode = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/applications/${id}/qr`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to get QR code' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get QR code error:', error);
    return { error: 'Failed to get QR code' };
  }
};

/**
 * Send WhatsApp message
 */
export const sendWhatsAppMessage = async (applicationId, phoneNumber, message) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ applicationId, phoneNumber, message })
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to send message' };
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Send WhatsApp message error:', error);
    return { error: 'Failed to send message' };
  }
};

