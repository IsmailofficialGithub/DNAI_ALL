import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHistory } from "react-router-dom";
import { Calendar, Plus, MoreVertical, X, Clock, Globe, Users, CheckCircle, XCircle, Pause, Play, Search, Target, Eye, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllCampaigns, cancelCampaign, pauseCampaign, resumeCampaign, getAllBots, getAllContactLists, getAllLeads, getAllCalls } from "api/backend/genie";
import { usePermissions } from "hooks/usePermissions";
import { useGenieWebSocket } from "hooks/useGenieWebSocket";
import CreateCampaignModal from "./CreateCampaignModal";
import ConfirmationModal from "../ui/ConfirmationModal";
import toast from "react-hot-toast";

function CampaignsTab() {
  const history = useHistory();
  const { hasPermission } = usePermissions();
  const { lastCampaignEvent, joinCampaign, leaveCampaign } = useGenieWebSocket();
  
  // State
  const [allCampaigns, setAllCampaigns] = useState([]); // Master list of all loaded campaigns
  const [bots, setBots] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters - initialize with "in_progress" for first load
  const [statusFilter, setStatusFilter] = useState("in_progress");
  const [leadFilter, setLeadFilter] = useState("");
  const [campaignSearchInput, setCampaignSearchInput] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [consumerSearchInput, setConsumerSearchInput] = useState("");
  const [consumerSearch, setConsumerSearch] = useState("");
  
  // Track which filter combinations have been loaded
  const loadedFilterKeys = useRef(new Set());
  const allCampaignsRef = useRef([]);
  
  // Track last loaded campaign and modal type to avoid unnecessary API calls
  const lastLoadedCampaignRef = useRef({ campaignId: null, modalType: null });
  
  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Cancel Confirmation Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Leads Modal
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [campaignLeads, setCampaignLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [selectedCampaignForLeads, setSelectedCampaignForLeads] = useState(null);

  // Campaign Calls/Contacts Modal
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [modalType, setModalType] = useState(null); // 'contacts', 'completed', 'failed'
  const [campaignCalls, setCampaignCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [selectedCampaignForCalls, setSelectedCampaignForCalls] = useState(null);
  const [isModalJustOpened, setIsModalJustOpened] = useState(false);
  
  // Calls Modal Filters
  const [callsSearchQuery, setCallsSearchQuery] = useState("");
  const [callsStartDate, setCallsStartDate] = useState("");
  const [callsEndDate, setCallsEndDate] = useState("");
  const [callsMinDuration, setCallsMinDuration] = useState("");
  
  // Check if any filters are active
  const hasActiveFilters = callsSearchQuery.trim() || callsStartDate || callsEndDate || callsMinDuration;
  
  // Calls Modal Pagination
  const [callsCurrentPage, setCallsCurrentPage] = useState(1);
  const [callsTotalPages, setCallsTotalPages] = useState(1);
  const [callsTotalCount, setCallsTotalCount] = useState(0);
  const callsLimit = 10;
  
  // Currently playing call
  const [playingCallId, setPlayingCallId] = useState(null);
  const [playingCall, setPlayingCall] = useState(null);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRefs = useRef({});

  // Permissions
  const canCreate = hasPermission('genie.campaigns.create');
  const canDelete = hasPermission('genie.campaigns.delete');
  const canUpdate = hasPermission('genie.campaigns.update');

  // Generate cache key from filters (for tracking what's been loaded)
  const getFilterKey = useCallback((status, lead, campaignSearch, consumerSearch) => {
    // Only use status and leadFilter for cache key (search filters are client-side)
    return `${status || 'all'}_${lead || 'all'}`;
  }, []);

  // Fetch campaigns with caching
  const fetchCampaigns = useCallback(async (forceRefresh = false) => {
    const filterKey = getFilterKey(statusFilter, leadFilter, campaignSearch, consumerSearch);
    
    // Check if we already have this filter combination loaded
    if (!forceRefresh && loadedFilterKeys.current.has(filterKey)) {
      console.log(`✅ Filter combination already loaded: ${filterKey}, using cached data`);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = {
        limit: 50,
        status: statusFilter || undefined,
        hasLeads: leadFilter || undefined,
        campaignSearch: campaignSearch || undefined,
        consumerSearch: consumerSearch || undefined,
      };

      const response = await getAllCampaigns(params);
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      const fetchedCampaigns = response?.data || [];
      
      // Mark this filter combination as loaded
      loadedFilterKeys.current.add(filterKey);
      
      // Merge with existing campaigns (update existing, add new)
      setAllCampaigns(prevCampaigns => {
        const campaignMap = new Map(prevCampaigns.map(c => [c.id, c]));
        
        // Update existing campaigns or add new ones
        fetchedCampaigns.forEach(campaign => {
          campaignMap.set(campaign.id, campaign);
        });
        
        const merged = Array.from(campaignMap.values());
        allCampaignsRef.current = merged; // Update ref for cleanup
        console.log(`📦 Merged campaigns: ${prevCampaigns.length} existing, ${fetchedCampaigns.length} fetched, ${merged.length} total`);
        return merged;
      });
      
      // Join rooms for active campaigns
      fetchedCampaigns.forEach(campaign => {
        if (campaign.runtime_call_status || campaign.status === 'running') {
          joinCampaign(campaign.id);
        }
      });
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, leadFilter, campaignSearch, consumerSearch, joinCampaign, getFilterKey]);

  // Filter campaigns client-side based on current filters
  const filteredCampaigns = React.useMemo(() => {
    let filtered = [...allCampaigns];

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(campaign => {
        const isRunning = campaign.runtime_call_status || campaign.status === 'running' || campaign.status === 'in_progress';
        if (statusFilter === 'in_progress') {
          return isRunning || campaign.status === 'in_progress' || campaign.status === 'running';
        }
        return campaign.status === statusFilter;
      });
    }

    // Filter by leads
    if (leadFilter) {
      const shouldHaveLeads = leadFilter === 'true';
      filtered = filtered.filter(campaign => {
        const hasLeads = (campaign.leads_count || 0) > 0;
        return shouldHaveLeads ? hasLeads : !hasLeads;
      });
    }

    // Filter by campaign search (bot name, contact list name)
    if (campaignSearch && campaignSearch.trim()) {
      const searchTerm = campaignSearch.trim().toLowerCase();
      filtered = filtered.filter(campaign => {
        const botName = (campaign.genie_bots?.name || "").toLowerCase();
        const listName = (campaign.genie_contact_lists?.name || "").toLowerCase();
        return botName.includes(searchTerm) || listName.includes(searchTerm);
      });
    }

    // Filter by consumer search
    if (consumerSearch && consumerSearch.trim()) {
      const searchTerm = consumerSearch.trim().toLowerCase();
      filtered = filtered.filter(campaign => {
        const consumerName = (campaign.consumer_name || "").toLowerCase();
        const consumerEmail = (campaign.consumer_email || "").toLowerCase();
        return consumerName.includes(searchTerm) || consumerEmail.includes(searchTerm);
      });
    }

    return filtered;
  }, [allCampaigns, statusFilter, leadFilter, campaignSearch, consumerSearch]);

  // Fetch supporting data
  const fetchSupportingData = useCallback(async () => {
    try {
      const [botsRes, listsRes] = await Promise.all([
        getAllBots(),
        getAllContactLists(),
      ]);
      
      if (!botsRes?.error) setBots(botsRes?.data || []);
      if (!listsRes?.error) setContactLists(listsRes?.data || []);
    } catch (error) {
      console.error("Error fetching supporting data:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSupportingData();
    fetchCampaigns();
    
    return () => {
      // Cleanup: leave all campaign rooms on unmount
      allCampaignsRef.current.forEach(c => leaveCampaign(c.id));
    };
  }, []);

  // Debounce campaign search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setCampaignSearch(campaignSearchInput);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [campaignSearchInput]);

  // Debounce consumer search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setConsumerSearch(consumerSearchInput);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [consumerSearchInput]);

  // Fetch campaigns when filters change (only if not cached)
  useEffect(() => {
    fetchCampaigns(false);
  }, [statusFilter, leadFilter, campaignSearch, consumerSearch, fetchCampaigns]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!openDropdown) return;
      
      const dropdownRef = dropdownRefs.current[openDropdown];
      const clickedElement = event.target;
      
      // Check if click is inside the dropdown
      if (dropdownRef && dropdownRef.contains(clickedElement)) {
        return;
      }
      
      // Check if click is on the toggle button (the three dots button)
      const isToggleButton = clickedElement.closest('button')?.querySelector('svg');
      if (isToggleButton) {
        // Check if it's the toggle for the open dropdown
        const buttonParent = clickedElement.closest('div[style*="position: relative"]');
        if (buttonParent && buttonParent.querySelector(`[data-dropdown-id="${openDropdown}"]`)) {
          return; // It's the toggle for this dropdown, don't close
        }
      }
      
      console.log('Click outside dropdown detected, closing');
      setOpenDropdown(null);
    };

    if (openDropdown) {
      // Small delay to avoid immediate closure
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openDropdown]);

  // Real-time updates
  useEffect(() => {
    if (lastCampaignEvent) {
      const eventData = lastCampaignEvent.data;
      setAllCampaigns(prev => {
        const updated = prev.map(c => {
          if (c.id === eventData?.id) {
            return {
              ...c,
              ...eventData,
              progress_percent: eventData.progress_percent || c.progress_percent,
            };
          }
          return c;
        });
        allCampaignsRef.current = updated; // Update ref
        return updated;
      });
    }
  }, [lastCampaignEvent]);

  // Open cancel modal
  const openCancelModal = (campaign) => {
    console.log('openCancelModal called', campaign);
    if (!canDelete) {
      toast.error("You don't have permission to cancel campaigns");
      return;
    }
    setSelectedCampaign(campaign);
    setIsCancelModalOpen(true);
    setOpenDropdown(null);
  };

  // Close cancel modal
  const closeCancelModal = () => {
    setIsCancelModalOpen(false);
    setSelectedCampaign(null);
  };

  // Confirm cancel campaign
  const confirmCancelCampaign = async () => {
    if (!selectedCampaign?.id) return;
    
    setCancelLoading(true);
    try {
      const response = await cancelCampaign(selectedCampaign.id);
      if (response?.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Campaign cancelled successfully");
      fetchCampaigns(true); // Force refresh to get updated status
      closeCancelModal();
    } catch (error) {
      toast.error("Failed to cancel campaign");
    } finally {
      setCancelLoading(false);
    }
  };

  // Handle pause campaign
  const handlePauseCampaign = async (campaign) => {
    console.log('🔵 handlePauseCampaign called', { campaign, canUpdate });
    if (!canUpdate) {
      toast.error("You don't have permission to pause campaigns");
      return;
    }
    setOpenDropdown(null);
    try {
      console.log('🔵 Calling pauseCampaign API with id:', campaign.id);
      const response = await pauseCampaign(campaign.id);
      console.log('🔵 pauseCampaign response:', response);
      console.log('🔵 response.success:', response?.success, 'type:', typeof response?.success);
      console.log('🔵 response.error:', response?.error);
      console.log('🔵 Full response keys:', response ? Object.keys(response) : 'null');
      
      // Check for success - be more lenient with the check
      const isSuccess = response && (
        response.success === true || 
        response.success === 'true' ||
        (typeof response.success !== 'undefined' && response.success !== false && !response.error)
      );
      
      if (isSuccess) {
        toast.success(response.message || "Campaign paused successfully");
        fetchCampaigns(true); // Force refresh to get updated status
      } else if (response?.error) {
        toast.error(response.error);
      } else {
        // Last resort: if response exists and has data, assume success
        if (response && (response.data || response.id)) {
          console.log('🔵 Response has data/id, treating as success');
          toast.success("Campaign paused successfully");
          fetchCampaigns(true); // Force refresh to get updated status
        } else {
          console.error('🔵 Unexpected response structure:', response);
          toast.error(response?.message || "Failed to pause campaign");
        }
      }
    } catch (error) {
      console.error('❌ Error in handlePauseCampaign:', error);
      toast.error("Failed to pause campaign");
    }
  };

  // Handle resume campaign
  const handleResumeCampaign = async (campaign) => {
    console.log('🟢 handleResumeCampaign called', { campaign, canUpdate });
    if (!canUpdate) {
      toast.error("You don't have permission to resume campaigns");
      return;
    }
    setOpenDropdown(null);
    try {
      console.log('🟢 Calling resumeCampaign API with id:', campaign.id);
      const response = await resumeCampaign(campaign.id);
      console.log('🟢 resumeCampaign response:', response);
      console.log('🟢 response.success:', response?.success, 'type:', typeof response?.success);
      console.log('🟢 response.error:', response?.error);
      console.log('🟢 Full response keys:', response ? Object.keys(response) : 'null');
      
      // Check for success - be more lenient with the check
      // Response should have success: true from the API
      const isSuccess = response && (
        response.success === true || 
        response.success === 'true' ||
        (typeof response.success !== 'undefined' && response.success !== false && !response.error)
      );
      
      if (isSuccess) {
        toast.success(response.message || "Campaign resumed successfully");
        fetchCampaigns(true); // Force refresh to get updated status
      } else if (response?.error) {
        toast.error(response.error);
      } else {
        // Last resort: if response exists and has data, assume success
        if (response && (response.data || response.id)) {
          console.log('🟢 Response has data/id, treating as success');
          toast.success("Campaign resumed successfully");
          fetchCampaigns(true); // Force refresh to get updated status
        } else {
          console.error('🟢 Unexpected response structure:', response);
          toast.error(response?.message || "Failed to resume campaign");
        }
      }
    } catch (error) {
      console.error('❌ Error in handleResumeCampaign:', error);
      toast.error("Failed to resume campaign");
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status config
  const getStatusConfig = (status, isRunning) => {
    if (isRunning) {
      return { color: '#22c55e', bg: '#dcfce7', label: 'Running', pulse: true };
    }
    const map = {
      completed: { color: '#8b5cf6', bg: '#ede9fe', label: 'Completed' },
      in_progress: { color: '#22c55e', bg: '#dcfce7', label: 'In Progress' },
      paused: { color: '#f59e0b', bg: '#fef3c7', label: 'Paused' },
      scheduled: { color: '#3b82f6', bg: '#dbeafe', label: 'Scheduled' },
      running: { color: '#22c55e', bg: '#dcfce7', label: 'Running' },
      cancelled: { color: '#6b7280', bg: '#f3f4f6', label: 'Cancelled' },
      failed: { color: '#ef4444', bg: '#fee2e2', label: 'Failed' },
    };
    return map[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  };

  // Handle campaign created
  const handleCampaignCreated = () => {
    setShowCreateModal(false);
    fetchCampaigns(true); // Force refresh to get new campaign
  };

  // Open leads modal
  const openLeadsModal = async (campaign) => {
    if (!campaign.leads_count || campaign.leads_count === 0) {
      toast.error("This campaign has no leads");
      return;
    }

    setSelectedCampaignForLeads(campaign);
    setShowLeadsModal(true);
    setLeadsLoading(true);
    setCampaignLeads([]);

    try {
      const listId = campaign.genie_contact_lists?.id;
      if (!listId) {
        toast.error("Unable to fetch leads: campaign list not found");
        setLeadsLoading(false);
        return;
      }

      const response = await getAllLeads({ listId, limit: 100 });
      if (response?.error) {
        toast.error(response.error);
        setLeadsLoading(false);
        return;
      }

      setCampaignLeads(response?.data || []);
    } catch (error) {
      console.error("Error fetching campaign leads:", error);
      toast.error("Failed to fetch leads");
    } finally {
      setLeadsLoading(false);
    }
  };

  // Close leads modal
  const closeLeadsModal = () => {
    setShowLeadsModal(false);
    setSelectedCampaignForLeads(null);
    setCampaignLeads([]);
  };

  // Open campaign calls/contacts modal
  const openCallsModal = async (campaign, type) => {
    const campaignId = campaign?.id;
    const isSameCampaignAndType = 
      lastLoadedCampaignRef.current.campaignId === campaignId && 
      lastLoadedCampaignRef.current.modalType === type;
    
    // Set flag FIRST to prevent useEffect from triggering
    setIsModalJustOpened(true);
    
    // Reset filters and pagination BEFORE setting modal states
    setCallsCurrentPage(1);
    setCallsSearchQuery("");
    setCallsStartDate("");
    setCallsEndDate("");
    setCallsMinDuration("");
    
    // Now set modal states
    setSelectedCampaignForCalls(campaign);
    setModalType(type);
    setShowCallsModal(true);
    
    // Only fetch if it's a different campaign or type
    if (!isSameCampaignAndType) {
      setCallsLoading(true);
      setCampaignCalls([]);
      
      await fetchCampaignCalls(campaign, type, 1);
      
      // Update the last loaded reference
      lastLoadedCampaignRef.current = { campaignId, modalType: type };
      
      // Reset flag after initial load
      setTimeout(() => setIsModalJustOpened(false), 500);
    } else {
      // Same campaign and type - just show the modal with existing data (no API call)
      // Reset flag after a brief delay to prevent useEffect from triggering
      setTimeout(() => setIsModalJustOpened(false), 500);
    }
  };

  // Convert datetime-local to ISO format
  const convertToISO = (datetimeLocal) => {
    if (!datetimeLocal) return undefined;
    // datetime-local format: "2024-01-15T14:30:00"
    // Convert to ISO: "2024-01-15T14:30:00.000Z"
    const date = new Date(datetimeLocal);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString();
  };

  // Fetch campaign calls
  const fetchCampaignCalls = async (campaign, type, page = 1) => {
    setCallsLoading(true);
    try {
      const params = {
        page,
        limit: callsLimit,
        // Use scheduledListId (campaign.id) - this should match scheduled_list_id in call_logs
        // If calls are linked via list_id instead, we'll need to use listId
        scheduledListId: campaign.id,
        startDate: convertToISO(callsStartDate),
        endDate: convertToISO(callsEndDate),
        search: callsSearchQuery?.trim() || undefined,
        minDuration: callsMinDuration || undefined,
      };
      
      // If scheduledListId returns no results, try listId as fallback
      // For now, we'll try scheduledListId first (campaign.id)

      // Set status filter based on type
      if (type === 'completed') {
        params.status = 'completed';
      } else if (type === 'failed') {
        params.status = 'failed';
      }
      // For 'contacts', no status filter - show all calls

      console.log('📞 Fetching campaign calls:', {
        campaignId: campaign.id,
        contactListId: campaign.genie_contact_lists?.id,
        type,
        scheduledListId: params.scheduledListId,
        status: params.status
      });

      let response = await getAllCalls(params);
      
      console.log('📞 API Response (scheduledListId):', {
        total: response?.total,
        count: response?.count,
        dataLength: response?.data?.length,
        hasMore: response?.hasMore
      });
      
      // If no results with scheduledListId, try listId as fallback
      if ((!response?.total || response.total === 0) && campaign.genie_contact_lists?.id) {
        console.log('📞 No results with scheduledListId, trying listId...');
        const fallbackParams = {
          ...params,
          scheduledListId: undefined, // Remove scheduledListId
          listId: campaign.genie_contact_lists.id // Use listId instead
        };
        response = await getAllCalls(fallbackParams);
        console.log('📞 API Response (listId fallback):', {
          total: response?.total,
          count: response?.count,
          dataLength: response?.data?.length,
          hasMore: response?.hasMore
        });
      }
      if (response?.error) {
        toast.error(response.error);
        setCallsLoading(false);
        return;
      }

      setCampaignCalls(response?.data || []);
      setCallsTotalCount(response?.total || 0);
      setCallsTotalPages(response?.totalPages || 1);
      setCallsCurrentPage(page);
    } catch (error) {
      console.error("Error fetching campaign calls:", error);
      toast.error("Failed to fetch calls");
    } finally {
      setCallsLoading(false);
    }
  };

  // Handle calls filter change
  const handleCallsFilterChange = () => {
    if (selectedCampaignForCalls && modalType) {
      setCallsCurrentPage(1);
      fetchCampaignCalls(selectedCampaignForCalls, modalType, 1);
    }
  };

  // Debounced filter change for search
  useEffect(() => {
    if (!showCallsModal || !selectedCampaignForCalls || !modalType || isModalJustOpened) return;
    
    const debounceTimer = setTimeout(() => {
      // Only fetch if search query has a value (not empty string)
      // This prevents fetching when filters are reset to empty on same campaign/type
      if (callsSearchQuery && callsSearchQuery.trim()) {
        setCallsCurrentPage(1);
        fetchCampaignCalls(selectedCampaignForCalls, modalType, 1);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [callsSearchQuery, showCallsModal, selectedCampaignForCalls, modalType, isModalJustOpened]);

  // Auto-apply min duration filter when changed
  useEffect(() => {
    if (!showCallsModal || !selectedCampaignForCalls || !modalType || isModalJustOpened) return;
    
    // Only fetch if min duration has a value (not empty string)
    // This prevents fetching when filters are reset to empty on modal open
    if (!callsMinDuration || callsMinDuration.trim() === '') return;
    
    // Auto-apply when min duration changes (but not on initial mount)
    const timeoutId = setTimeout(() => {
      setCallsCurrentPage(1);
      fetchCampaignCalls(selectedCampaignForCalls, modalType, 1);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [callsMinDuration, showCallsModal, selectedCampaignForCalls, modalType, isModalJustOpened]);

  // Close calls modal
  const closeCallsModal = () => {
    setShowCallsModal(false);
    setSelectedCampaignForCalls(null);
    setModalType(null);
    // Don't clear the data - keep it cached for next time
    // setCampaignCalls([]);
    setCallsCurrentPage(1);
    setCallsSearchQuery("");
    setCallsStartDate("");
    setCallsEndDate("");
    setCallsMinDuration("");
    setPlayingCallId(null);
    setPlayingCall(null);
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Format date for leads
  const formatLeadDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get initials
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Truncate text
  const truncateText = (text, maxLength = 50) => {
    if (!text) return "-";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        gap: '16px'
      }}>
        <div>
          <h5 style={{ margin: '0 0 4px 0', fontWeight: '600', fontSize: '18px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} style={{ color: '#74317e' }} />
            Campaigns
          </h5>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Manage your automated call campaigns
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            {campaignSearchInput && (
              <X 
                size={16} 
                onClick={() => setCampaignSearchInput('')}
                style={{ 
                  position: 'absolute', 
                  right: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af',
                  cursor: 'pointer'
                }} 
              />
            )}
            <input
              type="text"
              placeholder="Search campaigns..."
              value={campaignSearchInput}
              onChange={(e) => setCampaignSearchInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                paddingRight: campaignSearchInput ? '36px' : '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <Users size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            {consumerSearchInput && (
              <X 
                size={16} 
                onClick={() => setConsumerSearchInput('')}
                style={{ 
                  position: 'absolute', 
                  right: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af',
                  cursor: 'pointer'
                }} 
              />
            )}
            <input
              type="text"
              placeholder="Search consumer name/email..."
              value={consumerSearchInput}
              onChange={(e) => setConsumerSearchInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                paddingRight: consumerSearchInput ? '36px' : '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '130px'
            }}
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="paused">Paused</option>
          </select>
          <select
            value={leadFilter}
            onChange={(e) => setLeadFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="">All Campaigns</option>
            <option value="true">With Leads</option>
            <option value="false">Without Leads</option>
          </select>
          {canCreate && (
            <button 
              onClick={() => setShowCreateModal(true)}
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={16} />
              New Campaign
            </button>
          )}
        </div>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #f1f5f9', borderTopColor: '#74317e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading campaigns...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#94a3b8'
          }}>
            <Calendar size={32} />
            </div>
          <h5 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: '600' }}>No campaigns found</h5>
          <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Schedule your first campaign to start automating calls</p>
            {canCreate && (
            <button 
                onClick={() => setShowCreateModal(true)}
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
                }}
              >
                Create Your First Campaign
            </button>
            )}
          </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredCampaigns.map((campaign) => {
            const isRunning = campaign.runtime_call_status || campaign.status === 'running' || campaign.status === 'in_progress';
            const progress = campaign.progress_percent || 0;
            const statusConfig = getStatusConfig(campaign.status, isRunning);
            
            return (
              <div
                key={campaign.id}
                style={{
                  backgroundColor: 'white',
                  border: isRunning ? '2px solid #22c55e' : '1px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                {/* Card Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                    <h6 style={{ margin: '0 0 4px 0', fontWeight: '600', fontSize: '15px', color: '#1e293b' }}>
                        {campaign.genie_contact_lists?.name || "Unknown Campaign"}
                      </h6>
                    <small style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                        {campaign.genie_bots?.name || "Unknown Agent"}
                      </small>
                    {campaign.consumer_name && (
                      <small style={{ color: '#74317e', fontSize: '12px', fontWeight: '500', display: 'block' }}>
                        Owner: {campaign.consumer_name}
                      </small>
                    )}
                    </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                          background: statusConfig.bg,
                          color: statusConfig.color,
                          padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                      gap: '6px'
                    }}>
                        {statusConfig.pulse && (
                        <span style={{ 
                          width: '8px', 
                          height: '8px', 
                              borderRadius: '50%', 
                              background: statusConfig.color,
                              animation: 'pulse 1.5s infinite'
                        }} />
                        )}
                        {statusConfig.label}
                      </span>
                      {campaign.status !== 'completed' && campaign.status !== 'cancelled' && (canDelete || canUpdate) && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdown(openDropdown === campaign.id ? null : campaign.id);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openDropdown === campaign.id && (
                          <div 
                            ref={(el) => {
                              if (el) {
                                dropdownRefs.current[campaign.id] = el;
                              } else {
                                delete dropdownRefs.current[campaign.id];
                              }
                            }}
                            data-dropdown-id={campaign.id}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '160px'
                          }}>
                            {campaign.status === 'paused' && canUpdate && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  console.log('🟢 Resume button clicked', { campaign, e });
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleResumeCampaign(campaign);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: '#22c55e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Play size={16} /> Resume
                              </button>
                            )}
                            {(campaign.status === 'in_progress' || campaign.status === 'running' || isRunning) && canUpdate && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  console.log('🟡 Pause button clicked', { campaign, e });
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handlePauseCampaign(campaign);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: '#f59e0b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Pause size={16} /> Pause
                              </button>
                            )}
                            {canDelete && (
                              <>
                                {(campaign.status === 'paused' || campaign.status === 'in_progress' || campaign.status === 'running' || isRunning) && (
                                  <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' }} />
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    console.log('🔴 Cancel button clicked', { campaign, e });
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openCancelModal(campaign);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#dc3545',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <X size={16} /> Cancel
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px' }}>
                  {/* Progress */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <small style={{ color: '#64748b', fontSize: '13px' }}>Progress</small>
                      <small style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{progress}%</small>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        borderRadius: '4px',
                        background: isRunning ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        width: `${progress}%`,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div 
                      style={{ 
                        textAlign: 'center', 
                        flex: 1,
                        cursor: (campaign.contacts_count || 0) > 0 ? 'pointer' : 'default',
                        opacity: (campaign.contacts_count || 0) > 0 ? 1 : 0.6,
                        transition: 'all 0.2s ease',
                        padding: '8px',
                        borderRadius: '8px'
                      }}
                      onClick={() => {
                        if ((campaign.contacts_count || 0) > 0) {
                          openCallsModal(campaign, 'contacts');
                        }
                      }}
                      onMouseEnter={(e) => {
                        if ((campaign.contacts_count || 0) > 0) {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if ((campaign.contacts_count || 0) > 0) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{campaign.contacts_count || 0}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Contacts</div>
                    </div>
                    <div 
                      style={{ 
                        textAlign: 'center', 
                        flex: 1,
                        cursor: (campaign.calls_completed || 0) > 0 ? 'pointer' : 'default',
                        opacity: (campaign.calls_completed || 0) > 0 ? 1 : 0.6,
                        transition: 'all 0.2s ease',
                        padding: '8px',
                        borderRadius: '8px'
                      }}
                      onClick={() => {
                        if ((campaign.calls_completed || 0) > 0) {
                          openCallsModal(campaign, 'completed');
                        }
                      }}
                      onMouseEnter={(e) => {
                        if ((campaign.calls_completed || 0) > 0) {
                          e.currentTarget.style.backgroundColor = '#f0fdf4';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if ((campaign.calls_completed || 0) > 0) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e' }}>{campaign.calls_completed || 0}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Completed</div>
                    </div>
                    <div 
                      style={{ 
                        textAlign: 'center', 
                        flex: 1,
                        cursor: (campaign.calls_failed || 0) > 0 ? 'pointer' : 'default',
                        opacity: (campaign.calls_failed || 0) > 0 ? 1 : 0.6,
                        transition: 'all 0.2s ease',
                        padding: '8px',
                        borderRadius: '8px'
                      }}
                      onClick={() => {
                        if ((campaign.calls_failed || 0) > 0) {
                          openCallsModal(campaign, 'failed');
                        }
                      }}
                      onMouseEnter={(e) => {
                        if ((campaign.calls_failed || 0) > 0) {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if ((campaign.calls_failed || 0) > 0) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>{campaign.calls_failed || 0}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Failed</div>
                    </div>
                    <div 
                      style={{ 
                        textAlign: 'center', 
                        flex: 1,
                        cursor: campaign.leads_count > 0 ? 'pointer' : 'default',
                        opacity: campaign.leads_count > 0 ? 1 : 0.6,
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        if (campaign.leads_count > 0) {
                          openLeadsModal(campaign);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (campaign.leads_count > 0) {
                          e.currentTarget.style.opacity = '0.8';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (campaign.leads_count > 0) {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '700', 
                        color: campaign.leads_count > 0 ? '#8b5cf6' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}>
                        {campaign.leads_count > 0 && <Target size={16} />}
                        {campaign.leads_count || 0}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Leads</div>
                      </div>
                    </div>

                    {/* Schedule Info */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <small style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <Clock size={14} />
                        {formatDate(campaign.scheduled_at)}
                      </small>
                      {campaign.tz && (
                      <small style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '13px' }}>
                        <Globe size={14} />
                          {campaign.tz}
                        </small>
                      )}
                    </div>
                  </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          show={showCreateModal}
          onHide={() => setShowCreateModal(false)}
          onSuccess={handleCampaignCreated}
          bots={bots}
          contactLists={contactLists}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onClose={closeCancelModal}
        onConfirm={confirmCancelCampaign}
        title="Cancel Campaign"
        message="Are you sure you want to cancel this campaign?"
        warningText="This action cannot be undone and any scheduled calls will be stopped."
        itemName={selectedCampaign?.genie_bots?.name || "Campaign"}
        itemId={selectedCampaign?.id}
        consequences={[
          "Stop all scheduled calls",
          "Mark campaign as cancelled",
          "Cannot be restarted"
        ]}
        confirmText="Yes, Cancel Campaign"
        cancelText="No, Keep It"
        variant="danger"
        isLoading={cancelLoading}
        loadingText="Cancelling..."
      />

      {/* Campaign Leads Modal */}
      {showLeadsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeLeadsModal();
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '1200px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
                  Campaign Leads
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                  {selectedCampaignForLeads?.genie_contact_lists?.name || 'Campaign'} - {campaignLeads.length} lead{campaignLeads.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={closeLeadsModal}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {leadsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                  <div style={{ width: '48px', height: '48px', border: '3px solid #f1f5f9', borderTopColor: '#74317e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading leads...</p>
                </div>
              ) : campaignLeads.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#94a3b8' }}>
                    <Target size={32} />
                  </div>
                  <h5 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: '600' }}>No leads found</h5>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>This campaign has no leads yet</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Contact</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Owner</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Bot</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Summary</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: '120px' }}>Recording</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: '100px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          onClick={() => history.push(`/admin/genie/leads/${lead.id}`)}
                        >
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '600',
                                fontSize: '14px'
                              }}>
                                {getInitials(lead.name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{lead.name || "Unknown"}</div>
                                <div style={{ color: '#64748b', fontSize: '13px' }}>{lead.phone || "-"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                            {lead.owner_name || lead.email || "-"}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                            {lead.genie_bots?.name || "-"}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                            {truncateText(lead.summary, 40)}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                            {formatLeadDate(lead.created_at)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {lead.recording_url ? (
                              <a
                                href={lead.recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  backgroundColor: '#f1f5f9',
                                  borderRadius: '6px',
                                  color: '#74317e',
                                  textDecoration: 'none',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                                }}
                              >
                                <PlayCircle size={14} /> Play
                              </a>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '13px' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                history.push(`/admin/genie/leads/${lead.id}`);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#74317e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#5a2570';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#74317e';
                              }}
                            >
                              <Eye size={14} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign Calls/Contacts Modal */}
      {showCallsModal && selectedCampaignForCalls && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeCallsModal();
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '1400px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              margin: 'auto',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
                  {modalType === 'contacts' ? 'Campaign Contacts' : modalType === 'completed' ? 'Completed Calls' : 'Failed Calls'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                  {selectedCampaignForCalls?.genie_contact_lists?.name || 'Campaign'} - {callsTotalCount} {modalType === 'contacts' ? 'contact' : 'call'}{callsTotalCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={closeCallsModal}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filters */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f8fafc'
            }}>
              <div 
                className="filter-grid"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  alignItems: 'flex-end'
                }}
              >
                <div style={{ gridColumn: 'span 2', minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Search</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', zIndex: 1 }} />
                    {callsSearchQuery && (
                      <X 
                        size={14} 
                        onClick={() => setCallsSearchQuery("")}
                        style={{ 
                          position: 'absolute', 
                          right: '12px', 
                          top: '50%', 
                          transform: 'translateY(-50%)', 
                          color: '#9ca3af',
                          cursor: 'pointer',
                          zIndex: 1
                        }} 
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Search by name or phone..."
                      value={callsSearchQuery}
                      onChange={(e) => setCallsSearchQuery(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleCallsFilterChange();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        paddingRight: callsSearchQuery ? '36px' : '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        backgroundColor: 'white'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#74317e'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                </div>
                <div style={{ minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>From Date & Time</label>
                  <input
                    type="datetime-local"
                    value={callsStartDate}
                    onChange={(e) => setCallsStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      backgroundColor: 'white'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#74317e'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div style={{ minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>To Date & Time</label>
                  <input
                    type="datetime-local"
                    value={callsEndDate}
                    onChange={(e) => setCallsEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      backgroundColor: 'white'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#74317e'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div style={{ minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Min Duration</label>
                  <select
                    value={callsMinDuration}
                    onChange={(e) => setCallsMinDuration(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#74317e'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <option value="">All Durations</option>
                    <option value="30">30+ seconds</option>
                    <option value="60">1+ minute</option>
                    <option value="300">5+ minutes</option>
                    <option value="600">10+ minutes</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <div style={{ display: 'flex', gap: '8px', minWidth: 'fit-content' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setCallsSearchQuery("");
                        setCallsStartDate("");
                        setCallsEndDate("");
                        setCallsMinDuration("");
                        // Trigger filter refresh after clearing
                        setTimeout(() => {
                          if (selectedCampaignForCalls && modalType) {
                            setCallsCurrentPage(1);
                            fetchCampaignCalls(selectedCampaignForCalls, modalType, 1);
                          }
                        }, 100);
                      }}
                      style={{
                        padding: '10px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                        color: '#64748b',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <X size={14} /> Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleCallsFilterChange}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: '#74317e',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(116, 49, 126, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a2570';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(116, 49, 126, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#74317e';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(116, 49, 126, 0.2)';
                      }}
                    >
                      <Search size={14} /> 
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {callsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                  <div style={{ width: '48px', height: '48px', border: '3px solid #f1f5f9', borderTopColor: '#74317e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading calls...</p>
                </div>
              ) : campaignCalls.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#94a3b8' }}>
                    <Clock size={32} />
                  </div>
                  <h5 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: '600' }}>No calls found</h5>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>No {modalType === 'contacts' ? 'contacts' : modalType === 'completed' ? 'completed calls' : 'failed calls'} found for this campaign</p>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: 'calc(90vh - 300px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                      <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', backgroundColor: '#f8fafc' }}>Contact</th>
                          <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', backgroundColor: '#f8fafc' }}>Status</th>
                          <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', backgroundColor: '#f8fafc' }}>Duration</th>
                          <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', backgroundColor: '#f8fafc' }}>Date</th>
                          <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: '320px', whiteSpace: 'nowrap', backgroundColor: '#f8fafc' }}>Recording</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignCalls.map((call) => (
                          <tr
                            key={call.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '10px',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '14px'
                                }}>
                                  {getInitials(call.name)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{call.name || "Unknown"}</div>
                                  <div style={{ color: '#64748b', fontSize: '13px' }}>{call.phone || "-"}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: call.call_status === 'completed' ? '#dcfce7' : call.call_status === 'failed' ? '#fee2e2' : '#f3f4f6',
                                color: call.call_status === 'completed' ? '#22c55e' : call.call_status === 'failed' ? '#ef4444' : '#64748b'
                              }}>
                                {call.call_status || 'unknown'}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                              {formatDuration(call.duration)}
                            </td>
                            <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                              {formatLeadDate(call.created_at)}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'top' }} colSpan={playingCallId === call.id ? 1 : 1}>
                              {call.call_url ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px', width: '100%' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (playingCallId === call.id) {
                                        setPlayingCallId(null);
                                        setPlayingCall(null);
                                      } else {
                                        setPlayingCallId(call.id);
                                        setPlayingCall(call);
                                      }
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      padding: '6px 14px',
                                      backgroundColor: playingCallId === call.id ? '#74317e' : '#f1f5f9',
                                      borderRadius: '6px',
                                      color: playingCallId === call.id ? 'white' : '#74317e',
                                      border: 'none',
                                      textDecoration: 'none',
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      whiteSpace: 'nowrap',
                                      minWidth: '80px',
                                      alignSelf: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (playingCallId !== call.id) {
                                        e.currentTarget.style.backgroundColor = '#e2e8f0';
                                      } else {
                                        e.currentTarget.style.backgroundColor = '#5a2570';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (playingCallId !== call.id) {
                                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                                      } else {
                                        e.currentTarget.style.backgroundColor = '#74317e';
                                      }
                                    }}
                                  >
                                    <PlayCircle size={14} /> {playingCallId === call.id ? 'Stop' : 'Play'}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {callsTotalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '24px',
                      paddingTop: '24px',
                      borderTop: '1px solid #e9ecef',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ fontSize: '14px', color: '#6c757d' }}>
                        Showing {((callsCurrentPage - 1) * callsLimit) + 1} to {Math.min(callsCurrentPage * callsLimit, callsTotalCount)} of {callsTotalCount} calls
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            if (selectedCampaignForCalls && modalType) {
                              fetchCampaignCalls(selectedCampaignForCalls, modalType, 1);
                            }
                          }}
                          disabled={callsCurrentPage === 1}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: callsCurrentPage === 1 ? '#f3f4f6' : 'white',
                            color: callsCurrentPage === 1 ? '#9ca3af' : '#374151',
                            cursor: callsCurrentPage === 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px'
                          }}
                        >
                          <ChevronLeft size={18} /> Previous
                        </button>
                        <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                          Page {callsCurrentPage} of {callsTotalPages}
                        </span>
                        <button
                          onClick={() => {
                            if (selectedCampaignForCalls && modalType) {
                              fetchCampaignCalls(selectedCampaignForCalls, modalType, callsCurrentPage + 1);
                            }
                          }}
                          disabled={callsCurrentPage >= callsTotalPages}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: callsCurrentPage >= callsTotalPages ? '#f3f4f6' : 'white',
                            color: callsCurrentPage >= callsTotalPages ? '#9ca3af' : '#374151',
                            cursor: callsCurrentPage >= callsTotalPages ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px'
                          }}
                        >
                          Next <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audio Player Modal */}
      {playingCall && playingCall.call_url && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPlayingCallId(null);
              setPlayingCall(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>
                  Call Recording
                </h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                  {playingCall.name || 'Unknown'} - {playingCall.phone || '-'}
                </p>
              </div>
              <button
                onClick={() => {
                  setPlayingCallId(null);
                  setPlayingCall(null);
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Audio Player */}
            <div style={{
              width: '100%',
              padding: '24px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '2px solid #74317e',
              boxShadow: '0 4px 12px rgba(116, 49, 126, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px'
            }}>
              <audio
                controls
                autoPlay
                style={{
                  width: '100%',
                  height: '72px',
                  minHeight: '72px',
                  maxHeight: '72px',
                  outline: 'none',
                  display: 'block',
                  margin: '0 auto'
                }}
                onEnded={() => {
                  setPlayingCallId(null);
                  setPlayingCall(null);
                }}
                controlsList="nodownload noplaybackrate"
              >
                <source src={playingCall.call_url} type="audio/mpeg" />
                <source src={playingCall.call_url} type="audio/wav" />
                <source src={playingCall.call_url} type="audio/mp3" />
                <source src={playingCall.call_url} type="audio/ogg" />
                Your browser does not support the audio element.
              </audio>
            </div>

            {/* Call Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Status</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: playingCall.call_status === 'completed' ? '#dcfce7' : playingCall.call_status === 'failed' ? '#fee2e2' : '#f3f4f6',
                    color: playingCall.call_status === 'completed' ? '#22c55e' : playingCall.call_status === 'failed' ? '#ef4444' : '#64748b'
                  }}>
                    {playingCall.call_status || 'unknown'}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Duration</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                  {formatDuration(playingCall.duration)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Date</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                  {formatLeadDate(playingCall.created_at)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Bot</div>
                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                  {playingCall.genie_bots?.name || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .filter-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1024px) {
          .filter-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
          }
        }
        audio {
          width: 100%;
          height: 72px !important;
          min-height: 72px !important;
          max-height: 72px !important;
        }
        audio::-webkit-media-controls-panel {
          background-color: #f8fafc;
          border-radius: 12px;
          padding: 16px 20px;
          height: 72px !important;
          min-height: 72px !important;
          max-height: 72px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        audio::-webkit-media-controls-play-button {
          background-color: #74317e;
          border-radius: 50% !important;
          width: 48px !important;
          height: 48px !important;
          min-width: 48px !important;
          min-height: 48px !important;
          max-width: 48px !important;
          max-height: 48px !important;
          margin-right: 16px;
          margin-left: 0;
          flex-shrink: 0;
          border: none !important;
          padding: 0 !important;
        }
        audio::-webkit-media-controls-current-time-display,
        audio::-webkit-media-controls-time-remaining-display {
          color: #1e293b;
          font-size: 16px;
          font-weight: 600;
          margin: 0 10px;
          flex-shrink: 0;
        }
        audio::-webkit-media-controls-timeline {
          background-color: #e2e8f0;
          border-radius: 6px;
          height: 8px !important;
          margin: 0 12px;
          flex: 1;
          min-width: 0;
        }
        audio::-webkit-media-controls-mute-button {
          background-color: transparent;
          width: 36px !important;
          height: 36px !important;
          margin-left: 12px;
          margin-right: 8px;
          flex-shrink: 0;
          order: 1;
        }
        audio::-webkit-media-controls-volume-slider {
          background-color: #e2e8f0;
          border-radius: 6px;
          height: 8px;
          margin-left: 0;
          margin-right: 12px;
          width: 80px;
          flex-shrink: 0;
          order: 2;
        }
        audio::-webkit-media-controls-timeline-container {
          height: 8px;
          flex: 1;
          display: flex;
          align-items: center;
          min-width: 0;
        }
        audio::-webkit-media-controls-volume-slider-container {
          margin-left: 0;
          margin-right: 0;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          order: 3;
        }
        audio::-webkit-media-controls-enclosure {
          width: 100%;
          height: 72px !important;
          min-height: 72px !important;
          max-height: 72px !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        audio::-webkit-media-controls {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 72px !important;
        }
      `}</style>
    </div>
  );
}

export default CampaignsTab;
