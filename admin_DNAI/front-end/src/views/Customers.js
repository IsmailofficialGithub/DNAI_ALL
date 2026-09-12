import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  MessageSquare, Search, Filter, Plus, Eye, MoreVertical,
  Send, Paperclip, X, CheckCircle, Clock, AlertCircle,
  User, Calendar, Tag, ChevronLeft, ChevronRight, FileText,
  Download, Image as ImageIcon, Wifi, WifiOff, Check,
  MailOpen,
  Sparkles,
  Mail
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getTickets,
  getTicket,
  createTicket,
  addMessage,
  updateTicketStatus,
  getTicketStats,
  generateAiResponse,
  exportTickets
} from '../api/backend';
import { searchAllUsers } from '../api/backend/users';
import { useAuth } from '../contexts/AuthContext';
import { checkUserPermissionsBulk } from '../api/backend/permissions';
import { usePermissions } from '../hooks/usePermissions';
import apiClient from '../services/apiClient';
import { supabase } from '../lib/supabase/Production/client';
import { hasRole } from '../utils/roleUtils';

const Customers = () => {
  const history = useHistory();
  const { profile, user } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const isAdmin = hasRole(profile?.role, 'admin');
  const [permissions, setPermissions] = useState({
    create: false, // Start as false, update after checking
    update: false,
    read: false,
  });
  const [hasViewPermission, setHasViewPermission] = useState(false); // Start as false
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true); // Track permission checking state

  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('weekly'); // 'all', 'weekly', 'monthly', 'manual' - Default to 7 days
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportingCSV, setExportingCSV] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFilter, setExportDateFilter] = useState('all'); // 'all', 'weekly', 'monthly', 'manual'
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Ticket detail state
  const [ticketMessages, setTicketMessages] = useState([]);
  const [ticketAttachments, setTicketAttachments] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [loadingTicketDetails, setLoadingTicketDetails] = useState(false);

  // Create ticket state
  const [createFormData, setCreateFormData] = useState({
    subject: '',
    message: '',
    category: '',
    priority: 'medium',
    attachments: [],
    user_id: '' // User for whom the ticket is being created (on behalf of)
  });
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUserForTicket, setSelectedUserForTicket] = useState(null);
  const [showUserSearchResults, setShowUserSearchResults] = useState(false);

  // Status update state (admin only)
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatusValue, setSelectedStatusValue] = useState('');
  const [statusUpdateData, setStatusUpdateData] = useState({
    status: '',
    priority: '',
    assigned_to: '',
    internal_notes: ''
  });

  // AI Generate Response state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [showAiResponse, setShowAiResponse] = useState(false);

  const ticketsPerPage = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Search users by email when typing
  useEffect(() => {
    if (!userSearchQuery.trim() || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      setShowUserSearchResults(false);
      return;
    }

    const searchUsers = async () => {
      setSearchingUsers(true);
      try {
        const usersList = await searchAllUsers(userSearchQuery.trim());
        if (Array.isArray(usersList)) {
          setUserSearchResults(usersList);
          setShowUserSearchResults(true);
        } else {
          setUserSearchResults([]);
          setShowUserSearchResults(false);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setUserSearchResults([]);
        setShowUserSearchResults(false);
      } finally {
        setSearchingUsers(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchUsers();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(debounceTimer);
  }, [userSearchQuery]);

  // Check customer_support.view permission first (required to access the page)
  useEffect(() => {
    if (!user || !profile) {
      setHasViewPermission(false);
      setCheckingViewPermission(false);
      return;
    }

    // Wait for permissions to load before checking
    if (isLoadingPermissions) {
      setCheckingViewPermission(true);
      return;
    }

    // Use permissions hook to check permission (only after permissions are loaded)
    const hasViewPerm = hasPermission('customer_support.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);

    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view customer support.');
      setTimeout(() => {
        history.push('/admin/users');
      }, 500);
    }
  }, [user, profile, history, hasPermission, isLoadingPermissions]);

  // Check multiple permissions using the permissions hook (optimized - no API calls needed)
  useEffect(() => {
    // Only check other permissions if user has view permission and permissions are loaded
    if (checkingViewPermission || !hasViewPermission || isLoadingPermissions) {
      return;
    }

    setCheckingPermissions(true);

    // Systemadmins have all permissions
    if (profile?.is_systemadmin === true) {
      setPermissions({ create: true, update: true, read: true });
      setCheckingPermissions(false);
      return;
    }

    // Use permissions hook to check all permissions (already fetched, no API calls)
    try {

      // Use permissions hook to check all permissions (already fetched, no API calls)
      setPermissions({
        create: hasPermission('customer_support.create'),
        update: hasPermission('customer_support.update'),
        read: hasPermission('customer_support.read')
      });
    } catch (error) {
      console.error('Error checking customer support permissions:', error);
      setPermissions({ create: false, update: false, read: false });
    } finally {
      setCheckingPermissions(false);
    }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch tickets (only if user has view permission)
  useEffect(() => {
    // Don't fetch if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    fetchTickets();
    if (isAdmin) {
      fetchStats();
    }
  }, [currentPage, searchQuery, statusFilter, priorityFilter, dateFilter, startDate, endDate, checkingViewPermission, hasViewPermission, isAdmin]);

  // Set up realtime subscription for tickets list
  useEffect(() => {
    // Don't subscribe if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission || !user) {
      return;
    }

    // Clean up previous subscription
    if (ticketsSubscriptionRef.current) {
      supabase.removeChannel(ticketsSubscriptionRef.current);
      ticketsSubscriptionRef.current = null;
    }

    // Create a unique channel name
    const channelName = `tickets-list-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          console.log('New ticket created:', payload.new);
          // Check if the new ticket matches current filters before adding
          const newTicket = payload.new;
          const filters = filtersRef.current;
          const matchesFilters = () => {
            // Apply status filter
            if (filters.statusFilter !== 'all' && newTicket.status !== filters.statusFilter) {
              return false;
            }
            // Apply priority filter
            if (filters.priorityFilter !== 'all' && newTicket.priority !== filters.priorityFilter) {
              return false;
            }
            // Apply search filter
            if (filters.searchQuery) {
              const searchLower = filters.searchQuery.toLowerCase();
              const matchesSearch =
                newTicket.subject?.toLowerCase().includes(searchLower) ||
                newTicket.ticket_number?.toLowerCase().includes(searchLower);
              if (!matchesSearch) {
                return false;
              }
            }
            // For non-admins, only show their own tickets
            if (!filters.isAdmin && newTicket.user_id !== filters.user?.id) {
              return false;
            }
            return true;
          };

          if (matchesFilters()) {
            // Add to the beginning of the list if it matches filters
            setTickets(prev => {
              // Check if ticket already exists (avoid duplicates)
              const exists = prev.some(t => t.id === newTicket.id);
              if (exists) return prev;

              // If we're on page 1, add it. Otherwise, just increment total count
              if (filters.currentPage === 1) {
                const updatedTickets = [newTicket, ...prev].slice(0, ticketsPerPage);
                // Update total count and pages
                setTotalTickets(prevCount => {
                  const newCount = prevCount + 1;
                  setTotalPages(Math.ceil(newCount / ticketsPerPage));
                  return newCount;
                });
                return updatedTickets;
              } else {
                // Just increment the count, don't add to list
                setTotalTickets(prevCount => {
                  const newCount = prevCount + 1;
                  setTotalPages(Math.ceil(newCount / ticketsPerPage));
                  return newCount;
                });
                return prev;
              }
            });

            // Refresh stats if admin
            if (filters.isAdmin) {
              fetchStats();
            }

            // Show notification
            toast.success(`New ticket: ${newTicket.subject || newTicket.ticket_number}`);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          console.log('Ticket updated:', payload.new);
          const updatedTicket = payload.new;
          const filters = filtersRef.current;

          // Check if ticket matches current filters
          const matchesFilters = () => {
            if (filters.statusFilter !== 'all' && updatedTicket.status !== filters.statusFilter) {
              return false;
            }
            if (filters.priorityFilter !== 'all' && updatedTicket.priority !== filters.priorityFilter) {
              return false;
            }
            if (filters.searchQuery) {
              const searchLower = filters.searchQuery.toLowerCase();
              const matchesSearch =
                updatedTicket.subject?.toLowerCase().includes(searchLower) ||
                updatedTicket.ticket_number?.toLowerCase().includes(searchLower);
              if (!matchesSearch) {
                return false;
              }
            }
            if (!filters.isAdmin && updatedTicket.user_id !== filters.user?.id) {
              return false;
            }
            return true;
          };

          setTickets(prev => {
            const ticketIndex = prev.findIndex(t => t.id === updatedTicket.id);

            // If ticket exists in current list
            if (ticketIndex !== -1) {
              // If it still matches filters, update it
              if (matchesFilters()) {
                const newTickets = [...prev];
                newTickets[ticketIndex] = updatedTicket;
                return newTickets;
              } else {
                // If it no longer matches filters, remove it
                const newTickets = prev.filter(t => t.id !== updatedTicket.id);
                setTotalTickets(prevCount => Math.max(0, prevCount - 1));
                return newTickets;
              }
            } else {
              // If ticket doesn't exist in current list but now matches filters, add it
              if (matchesFilters() && filters.currentPage === 1) {
                return [updatedTicket, ...prev].slice(0, ticketsPerPage);
              }
              return prev;
            }
          });

          // Update selected ticket if it's the one being viewed (need to check current selectedTicket)
          setSelectedTicket(prevSelected => {
            if (prevSelected?.id === updatedTicket.id) {
              return updatedTicket;
            }
            return prevSelected;
          });

          // Refresh stats if admin
          if (filters.isAdmin) {
            fetchStats();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          console.log('Ticket deleted:', payload.old);
          const deletedTicketId = payload.old.id;

          setTickets(prev => {
            const ticketExists = prev.some(t => t.id === deletedTicketId);
            if (ticketExists) {
              const newTickets = prev.filter(t => t.id !== deletedTicketId);
              setTotalTickets(prevCount => {
                const newCount = Math.max(0, prevCount - 1);
                setTotalPages(Math.max(1, Math.ceil(newCount / ticketsPerPage)));
                return newCount;
              });
              return newTickets;
            }
            return prev;
          });

          // Close modal if the deleted ticket is being viewed
          setSelectedTicket(prevSelected => {
            if (prevSelected?.id === deletedTicketId) {
              setShowTicketModal(false);
              return null;
            }
            return prevSelected;
          });

          // Refresh stats if admin
          const filters = filtersRef.current;
          if (filters.isAdmin) {
            fetchStats();
          }
        }
      )
      .subscribe((status) => {
        console.log('Tickets subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to tickets realtime updates');
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.error('Tickets subscription error or closed:', status);
          setIsRealtimeConnected(false);
        } else if (status === 'CLOSED') {
          setIsRealtimeConnected(false);
        }
      });

    ticketsSubscriptionRef.current = channel;

    // Cleanup function
    return () => {
      if (ticketsSubscriptionRef.current) {
        setIsRealtimeConnected(false);
        supabase.removeChannel(ticketsSubscriptionRef.current).then(() => {
          console.log('Tickets channel removed');
        });
        ticketsSubscriptionRef.current = null;
      }
    };
  }, [checkingViewPermission, hasViewPermission, user?.id, isAdmin]);

  // Calculate date range based on filter
  const getDateRange = () => {
    if (dateFilter === 'weekly') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    } else if (dateFilter === 'monthly') {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    } else if (dateFilter === 'manual' && startDate && endDate) {
      return { startDate, endDate };
    }
    return { startDate: undefined, endDate: undefined };
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRange();
      const filters = {
        page: currentPage,
        limit: ticketsPerPage,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };

      const response = await getTickets(filters);
      setTickets(response.data || []);
      setTotalTickets(response.pagination?.total || 0);
      setTotalPages(response.pagination?.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch tickets');
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await getTicketStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      setLoadingTicketDetails(true);
      const response = await getTicket(ticketId);
      setTicketMessages(response.data.messages || []);
      setTicketAttachments(response.data.attachments || []);
      setSelectedTicket(response.data.ticket);
    } catch (err) {
      toast.error('Failed to load ticket details');
    } finally {
      setLoadingTicketDetails(false);
    }
  };

  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);
  const ticketsSubscriptionRef = useRef(null);
  const textareaRef = useRef(null);
  // Refs for filters to avoid recreating subscriptions
  const filtersRef = useRef({ statusFilter, priorityFilter, searchQuery, isAdmin, currentPage, user });

  // Update filters ref when they change
  useEffect(() => {
    filtersRef.current = { statusFilter, priorityFilter, searchQuery, isAdmin, currentPage, user };
  }, [statusFilter, priorityFilter, searchQuery, isAdmin, currentPage, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticketMessages]);

  // Auto-resize textarea
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = window.innerHeight * 0.25; // 25vh
      const scrollHeight = textarea.scrollHeight;

      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [newMessage]);

  const handleViewTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setSelectedStatusValue('');
    setShowTicketModal(true);
    await fetchTicketDetails(ticket.id);

    // Unsubscribe from previous channel if exists
    if (subscriptionRef.current) {
      await supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    // Subscribe to real-time updates for this ticket
    const channel = supabase
      .channel(`ticket-${ticket.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticket.id}`
        },
        (payload) => {
          console.log('New message received:', payload.new);
          // Check if message already exists to avoid duplicates
          setTicketMessages(prev => {
            const exists = prev.some(msg => msg.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new];
          });
          // Refresh attachments
          fetchTicketDetails(ticket.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${ticket.id}`
        },
        (payload) => {
          console.log('Ticket updated:', payload.new);
          setSelectedTicket(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to ticket updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error');
        }
      });

    subscriptionRef.current = channel;
  };

  useEffect(() => {
    return () => {
      // Cleanup subscription when component unmounts or ticket changes
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current).then(() => {
          console.log('Channel removed');
        });
        subscriptionRef.current = null;
      }
    };
  }, [selectedTicket?.id]);

  // Cleanup subscription when modal closes
  useEffect(() => {
    if (!showTicketModal && subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current).then(() => {
        console.log('Channel removed on modal close');
      });
      subscriptionRef.current = null;
      setSelectedStatusValue('');
    }
  }, [showTicketModal]);

  // Reset selected status when ticket changes
  useEffect(() => {
    setSelectedStatusValue('');
  }, [selectedTicket?.id]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (ticketId = null, messageId = null, clearFiles = false) => {
    if (selectedFiles.length === 0) return [];

    setUploadingFiles(true);
    const uploadedAttachments = [];

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (ticketId) formData.append('ticket_id', ticketId);
        if (messageId) formData.append('message_id', messageId);

        const response = await apiClient.customerSupport.uploadAttachment(formData);
        uploadedAttachments.push(response.data);
      }
      // Only clear files if explicitly requested (for backward compatibility)
      if (clearFiles) {
        setSelectedFiles([]);
      }
      return uploadedAttachments;
    } catch (err) {
      toast.error('Failed to upload files');
      throw err;
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSendMessage = async () => {
    // Check permission before sending message
    if (!permissions.read) {
      toast.error('You do not have permission to send messages.');
      return;
    }

    // Validate: must have either message or files
    if (!newMessage.trim() && selectedFiles.length === 0) {
      toast.error('Please add a message or attach a file');
      return;
    }

    if (!selectedTicket) return;

    setSendingMessage(true);
    try {
      // Upload files first if any
      let attachments = [];
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedTicket.id, null, false);
      }

      // Send message (can be empty if attachments exist)
      await addMessage(selectedTicket.id, {
        message: newMessage.trim() || '', // Allow empty message if files exist
        is_internal: false,
        attachments: attachments
      });

      setNewMessage('');
      setSelectedFiles([]);
      setAiResponse('');
      setShowAiResponse(false);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
      await fetchTicketDetails(selectedTicket.id);
      await fetchTickets();
      toast.success(attachments.length > 0 ? 'Files sent successfully' : 'Message sent successfully');
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send message';
      toast.error(errorMessage);
    } finally {
      setSendingMessage(false);
      setUploadingFiles(false);
    }
  };

  const handleAiGenerateResponse = async () => {
    if (!selectedTicket || ticketMessages.length === 0) {
      toast.error('No messages available to generate response');
      return;
    }

    setAiGenerating(true);
    setShowAiResponse(false);
    setAiResponse('');

    try {
      // Get last 5 messages
      const last5Messages = ticketMessages.slice(-5).map(msg => ({
        sender: msg.sender_name || msg.sender_email || 'Unknown',
        message: msg.message || '',
        created_at: msg.created_at
      }));

      // Call backend proxy endpoint (avoids CORS issues)
      const response = await generateAiResponse(last5Messages);

      if (response.success && response.data && response.data.output) {
        setAiResponse(response.data.output);
        setShowAiResponse(true);
        toast.success('AI response generated successfully');
      } else {
        throw new Error('Invalid response format from AI service');
      }
    } catch (err) {
      console.error('Error generating AI response:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
        stack: err.stack
      });

      // Extract error message from various possible locations
      let errorMessage = 'Failed to generate AI response';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Add more context for network errors
      if (err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to reach the server. Please check your connection.';
      }

      toast.error(errorMessage);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUseAiResponse = () => {
    if (aiResponse.trim()) {
      setNewMessage(aiResponse);
      setShowAiResponse(false);
      // Trigger resize after setting the message
      setTimeout(() => {
        autoResizeTextarea();
      }, 0);
    }
  };

  const handleCreateTicket = async () => {
    // Check permission before creating
    if (!permissions.create) {
      toast.error('You do not have permission to create tickets.');
      setShowCreateModal(false);
      return;
    }

    if (!createFormData.subject.trim() || !createFormData.message.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    setCreatingTicket(true);
    try {
      // Upload files first
      const attachments = await uploadFiles();

      const ticketData = {
        subject: createFormData.subject.trim(),
        message: createFormData.message.trim(),
        category: createFormData.category.trim() || null,
        priority: createFormData.priority,
        attachments: attachments,
        user_id: (createFormData.user_id && createFormData.user_id.trim()) || null // User for whom ticket is being created (only send if not empty)
      };

      console.log('📤 Sending ticket data:', { ...ticketData, attachments: '...' });
      console.log('📤 Selected user_id from form:', createFormData.user_id);
      console.log('📤 Sending user_id to backend:', ticketData.user_id);

      const response = await createTicket(ticketData);
      toast.success('Support ticket created successfully');
      setShowCreateModal(false);
      setCreateFormData({
        subject: '',
        message: '',
        category: '',
        priority: 'medium',
        attachments: [],
        user_id: ''
      });
      setCustomCategory('');
      setShowCustomCategoryInput(false);
      setSelectedFiles([]);
      setSelectedUserForTicket(null);
      setUserSearchQuery('');
      setShowUserSearchResults(false);
      await fetchTickets();
      if (isAdmin) await fetchStats();
    } catch (err) {
      toast.error('Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;

    // Check permission before updating status
    if (!permissions.update) {
      toast.error('You do not have permission to update ticket status.');
      return;
    }

    setUpdatingStatus(true);
    try {
      await updateTicketStatus(selectedTicket.id, statusUpdateData);
      toast.success('Ticket updated successfully');
      await fetchTicketDetails(selectedTicket.id);
      await fetchTickets();
      if (isAdmin) await fetchStats();
    } catch (err) {
      toast.error('Failed to update ticket');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedTicket) return;

    // Check permission before updating status
    if (!permissions.update) {
      toast.error('You do not have permission to update ticket status.');
      return;
    }

    // Don't update if status hasn't changed
    if (!selectedStatusValue || selectedTicket.status === selectedStatusValue) {
      setSelectedStatusValue('');
      return;
    }

    setUpdatingStatus(true);
    try {
      await updateTicketStatus(selectedTicket.id, { status: selectedStatusValue });
      toast.success('Ticket status updated successfully');
      setSelectedStatusValue('');
      await fetchTicketDetails(selectedTicket.id);
      await fetchTickets();
      if (isAdmin) await fetchStats();
    } catch (err) {
      console.error('Error updating ticket status:', err);
      toast.error('Failed to update ticket status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleReadStatus = async (ticket, e) => {
    e.stopPropagation();

    // Check permission
    if (!permissions.update) {
      toast.error('You do not have permission to update ticket status.');
      return;
    }

    const newReadStatus = !ticket.has_unread_messages;

    try {
      // Update ticket read status directly via Supabase
      const { error } = await supabase
        .from('support_tickets')
        .update({ has_unread_messages: newReadStatus })
        .eq('id', ticket.id);

      if (error) {
        throw error;
      }

      // Update local state
      setTickets(prevTickets =>
        prevTickets.map(t =>
          t.id === ticket.id
            ? { ...t, has_unread_messages: newReadStatus }
            : t
        )
      );

      // Update selected ticket if it's the one being viewed
      if (selectedTicket && selectedTicket.id === ticket.id) {
        setSelectedTicket(prev => ({
          ...prev,
          has_unread_messages: newReadStatus
        }));
      }

      toast.success(newReadStatus ? 'Ticket marked as unread' : 'Ticket marked as read');

      // Refresh stats if admin
      if (isAdmin) {
        await fetchStats();
      }
    } catch (err) {
      console.error('Error toggling read status:', err);
      toast.error('Failed to update read status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: '#007bff',        // Blue
      in_progress: '#ffc107', // Yellow/Orange
      resolved: '#28a745',    // Green
      closed: '#6c757d',      // Gray
      pending: '#17a2b8'      // Cyan
    };
    return colors[status] || '#6c757d';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#6c757d',     // Gray
      medium: '#007bff',  // Blue
      high: '#ff9800',    // Orange
      urgent: '#dc3545'   // Red
    };
    return colors[priority] || '#6c757d';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate export date range based on export filter
  const getExportDateRange = () => {
    if (exportDateFilter === 'weekly') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    } else if (exportDateFilter === 'monthly') {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    } else if (exportDateFilter === 'manual' && exportStartDate && exportEndDate) {
      return { startDate: exportStartDate, endDate: exportEndDate };
    }
    return { startDate: undefined, endDate: undefined };
  };

  const handleExportCSV = async () => {
    try {
      setExportingCSV(true);
      const dateRange = getExportDateRange();
      const filters = {
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };

      // Call the export API
      const response = await exportTickets(filters);

      if (!response?.data) {
        toast.error('No data to export');
        return;
      }

      // Handle blob response
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'text/csv;charset=utf-8' });

      if (blob.size < 50) {
        toast.error('No tickets match the selected filters');
        return;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `tickets-${dateStr}.csv`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success('Tickets exported successfully');
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting tickets:', error);
      // Display the error message from the backend
      const errorMessage = error.message || 'Failed to export tickets';
      toast.error(errorMessage);
    } finally {
      setExportingCSV(false);
    }
  };

  // Show loading while checking permission
  if (checkingViewPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasViewPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3>Access Denied</h3>
          <p>You do not have permission to view customer support.</p>
          <button
            onClick={() => history.push('/admin/users')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          width: '100%',
          gap: '16px'
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              flexWrap: 'wrap'
            }}>
              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#2c3e50', margin: 0 }}>
                Customer Support
              </h1>
              {/* Realtime Connection Status */}
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: isRealtimeConnected ? '#d4edda' : '#f8d7da',
                color: isRealtimeConnected ? '#28a745' : '#dc3545',
                border: `1px solid ${isRealtimeConnected ? '#28a745' : '#dc3545'}20`,
                flexShrink: 0
              }}>
                {isRealtimeConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isRealtimeConnected ? '#28a745' : '#dc3545',
                  animation: isRealtimeConnected ? 'pulse 2s infinite' : 'none'
                }} />
                {isRealtimeConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              gap: '16px',
              marginTop: '0',
              flexWrap: 'wrap',
              width: '100%'
            }}>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#2c3e50', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#6c757d' }}>Loading...</span>
                  ) : (
                    <>{(stats?.total || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#6c757d' }}>tickets</span></>
                  )}
                </div>
              </div>
              <div style={{
                backgroundColor: '#e7f3ff',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #b3d9ff',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#0066cc', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Open
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#007bff', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#0066cc' }}>Loading...</span>
                  ) : (
                    <>{(stats?.open || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#0066cc' }}>tickets</span></>
                  )}
                </div>
              </div>
              <div style={{
                backgroundColor: '#fff3cd',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #ffd700',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#856404', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  In Progress
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffc107', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#856404' }}>Loading...</span>
                  ) : (
                    <>{(stats?.in_progress || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#856404' }}>tickets</span></>
                  )}
                </div>
              </div>
              <div style={{
                backgroundColor: '#f8d7da',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #f5c6cb',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#721c24', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Unread
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#721c24' }}>Loading...</span>
                  ) : (
                    <>{(stats?.unread_messages || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#721c24' }}>tickets</span></>
                  )}
                </div>
              </div>

              {/* Priority-based Stat Boxes */}
              <div style={{
                backgroundColor: '#e8f5e9',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #c8e6c9',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Low Priority
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#4caf50', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#2e7d32' }}>Loading...</span>
                  ) : (
                    <>{(stats?.priority_low || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#2e7d32' }}>tickets</span></>
                  )}
                </div>
              </div>
              <div style={{
                backgroundColor: '#fff9e6',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #ffe082',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#f57c00', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Medium Priority
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ff9800', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#f57c00' }}>Loading...</span>
                  ) : (
                    <>{(stats?.priority_medium || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#f57c00' }}>tickets</span></>
                  )}
                </div>
              </div>
              <div style={{
                backgroundColor: '#ffe0b2',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #ffb74d',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#e65100', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  High Priority
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ff6f00', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#e65100' }}>Loading...</span>
                  ) : (
                    <>{(stats?.priority_high || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#e65100' }}>tickets</span></>
                  )}
                </div>
              </div>
              <div style={{
                backgroundColor: '#ffebee',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #ef5350',
                width: 'calc(25% - 12px)',
                minWidth: '140px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '12px', color: '#c62828', marginBottom: '6px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Urgent Priority
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#d32f2f', lineHeight: '1.2' }}>
                  {stats === null ? (
                    <span style={{ fontSize: '16px', color: '#c62828' }}>Loading...</span>
                  ) : (
                    <>{(stats?.priority_urgent || 0)} <span style={{ fontSize: '14px', fontWeight: '400', color: '#c62828' }}>tickets</span></>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginTop: '24px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '40%', minWidth: '250px' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6c757d',
                  zIndex: 1
                }}
              />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
                if (e.target.value !== 'manual') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Dates</option>
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">Last 30 Days</option>
              <option value="manual">Custom Range</option>
            </select>
            {dateFilter === 'manual' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  placeholder="Start Date"
                />
                <span style={{ color: '#6c757d' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  placeholder="End Date"
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            {!checkingPermissions && permissions.create && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  backgroundColor: '#8a3b9a',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(138, 59, 154, 0.2)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#74317e';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(138, 59, 154, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#8a3b9a';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(138, 59, 154, 0.2)';
                }}
              >
                <Plus size={18} />
                New Ticket
              </button>
            )}
            <button
              onClick={() => setShowExportModal(true)}
              style={{
                backgroundColor: '#8a3b9a',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(138, 59, 154, 0.2)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#74317e';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(138, 59, 154, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#8a3b9a';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(138, 59, 154, 0.2)';
              }}
              title="Export tickets to CSV"
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading tickets...</p>
          </div>
        ) : error ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#fee',
            borderRadius: '8px',
            color: '#c33'
          }}>
            <p>{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <MessageSquare size={48} color="#6c757d" style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', color: '#6c757d', margin: 0 }}>
              {searchQuery ? 'No tickets found matching your search.' : 'No support tickets yet.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Ticket #</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Subject</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>User</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Priority</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>Created</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#495057' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket, index) => (
                    <tr
                      key={ticket.id}
                      style={{
                        borderBottom: '1px solid #dee2e6',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <td style={{ padding: '12px', color: '#212529', fontWeight: '600' }}>
                        {ticket.ticket_number}
                      </td>
                      <td style={{ padding: '12px', color: '#212529', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {ticket.has_unread_messages && (
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#dc3545',
                              display: 'inline-block',
                              flexShrink: 0
                            }} title="Unread messages" />
                          )}
                          <span style={{ fontWeight: ticket.has_unread_messages ? '600' : '400' }}>
                            {ticket.subject}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#6c757d' }}>
                        {ticket.user_name || ticket.user_email}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block',
                          backgroundColor: getStatusColor(ticket.status) + '20',
                          color: getStatusColor(ticket.status),
                          border: `1px solid ${getStatusColor(ticket.status)}40`,
                          textTransform: 'capitalize',
                          letterSpacing: '0.3px'
                        }}>
                          {ticket.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '6px 14px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block',
                          backgroundColor: getPriorityColor(ticket.priority) + '20',
                          color: getPriorityColor(ticket.priority),
                          border: `1px solid ${getPriorityColor(ticket.priority)}40`,
                          textTransform: 'capitalize',
                          letterSpacing: '0.3px'
                        }}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#6c757d', fontSize: '13px' }}>
                        {formatDate(ticket.created_at)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={(e) => handleToggleReadStatus(ticket, e)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: ticket.has_unread_messages ? '#dc3545' : '#28a745',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s'
                            }}
                            title={ticket.has_unread_messages ? 'Mark as read' : 'Mark as unread'}
                          >
                            {ticket.has_unread_messages ? <Mail size={18} /> : <MailOpen size={18} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTicket(ticket);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: '#8a3b9a'
                            }}
                            title="View ticket"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '24px',
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ color: '#6c757d', fontSize: '14px' }}>
                  Showing {((currentPage - 1) * ticketsPerPage) + 1} to {Math.min(currentPage * ticketsPerPage, totalTickets)} of {totalTickets} tickets
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      backgroundColor: currentPage === 1 ? '#f8f9fa' : 'white',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: currentPage === 1 ? '#adb5bd' : '#495057'
                    }}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span style={{ padding: '0 12px', color: '#495057', fontSize: '14px' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      backgroundColor: currentPage === totalPages ? '#f8f9fa' : 'white',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: currentPage === totalPages ? '#adb5bd' : '#495057'
                    }}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create Ticket Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '12px',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateModal(false);
              }
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '95vh',
              overflow: 'auto',
              margin: 'auto',
              boxSizing: 'border-box'
            }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: 'clamp(20px, 4vw, 24px)',
                  fontWeight: '700',
                  flex: '1 1 auto',
                  minWidth: '200px'
                }}>Create Support Ticket</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFormData({
                      subject: '',
                      message: '',
                      category: '',
                      priority: 'medium',
                      attachments: [],
                      user_id: ''
                    });
                    setCustomCategory('');
                    setShowCustomCategoryInput(false);
                    setSelectedFiles([]);
                    setSelectedUserForTicket(null);
                    setUserSearchQuery('');
                    setShowUserSearchResults(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#6c757d',
                    flexShrink: 0
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={createFormData.subject}
                  onChange={(e) => setCreateFormData({ ...createFormData, subject: e.target.value })}
                  placeholder="Enter ticket subject"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                  Message *
                </label>
                <textarea
                  value={createFormData.message}
                  onChange={(e) => setCreateFormData({ ...createFormData, message: e.target.value })}
                  placeholder="Describe your issue..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                    Category
                  </label>
                  <select
                    value={showCustomCategoryInput ? 'other' : (createFormData.category || '')}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      if (selectedValue === 'other') {
                        setShowCustomCategoryInput(true);
                        setCustomCategory('');
                        setCreateFormData({ ...createFormData, category: '' });
                      } else {
                        setShowCustomCategoryInput(false);
                        setCustomCategory('');
                        setCreateFormData({ ...createFormData, category: selectedValue });
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent typing in select - only allow arrow keys and enter
                      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      marginBottom: showCustomCategoryInput ? '8px' : '0',
                      WebkitAppearance: 'menulist',
                      MozAppearance: 'menulist',
                      appearance: 'menulist'
                    }}
                  >
                    <option value="">Select a category</option>
                    <option value="general">General</option>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="other">Other (Custom)</option>
                  </select>
                  {showCustomCategoryInput && (
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => {
                        const customValue = e.target.value;
                        setCustomCategory(customValue);
                        setCreateFormData({ ...createFormData, category: customValue.trim() });
                      }}
                      placeholder="Enter custom category"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        marginTop: '8px'
                      }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                    Priority
                  </label>
                  <select
                    value={createFormData.priority}
                    onChange={(e) => setCreateFormData({ ...createFormData, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px', position: 'relative' }} data-user-search-container>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                  Create Ticket For (User) - Search by Email
                </label>
                {selectedUserForTicket ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1px solid #74317e',
                    borderRadius: '8px',
                    backgroundColor: '#f9f5fa'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#495057' }}>
                        {selectedUserForTicket.full_name || selectedUserForTicket.name || selectedUserForTicket.email}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                        {selectedUserForTicket.email}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUserForTicket(null);
                        setUserSearchQuery('');
                        setCreateFormData({ ...createFormData, user_id: '' });
                        setShowUserSearchResults(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: '#dc3545',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setShowUserSearchResults(true);
                        }}
                        onFocus={() => {
                          if (userSearchResults.length > 0) {
                            setShowUserSearchResults(true);
                          }
                        }}
                        placeholder="Search user by email (optional - defaults to yourself)"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      {searchingUsers && (
                        <div style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '12px',
                          color: '#6c757d'
                        }}>
                          Searching...
                        </div>
                      )}
                    </div>
                    {showUserSearchResults && userSearchResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {userSearchResults.map((user) => {
                          const userId = user.id || user.user_id;
                          const userName = user.full_name || user.name || user.email;
                          const userEmail = user.email || '';
                          return (
                            <div
                              key={userId}
                              onClick={() => {
                                setSelectedUserForTicket(user);
                                setCreateFormData({ ...createFormData, user_id: userId });
                                setUserSearchQuery(userEmail);
                                setShowUserSearchResults(false);
                              }}
                              style={{
                                padding: '12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              <div style={{ fontWeight: '500', fontSize: '14px', color: '#495057' }}>
                                {userName}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                                {userEmail}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {showUserSearchResults && userSearchQuery.length >= 2 && !searchingUsers && userSearchResults.length === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginTop: '4px',
                        padding: '12px',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        fontSize: '14px',
                        color: '#6c757d',
                        textAlign: 'center'
                      }}>
                        No users found
                      </div>
                    )}
                  </>
                )}
                {selectedUserForTicket && (
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d', fontStyle: 'italic' }}>
                    This ticket will be created on behalf of the selected user
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                  Attachments
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ marginBottom: '8px' }}
                />
                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {selectedFiles.map((file, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontSize: '13px', color: '#495057' }}>{file.name}</span>
                        <button
                          onClick={() => removeFile(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#dc3545'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFormData({
                      subject: '',
                      message: '',
                      category: '',
                      priority: 'medium',
                      attachments: [],
                      user_id: ''
                    });
                    setCustomCategory('');
                    setShowCustomCategoryInput(false);
                    setSelectedFiles([]);
                    setSelectedUserForTicket(null);
                    setUserSearchQuery('');
                    setShowUserSearchResults(false);
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flex: '1 1 auto',
                    minWidth: '120px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTicket}
                  disabled={creatingTicket || uploadingFiles}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#8a3b9a',
                    color: 'white',
                    cursor: creatingTicket || uploadingFiles ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: creatingTicket || uploadingFiles ? 0.6 : 1,
                    flex: '1 1 auto',
                    minWidth: '120px'
                  }}
                >
                  {creatingTicket || uploadingFiles ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export CSV Modal */}
        {showExportModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowExportModal(false);
              }
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2c3e50' }}>
                  Export Tickets to CSV
                </h2>
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setExportDateFilter('all');
                    setExportStartDate('');
                    setExportEndDate('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#6c757d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{
                  margin: '0 0 16px 0',
                  fontSize: '14px',
                  color: '#6c757d',
                  lineHeight: '1.5'
                }}>
                  Select a date range for the tickets you want to export. The export will include all tickets matching your current filters (status, priority, search) within the selected date range.
                </p>

                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#495057',
                  fontSize: '14px'
                }}>
                  Date Range
                </label>
                <select
                  value={exportDateFilter}
                  onChange={(e) => {
                    setExportDateFilter(e.target.value);
                    if (e.target.value !== 'manual') {
                      setExportStartDate('');
                      setExportEndDate('');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="all">All Dates</option>
                  <option value="weekly">Last 7 Days</option>
                  <option value="monthly">Last 30 Days</option>
                  <option value="manual">Custom Range</option>
                </select>
              </div>

              {exportDateFilter === 'manual' && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#495057',
                        fontSize: '13px'
                      }}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#495057',
                        fontSize: '13px'
                      }}>
                        End Date
                      </label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                  {exportStartDate && exportEndDate && exportStartDate > exportEndDate && (
                    <p style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#dc3545'
                    }}>
                      Start date must be before end date
                    </p>
                  )}
                </div>
              )}

              <div style={{
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#6c757d',
                  fontWeight: '500'
                }}>
                  Current Filters:
                </p>
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#495057',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {statusFilter !== 'all' && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}>
                      Status: {statusFilter}
                    </span>
                  )}
                  {priorityFilter !== 'all' && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}>
                      Priority: {priorityFilter}
                    </span>
                  )}
                  {searchQuery && (
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}>
                      Search: {searchQuery}
                    </span>
                  )}
                  {!statusFilter && !priorityFilter && !searchQuery && (
                    <span style={{ color: '#6c757d' }}>No additional filters applied</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setExportDateFilter('all');
                    setExportStartDate('');
                    setExportEndDate('');
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    color: '#495057',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={exportingCSV || (exportDateFilter === 'manual' && (!exportStartDate || !exportEndDate || exportStartDate > exportEndDate))}
                  style={{
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: exportingCSV ? '#6c757d' : '#8a3b9a',
                    color: 'white',
                    cursor: exportingCSV || (exportDateFilter === 'manual' && (!exportStartDate || !exportEndDate || exportStartDate > exportEndDate)) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    opacity: exportingCSV || (exportDateFilter === 'manual' && (!exportStartDate || !exportEndDate || exportStartDate > exportEndDate)) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={18} />
                  {exportingCSV ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ticket Detail Modal */}
        {showTicketModal && selectedTicket && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
                      {selectedTicket.ticket_number}
                    </h2>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: getStatusColor(selectedTicket.status) + '20',
                      color: getStatusColor(selectedTicket.status)
                    }}>
                      {selectedTicket.status?.replace('_', ' ').toUpperCase()}
                    </span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: getPriorityColor(selectedTicket.priority) + '20',
                      color: getPriorityColor(selectedTicket.priority)
                    }}>
                      {selectedTicket.priority?.toUpperCase()}
                    </span>
                  </div>
                  <h3 style={{ margin: '8px 0', fontSize: '18px', fontWeight: '600', color: '#495057' }}>
                    {selectedTicket.subject}
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6c757d', marginTop: '8px' }}>
                    <span>From: {selectedTicket.user_name || selectedTicket.user_email}</span>
                    <span>Created: {formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTicketModal(false);
                    setSelectedTicket(null);
                    setSelectedStatusValue('');
                    setTicketMessages([]);
                    setTicketAttachments([]);
                    setNewMessage('');
                    setSelectedFiles([]);
                    setLoadingTicketDetails(false);
                    setAiResponse('');
                    setShowAiResponse(false);
                    setAiGenerating(false);
                    // Reset textarea height
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                      textareaRef.current.style.overflowY = 'hidden';
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#6c757d'
                  }}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Admin Status Update */}
              {isAdmin && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  marginBottom: '24px',
                  flexShrink: 0
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Update Ticket</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Status</label>
                      <select
                        value={statusUpdateData.status || selectedTicket.status}
                        onChange={(e) => setStatusUpdateData({ ...statusUpdateData, status: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Priority</label>
                      <select
                        value={statusUpdateData.priority || selectedTicket.priority}
                        onChange={(e) => setStatusUpdateData({ ...statusUpdateData, priority: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: '#8a3b9a',
                      color: 'white',
                      cursor: updatingStatus ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      opacity: updatingStatus ? 0.6 : 1
                    }}
                  >
                    {updatingStatus ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              )}

              {/* Messages - Chat Style */}
              <div style={{
                flex: '1 1 auto',
                marginBottom: '16px',
                minHeight: '200px',
                maxHeight: showAiResponse ? '350px' : '500px',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {loadingTicketDetails ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '300px',
                    padding: '40px',
                    color: '#6c757d'
                  }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #8a3b9a',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '16px'
                    }} />
                    <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                      Loading ticket details...
                    </p>
                  </div>
                ) : ticketMessages.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#6c757d',
                    fontSize: '14px'
                  }}>
                    No messages yet. Start the conversation...
                  </div>
                ) : (
                  ticketMessages.map((message) => {
                    // Check if message is from current user based on email comparison
                    const currentUserEmail = profile?.email || user?.email;
                    const isCurrentUser = message.sender_email === currentUserEmail;
                    const messageAttachments = ticketAttachments.filter(a => a.message_id === message.id);

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: 'flex',
                          justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                          marginBottom: '4px'
                        }}
                      >
                        <div style={{
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isCurrentUser ? 'flex-end' : 'flex-start'
                        }}>
                          <div style={{
                            padding: '8px 12px',
                            borderRadius: '12px',
                            backgroundColor: isCurrentUser ? '#8a3b9a' : '#ffffff',
                            color: isCurrentUser ? '#ffffff' : '#212529',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            wordWrap: 'break-word',
                            fontSize: '14px',
                            lineHeight: '1.4'
                          }}>
                            {!isCurrentUser && (
                              <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                marginBottom: '4px',
                                color: '#6c757d'
                              }}>
                                {message.sender_name || message.sender_email}
                              </div>
                            )}
                            {/* Show message text - hide placeholder if attachments exist */}
                            {message.message &&
                              !(message.message === '(File attachment)' && messageAttachments.length > 0) && (
                                <div style={{
                                  whiteSpace: 'pre-wrap',
                                  marginBottom: messageAttachments.length > 0 ? '8px' : '0',
                                  fontStyle: message.message === '(File attachment)' ? 'italic' : 'normal',
                                  color: message.message === '(File attachment)'
                                    ? (isCurrentUser ? 'rgba(255,255,255,0.8)' : '#6c757d')
                                    : undefined
                                }}>
                                  {message.message === '(File attachment)' ? 'File attachment' : message.message}
                                </div>
                              )}
                            {messageAttachments.length > 0 && (
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                marginTop: '8px',
                                paddingTop: '8px',
                                borderTop: `1px solid ${isCurrentUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'}`
                              }}>
                                {messageAttachments.map((attachment) => {
                                  // Use file_url if available (from upload response), otherwise construct from file_path
                                  const fileUrl = attachment.file_url ||
                                    (attachment.file_path?.startsWith('http')
                                      ? attachment.file_path
                                      : `${process.env.REACT_APP_SUPABASE_URL_PRODUCTION}/storage/v1/object/public/support-attachments/${attachment.file_path}`);

                                  return (
                                    <a
                                      key={attachment.id}
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={attachment.file_name}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 10px',
                                        backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                        color: isCurrentUser ? '#ffffff' : '#495057',
                                        fontSize: '12px',
                                        transition: 'background-color 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isCurrentUser ? 'rgba(255,255,255,0.3)' : '#e0e0e0';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isCurrentUser ? 'rgba(255,255,255,0.2)' : '#f0f0f0';
                                      }}
                                    >
                                      <FileText size={14} />
                                      <span style={{
                                        maxWidth: '200px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {attachment.file_name}
                                      </span>
                                      <Download size={12} />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#6c757d',
                            marginTop: '4px',
                            padding: '0 4px'
                          }}>
                            {formatDate(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Section - Compact Chat Input */}
              <div style={{
                padding: '12px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                flexShrink: 0,
                maxHeight: showAiResponse ? '280px' : '200px',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                {/* AI Generate Response Button */}
                {ticketMessages.length > 0 && (
                  <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    {/* <button
                    onClick={handleAiGenerateResponse}
                    disabled={aiGenerating}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: aiGenerating ? '#6c757d' : '#17a2b8',
                      color: 'white',
                      cursor: aiGenerating ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      opacity: aiGenerating ? 0.6 : 1,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <Sparkles size={14} />
                    {aiGenerating ? 'Generating...' : 'AI Generate '}
                  </button> */}
                  </div>
                )}

                {/* AI Response Display */}
                {showAiResponse && aiResponse && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: '#e7f3ff',
                    border: '1px solid #17a2b8',
                    borderRadius: '8px',
                    borderLeft: '4px solid #17a2b8',
                    maxHeight: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px',
                      flexShrink: 0
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#17a2b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Sparkles size={12} />
                        AI Generated Response
                      </div>
                      <button
                        onClick={() => {
                          setShowAiResponse(false);
                          setAiResponse('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          color: '#6c757d',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#212529',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5',
                      marginBottom: '8px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      flex: '1 1 auto',
                      minHeight: 0,
                      maxHeight: '80px',
                      paddingRight: '8px',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      {aiResponse}
                    </div>
                    <button
                      onClick={handleUseAiResponse}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                        marginTop: 'auto'
                      }}
                    >
                      <Send size={12} />
                      Use This Response
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedFiles.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {selectedFiles.map((file, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '6px',
                            fontSize: '11px',
                            border: '1px solid #ddd'
                          }}>
                            <FileText size={10} />
                            <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.name}
                            </span>
                            <button
                              onClick={() => removeFile(index)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                color: '#dc3545',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        autoResizeTextarea();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (newMessage.trim() || selectedFiles.length > 0) {
                            handleSendMessage();
                          }
                        }
                      }}
                      placeholder={selectedFiles.length > 0 ? "Add a message (optional)..." : "Type your message or attach a file..."}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '20px',
                        fontSize: '14px',
                        resize: 'none',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        minHeight: '44px',
                        maxHeight: '25vh',
                        overflowY: 'auto',
                        lineHeight: '1.5'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#8a3b9a'}
                      onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      id="file-input-ticket"
                    />
                    <label
                      htmlFor="file-input-ticket"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #ddd',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    >
                      <Paperclip size={18} color="#6c757d" />
                    </label>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <select
                          value={selectedStatusValue || selectedTicket?.status || ''}
                          onChange={(e) => setSelectedStatusValue(e.target.value)}
                          disabled={updatingStatus}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '14px',
                            cursor: updatingStatus ? 'not-allowed' : 'pointer',
                            backgroundColor: 'white',
                            color: '#495057',
                            fontWeight: '500',
                            minWidth: '140px',
                            opacity: updatingStatus ? 0.6 : 1
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                        {selectedStatusValue && selectedStatusValue !== selectedTicket?.status && (
                          <button
                            onClick={handleStatusChange}
                            disabled={updatingStatus}
                            style={{
                              padding: '8px',
                              border: 'none',
                              borderRadius: '6px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              cursor: updatingStatus ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: updatingStatus ? 0.6 : 1,
                              transition: 'opacity 0.2s'
                            }}
                            title="Confirm status change"
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || uploadingFiles || (!newMessage.trim() && selectedFiles.length === 0)}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '20px',
                        backgroundColor: '#8a3b9a',
                        color: 'white',
                        cursor: sendingMessage || uploadingFiles || (!newMessage.trim() && selectedFiles.length === 0) ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        opacity: sendingMessage || uploadingFiles || (!newMessage.trim() && selectedFiles.length === 0) ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <Send size={16} />
                      {sendingMessage || uploadingFiles ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Customers;
