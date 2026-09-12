/**
 * Customer Support API (Backend)
 * These functions call the backend API for customer support operations
 */

import apiClient from '../../services/apiClient';

/**
 * Create a new support ticket
 * @param {Object} ticketData - Ticket data
 * @param {string} ticketData.subject - Ticket subject
 * @param {string} ticketData.message - Initial message
 * @param {string} ticketData.category - Ticket category (optional)
 * @param {string} ticketData.priority - Priority level (optional)
 * @param {Array} ticketData.attachments - Array of attachment objects (optional)
 * @returns {Promise<Object>} Created ticket
 */
export const createTicket = async (ticketData) => {
  try {
    const response = await apiClient.customerSupport.createTicket(ticketData);
    return response;
  } catch (error) {
    console.error('Error creating support ticket:', error);
    throw error;
  }
};

/**
 * Get all support tickets (with filters)
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Status filter
 * @param {string} filters.priority - Priority filter
 * @param {string} filters.category - Category filter
 * @param {string} filters.assigned_to - Assigned to user ID
 * @param {string} filters.user_id - User ID filter (admin only)
 * @param {string} filters.search - Search term
 * @param {string} filters.startDate - Start date filter (YYYY-MM-DD)
 * @param {string} filters.endDate - End date filter (YYYY-MM-DD)
 * @param {number} filters.page - Page number
 * @param {number} filters.limit - Items per page
 * @returns {Promise<Object>} Tickets data with pagination
 */
export const getTickets = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.category) params.append('category', filters.category);
    if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    const response = await apiClient.customerSupport.getTickets(queryString ? `?${queryString}` : '');
    return response;
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    throw error;
  }
};

/**
 * Get single ticket with messages and attachments
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} Ticket with messages and attachments
 */
export const getTicket = async (ticketId) => {
  try {
    const response = await apiClient.customerSupport.getTicket(ticketId);
    return response;
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    throw error;
  }
};

/**
 * Add message to ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} messageData - Message data
 * @param {string} messageData.message - Message text
 * @param {boolean} messageData.is_internal - Internal admin note (optional)
 * @param {Array} messageData.attachments - Array of attachment objects (optional)
 * @returns {Promise<Object>} Created message
 */
export const addMessage = async (ticketId, messageData) => {
  try {
    const response = await apiClient.customerSupport.addMessage(ticketId, messageData);
    return response;
  } catch (error) {
    console.error('Error adding message to ticket:', error);
    throw error;
  }
};

/**
 * Update ticket status, assignment, priority
 * @param {string} ticketId - Ticket ID
 * @param {Object} updateData - Update data
 * @param {string} updateData.status - New status (optional)
 * @param {string} updateData.assigned_to - Assign to user ID (optional)
 * @param {string} updateData.priority - New priority (optional)
 * @param {string} updateData.internal_notes - Internal notes (optional)
 * @returns {Promise<Object>} Updated ticket
 */
export const updateTicketStatus = async (ticketId, updateData) => {
  try {
    const response = await apiClient.customerSupport.updateTicketStatus(ticketId, updateData);
    return response;
  } catch (error) {
    console.error('Error updating ticket status:', error);
    throw error;
  }
};

/**
 * Get ticket statistics (admin only)
 * @returns {Promise<Object>} Ticket statistics
 */
export const getTicketStats = async () => {
  try {
    const response = await apiClient.customerSupport.getStats();
    return response;
  } catch (error) {
    console.error('Error fetching ticket statistics:', error);
    throw error;
  }
};

/**
 * Generate AI response via webhook (proxy endpoint)
 * @param {Array} messages - Array of message objects with sender, message, and created_at
 * @returns {Promise<Object>} AI generated response
 */
export const generateAiResponse = async (messages) => {
  try {
    const response = await apiClient.customerSupport.generateAiResponse(messages);
    return response;
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
};

/**
 * Export tickets to CSV (with filters)
 * @param {Object} filters - Filter options (same as getTickets)
 * @returns {Promise<Blob>} CSV file blob
 */
export const exportTickets = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.category) params.append('category', filters.category);
    if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    // Add timestamp to prevent caching
    params.append('_t', Date.now());
    
    const queryString = params.toString();
    const response = await apiClient.customerSupport.exportTickets(queryString ? `?${queryString}` : '');
    return response;
  } catch (error) {
    console.error('Error exporting support tickets:', error);
    throw error;
  }
};
