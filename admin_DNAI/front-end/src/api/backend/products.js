import { createClient } from '../../lib/supabase/Production/client';

const API_URL = process.env.REACT_APP_Server_Url || 'http://localhost:5000/api';

/**
 * Get all products
 */
export const getAllProducts = async () => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch products' };
    }

    return { success: true, data: data.data || [] };
  } catch (error) {
    console.error('Get products error:', error);
    return { error: 'Failed to fetch products' };
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch product' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get product error:', error);
    return { error: 'Failed to fetch product' };
  }
};

/**
 * Create new product
 */
export const createProduct = async (productData) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to create product' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Create product error:', error);
    return { error: 'Failed to create product' };
  }
};

/**
 * Update product
 */
export const updateProduct = async (id, productData) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to update product' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Update product error:', error);
    return { error: 'Failed to update product' };
  }
};

/**
 * Delete product
 */
export const deleteProduct = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to delete product' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { error: 'Failed to delete product' };
  }
};

/**
 * Get product detail with database info (admin only)
 */
export const getProductDetail = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/products/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch product detail' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get product detail error:', error);
    return { error: 'Failed to fetch product detail' };
  }
};

/**
 * Get product dashboard data (admin only)
 */
export const getProductDashboard = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/products/${id}/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch dashboard data' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get product dashboard error:', error);
    return { error: 'Failed to fetch dashboard data' };
  }
};

/**
 * Get product users (admin only)
 */
export const getProductUsers = async (id, params = {}) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const queryParams = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/admin/products/${id}/users?${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch users' };
    }

    return { success: true, data: data.data, pagination: data.pagination };
  } catch (error) {
    console.error('Get product users error:', error);
    return { error: 'Failed to fetch users' };
  }
};

/**
 * Get all tables in product database (admin only)
 */
export const getProductTables = async (id) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/products/${id}/tables`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch tables' };
    }

    return { success: true, data: data.data || [] };
  } catch (error) {
    console.error('Get product tables error:', error);
    return { error: 'Failed to fetch tables' };
  }
};

/**
 * Get table details (admin only)
 */
export const getTableDetails = async (id, tableName) => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/admin/products/${id}/tables/${encodeURIComponent(tableName)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || 'Failed to fetch table details' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Get table details error:', error);
    return { error: 'Failed to fetch table details' };
  }
};
