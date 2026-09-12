/**
 * Invoice Management API (Backend)
 * These functions call the backend API for invoice operations
 */

import apiClient from '../../services/apiClient';

/**
 * Get consumer's accessed products with prices for invoice creation
 * @param {string} consumerId - Consumer user ID
 * @returns {Promise<Object>} Consumer info and their accessed products
 */
export const getConsumerProductsForInvoice = async (consumerId) => {
  try {
    const response = await apiClient.invoices.getConsumerProducts(consumerId);
    return response;
  } catch (error) {
    console.error('Error fetching consumer products for invoice:', error);
    throw error;
  }
};

/**
 * Get consumer's accessed packages with prices for invoice creation
 * @param {string} consumerId - Consumer user ID
 * @returns {Promise<Object>} Consumer info and their accessed packages
 */
export const getConsumerPackagesForInvoice = async (consumerId) => {
  try {
    const response = await apiClient.invoices.getConsumerPackages(consumerId);
    return response;
  } catch (error) {
    console.error('Error fetching consumer packages for invoice:', error);
    throw error;
  }
};

/**
 * Get all invoices (admin only)
 * @param {Object} filters - Filter options
 * @param {string} filters.search - Search term
 * @param {string} filters.status - Status filter (all, unpaid, paid, partial, cancelled)
 * @param {number} filters.page - Page number
 * @param {number} filters.limit - Items per page
 * @returns {Promise<Object>} Invoices data with pagination
 */
export const getAllInvoices = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    // Pass only the query string to apiClient; it will prefix the base path
    const response = await apiClient.invoices.getAll(queryString ? `?${queryString}` : '');
    return response;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

/**
 * Get invoices for reseller (reseller only)
 * @param {Object} filters - Filter options
 * @param {string} filters.search - Search term
 * @param {string} filters.status - Status filter (all, unpaid, paid, partial, cancelled)
 * @param {number} filters.page - Page number
 * @param {number} filters.limit - Items per page
 * @returns {Promise<Object>} Invoices data with pagination
 */
export const getMyInvoices = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    // Pass only the query string to apiClient; it will prefix the base path
    const response = await apiClient.invoices.getMyInvoices(queryString ? `?${queryString}` : '');
    return response;
  } catch (error) {
    console.error('Error fetching my invoices:', error);
    throw error;
  }
};

/**
 * Get invoices for a specific consumer
 * @param {string} consumerId - Consumer user ID
 * @returns {Promise<Object>} Invoices data
 */
export const getConsumerInvoices = async (consumerId) => {
  try {
    const response = await apiClient.invoices.getConsumerInvoices(consumerId);
    return response;
  } catch (error) {
    console.error('Error fetching consumer invoices:', error);
    throw error;
  }
};

/**
 * Create invoice with invoice items
 * @param {Object} invoiceData - Invoice data
 * @param {string} invoiceData.receiver_id - Consumer user ID
 * @param {string} invoiceData.issue_date - Invoice issue date (ISO format)
 * @param {string} invoiceData.due_date - Invoice due date (ISO format)
 * @param {number} invoiceData.tax_rate - Tax rate percentage (default for all items)
 * @param {string} invoiceData.notes - Invoice notes
 * @param {Array} invoiceData.items - Array of invoice items
 * @param {string} invoiceData.items[].package_id - Package ID
 * @param {number} invoiceData.items[].quantity - Quantity
 * @param {number} invoiceData.items[].unit_price - Unit price
 * @param {number} invoiceData.items[].tax_rate - Tax rate for this item (optional)
 * @returns {Promise<Object>} Created invoice
 */
export const createInvoice = async (invoiceData) => {
  try {
    const response = await apiClient.invoices.create(invoiceData);
    return response;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

