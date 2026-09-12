import { createClient } from '../../lib/supabase/Production/client';

const API_URL = process.env.REACT_APP_Server_Url || 'http://localhost:5000/api';

/**
 * Get all product database configurations
 */
export const getAllProductDatabases = async () => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/product-databases`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch product databases' };
    }

    return { success: true, data: data.data || [] };
  } catch (error) {
    console.error('Get product databases error:', error);
    return { error: 'Failed to fetch product databases' };
  }
};

/**
 * Get product database configuration by product ID
 */
export const getProductDatabase = async (productId) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/product-databases/${productId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch product database' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get product database error:', error);
    return { error: 'Failed to fetch product database' };
  }
};

/**
 * Create or update product database configuration
 */
export const upsertProductDatabase = async (productId, config) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const method = config.id ? 'PUT' : 'POST';
    const url = config.id 
      ? `${API_URL}/admin/product-databases/${productId}`
      : `${API_URL}/admin/product-databases`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: productId,
        ...config
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to save product database configuration' };
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Upsert product database error:', error);
    return { error: 'Failed to save product database configuration' };
  }
};

/**
 * Delete product database configuration
 */
export const deleteProductDatabase = async (productId) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/product-databases/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to delete product database configuration' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Delete product database error:', error);
    return { error: 'Failed to delete product database configuration' };
  }
};

/**
 * Test product database connection
 */
export const testProductDatabaseConnection = async (productId) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/product-databases/${productId}/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false,
        error: data.message || data.error || 'Connection test failed' 
      };
    }

    return { success: data.success, data: data.data, message: data.message };
  } catch (error) {
    console.error('Test connection error:', error);
    return { success: false, error: 'Failed to test connection' };
  }
};

/**
 * Test credentials before saving (for validation)
 */
export const testCredentials = async (config) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/product-databases/test-credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false,
        error: data.message || data.error || 'Credential test failed' 
      };
    }

    return { success: data.success, message: data.message };
  } catch (error) {
    console.error('Test credentials error:', error);
    return { success: false, error: 'Failed to test credentials' };
  }
};

