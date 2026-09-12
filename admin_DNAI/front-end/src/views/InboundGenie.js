import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { Phone, RefreshCw, Search, Eye, Trash2, X, Edit2, BarChart3, Calendar, Plus, Clock, Users, Play, Pause, Download, Filter, CheckCircle, XCircle, AlertCircle, TrendingUp, DollarSign } from "lucide-react";
import { inboundApi } from "../api/backend/inbound";
import InboundSettings from "./InboundSettings";
import PricingSettings from "./PricingSettings";
import apiClient from "../services/apiClient";
import { getConsumers } from "../api/backend/consumers";
import { usePermissions } from "hooks/usePermissions";
import toast from "react-hot-toast";

const Pagination = ({ current, total, limit, onPageChange, disabled }) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20px', gap: '8px' }}>
      <button
        onClick={() => onPageChange(Math.max(1, current - 1))}
        disabled={current === 1 || disabled}
        style={{
          padding: '8px 12px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: (current === 1 || disabled) ? 'not-allowed' : 'pointer',
          color: (current === 1 || disabled) ? '#ccc' : '#333',
          opacity: disabled ? 0.6 : 1
        }}
      >
        Prev
      </button>
      {getPageNumbers().map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          disabled={disabled}
          style={{
            padding: '8px 12px',
            background: page === current ? '#74317e' : 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: page === current ? 'white' : '#333',
            fontWeight: page === current ? '600' : '400',
            opacity: disabled ? 0.6 : 1
          }}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(totalPages, current + 1))}
        disabled={current === totalPages || disabled}
        style={{
          padding: '8px 12px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: (current === totalPages || disabled) ? 'not-allowed' : 'pointer',
          color: (current === totalPages || disabled) ? '#ccc' : '#333',
          opacity: disabled ? 0.6 : 1
        }}
      >
        Next
      </button>
    </div>
  );
};

const UserCell = ({ item, users }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const profile = item.user_profile || {};
  let displayEmail = item.user_email || profile.email;
  let displayName = item.user_full_name || profile.full_name;
  let role = item.user_role || profile.role;

  // Fallback: lookup user details by ID from the preloaded users list if they are not already enriched
  if (!displayEmail && item.user_id && users && users.length > 0) {
    const matchedUser = users.find(u => (u.user_id === item.user_id || u.id === item.user_id));
    if (matchedUser) {
      displayEmail = matchedUser.email;
      displayName = matchedUser.full_name || matchedUser.name || displayName;
      role = matchedUser.role || role;
    }
  }

  displayName = displayName || 'Anonymous User';
  role = role || 'User';

  const details = [
    { label: 'Role', value: role, icon: '🛡️' },
    { label: 'Status', value: profile.account_status || 'Active', icon: '🟢' },
    { label: 'Phone', value: profile.phone, icon: '📞' },
    { label: 'Created', value: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : null, icon: '📅' },
  ].filter(d => d.value);

  if (!item.user_id && !displayEmail) {
    return <span style={{ color: '#9ca3af' }}>-</span>;
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-block',
        maxWidth: '200px',
      }}
    >
      <span
        style={{
          color: displayEmail ? '#74317e' : '#6b7280',
          fontWeight: displayEmail ? '600' : '400',
          cursor: 'pointer',
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: displayEmail ? 'underline' : 'none',
          textDecorationColor: '#e8d5ec',
          textUnderlineOffset: '3px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (displayEmail) e.target.style.color = '#5a2262';
        }}
        onMouseLeave={(e) => {
          if (displayEmail) e.target.style.color = '#74317e';
        }}
      >
        {displayEmail || `ID: ${item.user_id.substring(0, 8)}...`}
      </span>

      {/* Premium Tooltip/Popover */}
      <div
        style={{
          visibility: isHovered ? 'visible' : 'hidden',
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'absolute',
          top: '26px',
          left: '-20px',
          zIndex: 9999, // Ensure it floats on top of everything
          minWidth: '280px',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(116, 49, 126, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px -5px rgba(116, 49, 126, 0.15), 0 8px 20px -6px rgba(0, 0, 0, 0.1)',
          padding: '16px',
          color: '#1f2937',
          lineHeight: 1.5,
          pointerEvents: 'none', // Prevents jitter when mouse accidentally enters popover
        }}
      >
        {/* Card Header with Profile Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #74317e 0%, #a252ad 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(116, 49, 126, 0.3)'
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              {role.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Detailed Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
            <span style={{ fontSize: '14px' }}>📧</span>
            <span style={{ fontWeight: '500', wordBreak: 'break-all' }}>{displayEmail || '-'}</span>
          </div>
          {details.map((detail, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
              <span style={{ fontSize: '14px' }}>{detail.icon}</span>
              <span><strong>{detail.label}:</strong> {detail.value}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '8px', marginTop: '4px', fontSize: '10px', color: '#9ca3af', wordBreak: 'break-all' }}>
            ID: {item.user_id || '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

function InboundGenie() {
  const history = useHistory();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('numbers'); // 'numbers', 'calls', 'schedules', 'agents', 'settings', 'pricing'
  const [inboundNumbers, setInboundNumbers] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [inboundAgents, setInboundAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination state for each tab
  const [pagination, setPagination] = useState({
    numbers: { page: 1, limit: 10, total: 0 },
    calls: { page: 1, limit: 10, total: 0 },
    schedules: { page: 1, limit: 10, total: 0 },
    agents: { page: 1, limit: 10, total: 0 },
    settings: { page: 1, limit: 10, total: 0 },
    pricing: { page: 1, limit: 10, total: 0 }
  });

  // Statistics state
  const [statistics, setStatistics] = useState({
    totalNumbers: 0,
    activeNumbers: 0,
    totalCalls: 0,
    answeredCalls: 0,
    totalAgents: 0,
    activeAgents: 0,
    totalSchedules: 0,
    activeSchedules: 0
  });

  // Fetch statistics summary
  const fetchStatistics = async () => {
    try {
      const response = await inboundApi.getStatistics();
      if (response && response.success && response.data) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  // Parse URL search parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const page = parseInt(params.get('page')) || 1;
    const search = params.get('q') || '';

    if (tab && ['numbers', 'calls', 'schedules', 'agents', 'settings', 'pricing'].includes(tab)) {
      setActiveTab(tab);
      setPagination(prev => ({
        ...prev,
        [tab]: { ...prev[tab], page: page }
      }));
    }
    
    if (search) {
      setSearchQuery(search);
      setDebouncedSearch(search);
    }
  }, []);

  // Update URL search parameters when tab, page, or search changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('page', pagination[activeTab].page);
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }, [activeTab, pagination[activeTab].page, debouncedSearch]);

  // Handle global search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      // Reset page to 1 when searching
      setPagination(prev => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], page: 1 }
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Advanced filters
  const [filters, setFilters] = useState({
    status: 'all',
    provider: 'all',
    agentId: 'all',
    callerNumber: '',
    agentSearch: ''
  });

  const [agentSearchResults, setAgentSearchResults] = useState([]);
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [loadingAgentSearch, setLoadingAgentSearch] = useState(false);

  // Track which tabs have been loaded to avoid refetching on tab switch
  const [loadedTabs, setLoadedTabs] = useState({
    numbers: false,
    calls: false,
    schedules: false,
    agents: false,
    settings: false,
    pricing: false
  });

  // Modal states
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showAgentEditModal, setShowAgentEditModal] = useState(false);
  const [showAgentCreateModal, setShowAgentCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);


  // Number calls and analytics
  const [numberCalls, setNumberCalls] = useState([]);
  const [numberAnalytics, setNumberAnalytics] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [numberModalTab, setNumberModalTab] = useState('details');

  // Available agents for assignment
  const [availableAgents, setAvailableAgents] = useState([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  // Users for agent assignment
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserDisplay, setSelectedUserDisplay] = useState('');

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  // Edit/Create form state for numbers
  const [formData, setFormData] = useState({
    phone_number: '',
    country_code: '+1',
    phone_label: '',
    call_forwarding_number: '',
    provider: 'twilio',
    status: 'active',
    assigned_to_agent_id: '',
    sms_enabled: false,
    twilio_sid: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    vonage_api_key: '',
    vonage_api_secret: '',
    vonage_application_id: '',
    telnyx_api_key: '',
    provider_api_key: '',
    callhippo_api_key: '',
    termination_uri: ''
  });


  // Edit/Create form state for agents
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    user_id: '',
    company_name: '',
    website_url: '',
    goal: '',
    background: '',
    welcome_message: '',
    instruction_voice: '',
    script: '',
    voice: 'aura-helena-en',
    tone: 'professional',
    model: 'gpt-4o',
    background_noise: 'office',
    language: 'en-US',
    agent_type: '',
    tool: '',
    timezone: '',
    phone_provider: '',
    phone_number: '',
    phone_label: '',
    twilio_sid: '',
    twilio_auth_token: '',
    sms_enabled: false,
    vonage_api_key: '',
    vonage_api_secret: '',
    telnyx_api_key: '',
    status: 'active',
    vapi_id: '',
    vapi_account_assigned: '',
    account_in_use: false,
    voice_provider: 'deepgram',
    execution_mode: 'production',
    temperature: '',
    confidence: 0.8,
    verbosity: 0.7,
    fallback_number: '',
    fallback_enabled: false,
    knowledge_base_id: '',
    metadata: {}
  });

  // Check permissions
  const canView = hasPermission('genie.view') || hasPermission('genie.inbound.view');
  const canDelete = hasPermission('genie.inbound.delete');
  const canEdit = hasPermission('genie.inbound.edit') || hasPermission('genie.inbound.update');
  const canCreate = hasPermission('genie.inbound.create');

  // Fetch inbound numbers
  const fetchInboundNumbers = async (force = false) => {
    try {
      setLoading(true);
      const { page, limit } = pagination.numbers;
      const response = await inboundApi.getAllInboundNumbers({ 
        page, 
        limit, 
        search: debouncedSearch,
        status: filters.status !== 'all' ? filters.status : undefined,
        provider: filters.provider !== 'all' ? filters.provider : undefined
      });

      if (response.success && response.data) {
        const numbers = Array.isArray(response.data) ? response.data : response.data;
        setInboundNumbers(numbers);
        setPagination(prev => ({
          ...prev,
          numbers: { ...prev.numbers, total: response.total || response.count || 0 }
        }));
        setLoadedTabs(prev => ({ ...prev, numbers: true }));
      } else {
        setInboundNumbers([]);
        setLoadedTabs(prev => ({ ...prev, numbers: true }));
      }
    } catch (error) {
      console.error('Error fetching inbound numbers:', error);
      toast.error(error.message || 'Failed to load inbound numbers');
      setInboundNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch call history
  const fetchCallHistory = async (force = false) => {
    try {
      setLoading(true);
      const response = await inboundApi.getAllCallHistory({
        page: pagination.calls.page,
        limit: pagination.calls.limit,
        search: debouncedSearch,
        status: filters.status !== 'all' ? filters.status : undefined,
        agentId: filters.agentId !== 'all' ? filters.agentId : undefined,
        callerNumber: filters.callerNumber || undefined
      });

      if (response.success && response.data) {
        const calls = Array.isArray(response.data) ? response.data : response.data;
        setCallHistory(calls);
        setPagination(prev => ({
          ...prev,
          calls: { ...prev.calls, total: response.total || response.count || 0 }
        }));
        setLoadedTabs(prev => ({ ...prev, calls: true }));
      } else {
        setCallHistory([]);
        setLoadedTabs(prev => ({ ...prev, calls: true }));
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
      toast.error(error.message || 'Failed to load call history');
      setCallHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch schedules
  const fetchSchedules = async (force = false) => {
    try {
      setLoading(true);
      const { page, limit } = pagination.schedules;
      const response = await inboundApi.getSchedules({ 
        page, 
        limit,
        search: debouncedSearch
      });

      if (response.success && response.data) {
        const schedulesData = Array.isArray(response.data) ? response.data : response.data;
        setSchedules(schedulesData);
        setPagination(prev => ({
          ...prev,
          schedules: { ...prev.schedules, total: response.total || response.count || 0 }
        }));
        setLoadedTabs(prev => ({ ...prev, schedules: true }));
      } else {
        setSchedules([]);
        setLoadedTabs(prev => ({ ...prev, schedules: true }));
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error(error.message || 'Failed to load schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };


  // Fetch available agents
  const fetchAvailableAgents = async (force = false) => {
    // Don't fetch if already loaded and not forcing a refresh
    if (!force && agentsLoaded) {
      return;
    }

    try {
      const response = await inboundApi.getAvailableAgents();
      if (response.success && response.data) {
        setAvailableAgents(response.data);
        setAgentsLoaded(true);
      } else {
        setAvailableAgents([]);
        setAgentsLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAvailableAgents([]);
      setAgentsLoaded(true);
    }
  };

  // Fetch number calls
  const fetchNumberCalls = async (numberId) => {
    try {
      setLoadingCalls(true);
      const response = await inboundApi.getCallsByNumberId(numberId, { page: 1, limit: 50 });

      console.log('Number calls API response:', response);

      // API returns paginated response: { success: true, data: [...], total, page, limit, ... }
      // axios interceptor already unwraps response.data, so response is the actual API response
      if (response) {
        // Check if response has data property (paginated response)
        const calls = response.data && Array.isArray(response.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];

        console.log('Extracted calls:', calls, 'Total:', response.total || calls.length);
        setNumberCalls(calls);
      } else {
        console.log('No response received');
        setNumberCalls([]);
      }
    } catch (error) {
      console.error('Error fetching number calls:', error);
      toast.error(error.message || 'Failed to load calls');
      setNumberCalls([]);
    } finally {
      setLoadingCalls(false);
    }
  };

  // Fetch number analytics
  const fetchNumberAnalytics = async (numberId) => {
    try {
      setLoadingAnalytics(true);
      const response = await inboundApi.getAnalyticsByNumberId(numberId, { page: 1, limit: 30 });

      console.log('Number analytics API response:', response);

      // API returns paginated response: { success: true, data: [...], total, page, limit, ... }
      // axios interceptor already unwraps response.data, so response is the actual API response
      if (response) {
        // Check if response has data property (paginated response)
        const analyticsData = response.data && Array.isArray(response.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];

        console.log('Extracted analytics:', analyticsData, 'Total:', response.total || analyticsData.length);
        setNumberAnalytics(analyticsData);
      } else {
        console.log('No response received for analytics');
        setNumberAnalytics([]);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error(error.message || 'Failed to load analytics');
      setNumberAnalytics([]);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Fetch users for agent assignment
  const fetchUsers = async (force = false) => {
    if (!force && usersLoaded && users.length > 0) {
      return;
    }

    try {
      const response = await apiClient.users.getAll('?page=1&limit=1000');
      console.log('Users API response:', response);

      // Handle paginated response - axios interceptor unwraps response.data
      if (response) {
        const usersList = response.data && Array.isArray(response.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : response.data?.data || [];

        console.log('Fetched users:', usersList.length, 'Sample:', usersList[0]);
        setUsers(usersList);
        setUsersLoaded(true);
      } else {
        setUsers([]);
        setUsersLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setUsersLoaded(true);
    }
  };

  // Debounce user search - only trigger when 2+ characters
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (userSearchTerm.trim().length >= 2) {
        setDebouncedUserSearch(userSearchTerm.trim());
      } else {
        setDebouncedUserSearch('');
        setFilteredUsers([]);
        setShowUserSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [userSearchTerm]);

  // Fetch consumers from API when search term is 2+ characters
  useEffect(() => {
    const searchConsumers = async () => {
      if (!debouncedUserSearch || debouncedUserSearch.length < 2) {
        setFilteredUsers([]);
        setShowUserSuggestions(false);
        return;
      }

      setLoadingUsers(true);
      try {
        const result = await getConsumers({ search: debouncedUserSearch });
        console.log('Consumer search response:', result);

        // Handle different response structures
        let consumersList = [];
        if (result && !result.error) {
          if (Array.isArray(result)) {
            consumersList = result;
          } else if (result.data && Array.isArray(result.data)) {
            consumersList = result.data;
          } else if (result.success && Array.isArray(result.data)) {
            consumersList = result.data;
          }
        }

        // Map consumers to user format for display
        const mappedUsers = consumersList.map(consumer => ({
          user_id: consumer.user_id || consumer.id,
          id: consumer.user_id || consumer.id,
          full_name: consumer.full_name || consumer.name,
          email: consumer.email
        }));

        setFilteredUsers(mappedUsers);
        // Automatically show suggestions if results found
        if (mappedUsers.length > 0) {
          setShowUserSuggestions(true);
        } else {
          setShowUserSuggestions(false);
        }
      } catch (err) {
        console.error('Error searching consumers:', err);
        toast.error('Failed to search consumers');
        setFilteredUsers([]);
        setShowUserSuggestions(false);
      } finally {
        setLoadingUsers(false);
      }
    };

    searchConsumers();
  }, [debouncedUserSearch]);

  // Handle Agent Search for filtering (with debouncing)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (filters.agentSearch?.trim().length >= 2) {
        setLoadingAgentSearch(true);
        try {
          const response = await inboundApi.getAllInboundAgents({ 
            search: filters.agentSearch,
            page: 1,
            limit: 10
          });
          if (response.success && response.data) {
            setAgentSearchResults(response.data);
            setShowAgentSuggestions(true);
          }
        } catch (error) {
          console.error('Error searching agents for filter:', error);
        } finally {
          setLoadingAgentSearch(false);
        }
      } else {
        setAgentSearchResults([]);
        setShowAgentSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.agentSearch]);

  // Handle outside clicks for agent suggestions
  useEffect(() => {
    const handleOutsideClick = () => setShowAgentSuggestions(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);
  // Handle outside clicks for user suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserSuggestions && !event.target.closest('.user-search-container')) {
        setShowUserSuggestions(false);
      }
    };

    if (showUserSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserSuggestions]);

  // Update selected user display when agentFormData.user_id changes
  useEffect(() => {
    if (agentFormData.user_id) {
      const user = users.find(u => (u.user_id || u.id) === agentFormData.user_id) ||
        filteredUsers.find(u => (u.user_id || u.id) === agentFormData.user_id);
      if (user) {
        setSelectedUserDisplay(`${user.full_name || user.email || ''} ${user.email ? `(${user.email})` : ''}`.trim());
      } else {
        setSelectedUserDisplay('');
      }
    } else {
      setSelectedUserDisplay('');
    }
  }, [agentFormData.user_id, users, filteredUsers]);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        setAudioProgress(0);
        setAudioCurrentTime(0);
        setAudioDuration(0);
      }
    };
  }, [audioElement]);

  // Fetch inbound agents
  const fetchInboundAgents = async (force = false) => {
    try {
      setLoading(true);
      const { page, limit } = pagination.agents;
      const response = await inboundApi.getAllInboundAgents({ 
        page, 
        limit,
        search: debouncedSearch,
        status: filters.status !== 'all' ? filters.status : undefined
      });

      if (response.success && response.data) {
        const agents = Array.isArray(response.data) ? response.data : response.data;
        setInboundAgents(agents);
        setPagination(prev => ({
          ...prev,
          agents: { ...prev.agents, total: response.total || response.count || 0 }
        }));
        setLoadedTabs(prev => ({ ...prev, agents: true }));
      } else {
        setInboundAgents([]);
        setLoadedTabs(prev => ({ ...prev, agents: true }));
      }
    } catch (error) {
      console.error('Error fetching inbound agents:', error);
      toast.error(error.message || 'Failed to load inbound agents');
      setInboundAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    const triggerFetch = () => {
      // Refresh stats on tab change
      fetchStatistics();
      
      if (activeTab === 'numbers') {
        fetchInboundNumbers();
        fetchAvailableAgents();
        fetchUsers();
      } else if (activeTab === 'calls') {
        fetchCallHistory();
      } else if (activeTab === 'schedules') {
        fetchSchedules();
      } else if (activeTab === 'agents') {
        fetchInboundAgents();
        fetchUsers();
      }
    };
    
    triggerFetch();
  }, [activeTab, pagination[activeTab].page, debouncedSearch, filters.status, filters.provider, filters.agentId, filters.callerNumber]);

  // View number details
  const handleViewNumber = async (number) => {
    setSelectedNumber(number);
    setShowNumberModal(true);
    setNumberModalTab('details');
    await fetchNumberCalls(number.id);
    await fetchNumberAnalytics(number.id);
  };

  // Open edit modal
  const handleEditNumber = (number) => {
    setFormData({
      phone_number: number.phone_number || '',
      country_code: number.country_code || '+1',
      phone_label: number.phone_label || '',
      call_forwarding_number: number.call_forwarding_number || '',
      provider: number.provider || 'twilio',
      status: number.status || 'active',
      assigned_to_agent_id: number.assigned_to_agent_id || '',
      sms_enabled: number.sms_enabled || false,
      twilio_sid: number.twilio_sid || '',
      twilio_account_sid: number.twilio_account_sid || '',
      twilio_auth_token: number.twilio_auth_token || '',
      vonage_api_key: number.vonage_api_key || '',
      vonage_api_secret: number.vonage_api_secret || '',
      vonage_application_id: number.vonage_application_id || '',
      telnyx_api_key: number.telnyx_api_key || '',
      provider_api_key: number.provider_api_key || '',
      callhippo_api_key: number.callhippo_api_key || '',
      termination_uri: number.termination_uri || ''
    });
    setSelectedNumber(number);
    setShowEditModal(true);
  };

  // Open create modal
  const handleCreateNumber = () => {
    setFormData({
      phone_number: '',
      country_code: '+1',
      phone_label: '',
      call_forwarding_number: '',
      provider: 'twilio',
      status: 'pending',
      assigned_to_agent_id: '',
      sms_enabled: false,
      twilio_sid: '',
      twilio_account_sid: '',
      twilio_auth_token: '',
      vonage_api_key: '',
      vonage_api_secret: '',
      vonage_application_id: '',
      telnyx_api_key: '',
      provider_api_key: '',
      callhippo_api_key: '',
      termination_uri: ''
    });
    setSelectedNumber(null);
    setShowCreateModal(true);
  };


  // Save number (create or update)
  const handleSaveNumber = async () => {
    setSaving(true);
    try {
      const saveData = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      if (selectedNumber) {
        // Update
        const response = await inboundApi.updateNumber(selectedNumber.id, saveData);
        if (response.success) {
          toast.success('Inbound number updated successfully');
          setShowEditModal(false);

          // Update selected number if modal is open
          if (showNumberModal && response.data) {
            setSelectedNumber(response.data);
          }
        }
      } else {
        // Create
        const response = await inboundApi.createNumber(saveData);
        if (response.success) {
          toast.success('Inbound number created successfully');
          setShowCreateModal(false);
        }
      }

      await fetchInboundNumbers(true);
      await fetchStatistics();
    } catch (error) {
      console.error('Error saving number:', error);
      toast.error(error.message || `Failed to ${selectedNumber ? 'update' : 'create'} inbound number`);
    } finally {
      setSaving(false);
    }
  };

  // Assign Agent handlers
  const handleAssignClick = (number) => {
    setSelectedNumber(number);
    setFormData({
      ...formData,
      assigned_to_agent_id: number.assigned_to_agent_id || ''
    });
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedNumber) return;

    setAssigningLoading(true);
    try {
      const response = await inboundApi.assignNumberToAgent(selectedNumber.id, formData.assigned_to_agent_id);

      if (response && (response.success || response.data)) {
        toast.success(`Agent ${formData.assigned_to_agent_id ? 'assigned' : 'unassigned'} successfully`);
        setShowAssignModal(false);
        fetchInboundNumbers(true);
        fetchStatistics();
      } else {
        throw new Error(response?.error || 'Failed to assign agent');
      }
    } catch (error) {
      console.error('Error assigning agent:', error);
      toast.error(error.message || 'Failed to assign agent');
    } finally {
      setAssigningLoading(false);
    }
  };

  // Delete number
  const handleDeleteClick = (item, type) => {
    if (!canDelete) {
      toast.error("You don't have permission to delete");
      return;
    }
    setItemToDelete(item);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete?.id) return;

    setDeleting(true);
    try {
      if (deleteType === 'number') {
        const response = await inboundApi.deleteNumber(itemToDelete.id);
        if (response.success) {
          toast.success('Number deleted successfully');
          await fetchInboundNumbers(true);
          await fetchStatistics();
        }
      } else if (deleteType === 'call') {
        // Note: Delete for calls not implemented in API yet
        toast.error('Delete for calls is not yet implemented');
        setDeleting(false);
        return;
      } else {
        // Note: Delete for schedules not implemented in API yet
        toast.error('Delete for schedules is not yet implemented');
        setDeleting(false);
        return;
      }

      setShowDeleteModal(false);
      setItemToDelete(null);
      setDeleteType(null);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(error.message || `Failed to delete ${deleteType}`);
    } finally {
      setDeleting(false);
    }
  };

  // Agent handlers
  const handleViewAgent = (agent) => {
    setSelectedAgent(agent);
    setShowAgentModal(true);
  };

  const handleEditAgent = async (agent) => {
    // Fetch users if not loaded to get user display name
    if (!usersLoaded) {
      await fetchUsers(true);
    }

    // Find user to set display name
    const user = users.find(u => (u.user_id || u.id) === agent.user_id);
    const userDisplay = user ? `${user.full_name || user.email || ''} ${user.email ? `(${user.email})` : ''}`.trim() : '';

    setAgentFormData({
      name: agent.name || '',
      user_id: agent.user_id || '',
      company_name: agent.company_name || '',
      website_url: agent.website_url || '',
      goal: agent.goal || '',
      background: agent.background || '',
      welcome_message: agent.welcome_message || '',
      instruction_voice: agent.instruction_voice || '',
      script: agent.script || '',
      voice: agent.voice || 'aura-helena-en',
      tone: agent.tone || 'professional',
      model: agent.model || 'gpt-4o',
      background_noise: agent.background_noise || 'office',
      language: agent.language || 'en-US',
      agent_type: agent.agent_type || '',
      tool: agent.tool || '',
      timezone: agent.timezone || '',
      phone_provider: agent.phone_provider || '',
      phone_number: agent.phone_number || '',
      phone_label: agent.phone_label || '',
      twilio_sid: agent.twilio_sid || '',
      twilio_auth_token: agent.twilio_auth_token || '',
      sms_enabled: agent.sms_enabled || false,
      vonage_api_key: agent.vonage_api_key || '',
      vonage_api_secret: agent.vonage_api_secret || '',
      telnyx_api_key: agent.telnyx_api_key || '',
      status: agent.status || 'active',
      vapi_id: agent.vapi_id || '',
      vapi_account_assigned: agent.vapi_account_assigned || '',
      account_in_use: agent.account_in_use || false,
      voice_provider: agent.voice_provider || 'deepgram',
      execution_mode: agent.execution_mode || 'production',
      temperature: agent.temperature || '',
      confidence: agent.confidence || 0.8,
      verbosity: agent.verbosity || 0.7,
      fallback_number: agent.fallback_number || '',
      fallback_enabled: agent.fallback_enabled || false,
      knowledge_base_id: agent.knowledge_base_id || '',
      metadata: agent.metadata || {}
    });
    setSelectedAgent(agent);
    setSelectedUserDisplay(userDisplay);
    setUserSearchTerm('');
    setShowUserSuggestions(false);
    setShowAgentEditModal(true);
  };

  const handleCreateAgent = () => {
    setAgentFormData({
      name: '',
      user_id: '',
      company_name: '',
      website_url: '',
      goal: '',
      background: '',
      welcome_message: '',
      instruction_voice: '',
      script: '',
      voice: 'aura-helena-en',
      tone: 'professional',
      model: 'gpt-4o',
      background_noise: 'office',
      language: 'en-US',
      agent_type: '',
      tool: '',
      timezone: '',
      phone_provider: '',
      phone_number: '',
      phone_label: '',
      twilio_sid: '',
      twilio_auth_token: '',
      sms_enabled: false,
      vonage_api_key: '',
      vonage_api_secret: '',
      telnyx_api_key: '',
      status: 'active',
      vapi_id: '',
      vapi_account_assigned: '',
      account_in_use: false,
      voice_provider: 'deepgram',
      execution_mode: 'production',
      temperature: '',
      confidence: 0.8,
      verbosity: 0.7,
      fallback_number: '',
      fallback_enabled: false,
      knowledge_base_id: '',
      metadata: {}
    });
    setSelectedAgent(null);
    setSelectedUserDisplay('');
    setUserSearchTerm('');
    setShowUserSuggestions(false);
    setShowAgentCreateModal(true);
  };

  const handleSaveAgent = async () => {
    setSaving(true);
    try {
      const saveData = {
        ...agentFormData,
        updated_at: new Date().toISOString()
      };

      // Remove empty strings and convert to null
      Object.keys(saveData).forEach(key => {
        if (saveData[key] === '') {
          saveData[key] = null;
        }
      });

      if (selectedAgent) {
        // Update
        const response = await inboundApi.updateAgent(selectedAgent.id, saveData);
        if (response.success) {
          toast.success('Agent updated successfully');
          setShowAgentEditModal(false);
          await fetchInboundAgents(true);
          await fetchStatistics();
        }
      } else {
        // Create
        const response = await inboundApi.createAgent(saveData);
        if (response.success) {
          toast.success('Agent created successfully');
          setShowAgentCreateModal(false);
          await fetchInboundAgents(true);
          await fetchStatistics();
        }
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      toast.error(error.message || `Failed to ${selectedAgent ? 'update' : 'create'} agent`);
    } finally {
      setSaving(false);
    }
  };

  // Close call modal only (keeps number modal open)
  const closeCallModal = () => {
    // Stop any playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioElement(null);
      setPlayingAudioId(null);
      setAudioProgress(0);
      setAudioCurrentTime(0);
      setAudioDuration(0);
    }
    setShowCallModal(false);
    setSelectedCall(null);
  };

  // Close modals
  const closeModals = () => {
    // Stop any playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioElement(null);
      setPlayingAudioId(null);
      setAudioProgress(0);
      setAudioCurrentTime(0);
      setAudioDuration(0);
    }
    setShowNumberModal(false);
    setShowCallModal(false);
    setShowDeleteModal(false);
    setShowEditModal(false);
    setShowCreateModal(false);
    setShowAgentModal(false);
    setShowAgentEditModal(false);
    setShowAgentCreateModal(false);
    setSelectedNumber(null);
    setSelectedCall(null);
    setSelectedSchedule(null);
    setSelectedAgent(null);
    setItemToDelete(null);
    setDeleteType(null);
    setNumberCalls([]);
    setNumberAnalytics([]);
  };

  // Filter functions
  const filteredNumbers = inboundNumbers.filter(num => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      num.phone_number?.toLowerCase().includes(query) ||
      num.phone_label?.toLowerCase().includes(query) ||
      num.provider?.toLowerCase().includes(query) ||
      num.status?.toLowerCase().includes(query) ||
      num.user_email?.toLowerCase().includes(query) ||
      num.user_full_name?.toLowerCase().includes(query) ||
      num.user_id?.toLowerCase().includes(query)
    );
  });

  const filteredCalls = callHistory.filter(call => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!(
        call.caller_number?.toLowerCase().includes(query) ||
        call.called_number?.toLowerCase().includes(query) ||
        call.call_status?.toLowerCase().includes(query) ||
        call.inbound_numbers?.phone_number?.toLowerCase().includes(query)
      )) {
        return false;
      }
    }

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'answered' && call.call_status !== 'answered' && call.call_status !== 'completed') {
        return false;
      } else if (filters.status !== 'answered' && call.call_status !== filters.status) {
        return false;
      }
    }

    return true;
  });

  // Audio playback handler
  const handlePlayRecording = (recordingUrl, callId) => {
    if (playingAudioId === callId && audioElement) {
      // Pause current audio
      audioElement.pause();
      setPlayingAudioId(null);
    } else {
      // Stop any currently playing audio
      if (audioElement && playingAudioId !== callId) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      // Use existing audio element if it's the same recording, otherwise create new one
      let audio = audioElement;
      if (!audio || playingAudioId !== callId) {
        audio = new Audio(recordingUrl);

        // Set up event listeners
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
          if (audio.duration) {
            setAudioCurrentTime(audio.currentTime);
            setAudioProgress((audio.currentTime / audio.duration) * 100);
          }
        });

        audio.addEventListener('ended', () => {
          setPlayingAudioId(null);
          setAudioProgress(0);
          setAudioCurrentTime(0);
        });

        audio.addEventListener('error', () => {
          toast.error('Failed to play recording');
          setPlayingAudioId(null);
          setAudioElement(null);
          setAudioProgress(0);
          setAudioCurrentTime(0);
          setAudioDuration(0);
        });

        setAudioElement(audio);
      }

      // Load metadata if not already loaded
      if (audio.readyState >= 1) {
        setAudioDuration(audio.duration);
      }

      audio.play();
      setPlayingAudioId(callId);
    }
  };

  // Handle progress bar click (scrub)
  const handleProgressClick = (e, audioElement) => {
    if (!audioElement || !audioDuration) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audioDuration;

    audioElement.currentTime = newTime;
    setAudioCurrentTime(newTime);
    setAudioProgress(percentage * 100);
  };

  // Export data to CSV
  const exportToCSV = (data, type) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      let headers = [];
      let rows = [];

      if (type === 'numbers') {
        headers = ['Phone Number', 'Label', 'User', 'User Email', 'Provider', 'Status', 'Health Status', 'Webhook Status', 'Agent', 'Created At'];
        rows = data.map(item => [
          item.phone_number || '',
          item.phone_label || '',
          item.user_email || item.user_profile?.email || item.user_id?.substring(0, 8) || '',
          item.user_email || '',
          item.provider || '',
          item.status || '',
          item.health_status || 'unknown',
          item.webhook_status || 'unknown',
          item.assigned_to_agent_id ? 'Assigned' : 'Unassigned',
          item.created_at ? new Date(item.created_at).toLocaleString() : ''
        ]);
      } else if (type === 'calls') {
        headers = ['Date', 'Caller', 'Called', 'Status', 'Duration', 'Cost', 'Number'];
        rows = data.map(item => [
          item.call_start_time ? new Date(item.call_start_time).toLocaleString() : '',
          item.caller_number || '',
          item.called_number || '',
          item.call_status || '',
          item.call_duration ? `${Math.floor(item.call_duration / 60)}m ${Math.floor(item.call_duration % 60)}s` : '0s',
          item.call_cost ? `$${item.call_cost.toFixed(2)}` : '$0.00',
          item.inbound_numbers?.phone_number || ''
        ]);
      } else if (type === 'agents') {
        headers = ['Name', 'Company', 'Type', 'Status', 'Phone', 'Voice', 'Model', 'User Email', 'Created At'];
        rows = data.map(item => [
          item.name || '',
          item.company_name || '',
          item.agent_type || '',
          item.status || '',
          item.phone_number || '',
          item.voice || '',
          item.model || 'gpt-4o',
          item.user_email || item.user_full_name || item.user_id?.substring(0, 8) || '',
          item.created_at ? new Date(item.created_at).toLocaleString() : ''
        ]);
      }

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape commas and quotes in cell values
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inbound_${type}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${data.length} ${type} to CSV`);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Failed to export data to CSV');
    }
  };

  // Format time helper
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredAgents = inboundAgents.filter(agent => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(query) ||
      agent.company_name?.toLowerCase().includes(query) ||
      agent.phone_number?.toLowerCase().includes(query) ||
      agent.status?.toLowerCase().includes(query) ||
      agent.agent_type?.toLowerCase().includes(query)
    );
  });

  if (!canView) {
    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          margin: '60px auto',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <span style={{ fontSize: '32px', color: '#dc3545' }}>🔒</span>
          </div>
          <h4 style={{ margin: '0 0 12px 0', color: '#333', fontWeight: '600' }}>Access Denied</h4>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>You don't have permission to view Inbound Genie.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <style>
        {`
          .inbound-user-cell:hover .inbound-user-popover {
            display: block !important;
          }
        `}
      </style>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h3 style={{
              margin: '0 0 8px 0',
              color: '#333',
              fontWeight: '600',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Phone size={24} style={{ color: '#74317e' }} />
              Inbound Genie
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Manage inbound phone numbers, call history, schedules, and agents
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {canCreate && activeTab === 'numbers' && (
              <button
                onClick={handleCreateNumber}
                style={{
                  padding: '12px 24px',
                  background: '#74317e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={18} />
                Add Number
              </button>
            )}
            {canCreate && activeTab === 'agents' && (
              <button
                onClick={handleCreateAgent}
                style={{
                  padding: '12px 24px',
                  background: '#74317e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={18} />
                Add Agent
              </button>
            )}
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            borderLeft: '4px solid #74317e'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Total Numbers</span>
              <Phone size={20} color="#74317e" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#74317e' }}>{statistics.totalNumbers}</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {statistics.activeNumbers} active
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            borderLeft: '4px solid #28a745'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Total Calls</span>
              <Phone size={20} color="#28a745" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#28a745' }}>{statistics.totalCalls}</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {statistics.answeredCalls} answered
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            borderLeft: '4px solid #17a2b8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Total Agents</span>
              <Users size={20} color="#17a2b8" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#17a2b8' }}>{statistics.totalAgents}</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {statistics.activeAgents} active
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            borderLeft: '4px solid #ffc107'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Schedules</span>
              <Calendar size={20} color="#ffc107" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffc107' }}>{statistics.totalSchedules}</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {statistics.activeSchedules} active
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            borderBottom: '2px solid #f0f0f0',
            backgroundColor: '#fafafa'
          }}>
            <button
              onClick={() => setActiveTab('numbers')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === 'numbers' ? '600' : '400',
                color: activeTab === 'numbers' ? '#74317e' : '#666',
                cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === 'numbers' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                pointerEvents: (loading || saving) ? 'none' : 'auto',
                opacity: (loading || saving) ? 0.7 : 1
              }}
              disabled={loading || saving}
            >
              <Phone size={16} />
               Numbers
              {pagination.numbers.total > 0 && (
                <span style={{
                  backgroundColor: activeTab === 'numbers' ? '#74317e' : '#e5e7eb',
                  color: activeTab === 'numbers' ? 'white' : '#666',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {pagination.numbers.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === 'calls' ? '600' : '400',
                color: activeTab === 'calls' ? '#74317e' : '#666',
                cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === 'calls' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                pointerEvents: (loading || saving) ? 'none' : 'auto',
                opacity: (loading || saving) ? 0.7 : 1
              }}
              disabled={loading || saving}
            >
              <Clock size={16} />
               Call History
              {pagination.calls.total > 0 && (
                <span style={{
                  backgroundColor: activeTab === 'calls' ? '#74317e' : '#e5e7eb',
                  color: activeTab === 'calls' ? 'white' : '#666',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {pagination.calls.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === 'schedules' ? '600' : '400',
                color: activeTab === 'schedules' ? '#74317e' : '#666',
                cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === 'schedules' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                pointerEvents: (loading || saving) ? 'none' : 'auto',
                opacity: (loading || saving) ? 0.7 : 1
              }}
              disabled={loading || saving}
            >
              <Calendar size={16} />
               Schedules
              {pagination.schedules.total > 0 && (
                <span style={{
                  backgroundColor: activeTab === 'schedules' ? '#74317e' : '#e5e7eb',
                  color: activeTab === 'schedules' ? 'white' : '#666',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {pagination.schedules.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === 'agents' ? '600' : '400',
                color: activeTab === 'agents' ? '#74317e' : '#666',
                cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === 'agents' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                pointerEvents: (loading || saving) ? 'none' : 'auto',
                opacity: (loading || saving) ? 0.7 : 1
              }}
              disabled={loading || saving}
            >
              <Users size={16} />
               Agents
              {pagination.agents.total > 0 && (
                <span style={{
                  backgroundColor: activeTab === 'agents' ? '#74317e' : '#e5e7eb',
                  color: activeTab === 'agents' ? 'white' : '#666',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {pagination.agents.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === 'settings' ? '600' : '400',
                color: activeTab === 'settings' ? '#74317e' : '#666',
                cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === 'settings' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                pointerEvents: (loading || saving) ? 'none' : 'auto',
                opacity: (loading || saving) ? 0.7 : 1
              }}
              disabled={loading || saving}
            >
              <BarChart3 size={16} />
               Settings
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === 'pricing' ? '600' : '400',
                color: activeTab === 'pricing' ? '#74317e' : '#666',
                cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                borderBottom: activeTab === 'pricing' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
                pointerEvents: (loading || saving) ? 'none' : 'auto',
                opacity: (loading || saving) ? 0.7 : 1
              }}
              disabled={loading || saving}
            >
              <DollarSign size={16} />
               Pricing
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '24px' }}>
            {/* Search Bar and Controls */}
            {activeTab !== 'settings' && activeTab !== 'pricing' && (
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999'
                  }}
                />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: (loading || saving) ? '#f3f4f6' : 'white',
                    cursor: (loading || saving) ? 'not-allowed' : 'text'
                  }}
                  disabled={loading || saving}
                />
              </div>

              {/* Advanced Filters */}
              {activeTab === 'numbers' && (
                <>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                      backgroundColor: (loading || saving) ? '#f3f4f6' : 'white'
                    }}
                    disabled={loading || saving}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={filters.provider}
                    onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                      backgroundColor: (loading || saving) ? '#f3f4f6' : 'white'
                    }}
                    disabled={loading || saving}
                  >
                    <option value="all">All Providers</option>
                    <option value="twilio">Twilio</option>
                    <option value="vonage">Vonage</option>
                    <option value="telnyx">Telnyx</option>
                  </select>
                </>
              )}

              {activeTab === 'calls' && (
                <>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                      backgroundColor: (loading || saving) ? '#f3f4f6' : 'white'
                    }}
                    disabled={loading || saving}
                  >
                    <option value="all">All Status</option>
                    <option value="answered">Answered</option>
                    <option value="completed">Completed</option>
                    <option value="missed">Missed</option>
                    <option value="forwarded">Forwarded</option>
                  </select>

                  {/* Agent Filter Search */}
                  <div style={{ position: 'relative', minWidth: '180px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Search Agent..."
                        value={filters.agentSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilters(prev => ({ 
                            ...prev, 
                            agentSearch: val,
                            agentId: val === '' ? 'all' : prev.agentId 
                          }));
                        }}
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%',
                          backgroundColor: filters.agentId !== 'all' ? '#f0f7ff' : (loading || saving) ? '#f3f4f6' : 'white',
                          cursor: (loading || saving) ? 'not-allowed' : 'text'
                        }}
                        disabled={loading || saving}
                      />
                      {filters.agentId !== 'all' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilters(prev => ({ ...prev, agentId: 'all', agentSearch: '' }));
                          }}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'none',
                            color: '#007bff',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {showAgentSuggestions && agentSearchResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {agentSearchResults.map(agent => (
                          <div
                            key={agent.id}
                            onClick={() => {
                              setFilters(prev => ({ 
                                ...prev, 
                                agentId: agent.id, 
                                agentSearch: agent.name 
                              }));
                              setShowAgentSuggestions(false);
                            }}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #eee',
                              fontSize: '14px',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ fontWeight: '600' }}>{agent.name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{agent.company_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Caller Number Filter */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Filter by Caller..."
                      value={filters.callerNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilters({ ...filters, callerNumber: val });
                      }}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        width: '180px',
                        backgroundColor: (loading || saving) ? '#f3f4f6' : 'white',
                        cursor: (loading || saving) ? 'not-allowed' : 'text'
                      }}
                      disabled={loading || saving}
                    />
                    {filters.callerNumber && (
                      <button
                        onClick={() => setFilters({ ...filters, callerNumber: '' })}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'none',
                          color: '#999',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Export Button */}
              {(activeTab === 'numbers' || activeTab === 'calls' || activeTab === 'agents') && (
                <button
                  onClick={() => {
                    const data = activeTab === 'numbers' ? filteredNumbers :
                      activeTab === 'calls' ? filteredCalls :
                        filteredAgents;
                    exportToCSV(data, activeTab);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '500',
                    opacity: (loading || saving) ? 0.6 : 1
                  }}
                  disabled={loading || saving}
                  title="Export to CSV"
                >
                  <Download size={16} />
                  Export
                </button>
              )}

              <button
                onClick={() => {
                  if (activeTab === 'numbers') fetchInboundNumbers(true);
                  else if (activeTab === 'calls') fetchCallHistory(true);
                  else if (activeTab === 'schedules') fetchSchedules(true);
                  else if (activeTab === 'agents') fetchInboundAgents(true);
                }}
                style={{
                  padding: '10px 20px',
                  background: '#74317e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (loading || saving) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  opacity: (loading || saving) ? 0.6 : 1
                }}
                disabled={loading || saving}
              >
                <RefreshCw size={16} className={(loading || saving) ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            )}

            {/* Numbers Tab */}
            {activeTab === 'numbers' && (
              <div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading numbers...</p>
                  </div>
                ) : filteredNumbers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No inbound numbers found</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Phone Number</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Label</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>User</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Provider</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Health</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Webhook</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Agent</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNumbers.map((number) => (
                          <tr key={number.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px', fontWeight: '500' }}>{number.phone_number}</td>
                            <td style={{ padding: '12px' }}>{number.phone_label || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '12px' }}>
                              <UserCell item={number} users={users} />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: '#17a2b8',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {number.provider}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: number.status === 'active' ? '#28a745' :
                                  number.status === 'inactive' ? '#6c757d' :
                                    number.status === 'error' ? '#dc3545' :
                                      '#ffc107',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {number.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              {number.health_status && (
                                <span style={{
                                  padding: '4px 8px',
                                  background: number.health_status === 'healthy' ? '#28a745' :
                                    number.health_status === 'unhealthy' ? '#dc3545' :
                                      '#ffc107',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}>
                                  {number.health_status}
                                </span>
                              )}
                              {!number.health_status && <span style={{ color: '#999', fontSize: '12px' }}>Unknown</span>}
                            </td>
                            <td style={{ padding: '12px' }}>
                              {number.webhook_status && (
                                <span style={{
                                  padding: '4px 8px',
                                  background: number.webhook_status === 'active' ? '#28a745' :
                                    number.webhook_status === 'failed' ? '#dc3545' :
                                      '#ffc107',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}>
                                  {number.webhook_status}
                                </span>
                              )}
                              {!number.webhook_status && <span style={{ color: '#999', fontSize: '12px' }}>Unknown</span>}
                            </td>
                            <td style={{ padding: '12px' }}>{number.voice_agents?.name || '-'}</td>
                            <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                              {new Date(number.created_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleAssignClick(number)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                  }}
                                  title="Assign Agent"
                                >
                                  <Users size={14} />
                                  {number.assigned_to_agent_id ? 'Reassign' : 'Assign'}
                                </button>
                                <button
                                  onClick={() => handleViewNumber(number)}

                                  style={{
                                    padding: '6px 12px',
                                    background: '#17a2b8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                  }}
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                  View
                                </button>
                                {canEdit && (
                                  <button
                                    onClick={() => handleEditNumber(number)}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#74317e',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '12px'
                                    }}
                                    title="Edit Number"
                                  >
                                    <Edit2 size={14} />
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteClick(number, 'number')}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#dc3545',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '12px'
                                    }}
                                    title="Delete Number"
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination 
                  current={pagination.numbers.page}
                  total={pagination.numbers.total}
                  limit={pagination.numbers.limit}
                  onPageChange={(page) => setPagination(prev => ({
                    ...prev,
                    numbers: { ...prev.numbers, page }
                  }))}
                  disabled={loading || saving}
                />
              </div>
            )}

            {/* Call History Tab */}
            {activeTab === 'calls' && (
              <div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading call history...</p>
                  </div>
                ) : filteredCalls.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No call history found</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Caller</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Called Number</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Duration</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Agent</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCalls.map((call) => (
                          <tr key={call.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px' }}>{call.caller_number || '-'}</td>
                            <td style={{ padding: '12px' }}>{call.inbound_numbers?.phone_number || call.called_number || '-'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: call.call_status === 'answered' || call.call_status === 'completed' ? '#28a745' :
                                  call.call_status === 'missed' ? '#dc3545' :
                                    call.call_status === 'forwarded' ? '#17a2b8' :
                                      '#ffc107',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {call.call_status || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>{call.call_duration ? `${Math.floor(call.call_duration / 60)}m ${Math.floor(call.call_duration % 60)}s` : '-'}</td>
                            <td style={{ padding: '12px' }}>{call.voice_agents?.name || '-'}</td>
                            <td style={{ padding: '12px' }}>{call.call_start_time ? new Date(call.call_start_time).toLocaleString() : '-'}</td>
                            <td style={{ padding: '12px' }}>
                              <button
                                onClick={() => {
                                  setSelectedCall(call);
                                  setShowCallModal(true);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#17a2b8',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px'
                                }}
                                title="View Details"
                              >
                                <Eye size={14} />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination 
                  current={pagination.calls.page}
                  total={pagination.calls.total}
                  limit={pagination.calls.limit}
                  onPageChange={(page) => setPagination(prev => ({
                    ...prev,
                    calls: { ...prev.calls, page }
                  }))}
                  disabled={loading || saving}
                />
              </div>
            )}

            {/* Schedules Tab */}
            {activeTab === 'schedules' && (
              <div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading schedules...</p>
                  </div>
                ) : schedules.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No schedules found</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Schedule Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Number</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Agent</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Timezone</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map((schedule) => (
                          <tr key={schedule.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px' }}>{schedule.schedule_name}</td>
                            <td style={{ padding: '12px' }}>{schedule.inbound_numbers?.phone_number || '-'}</td>
                            <td style={{ padding: '12px' }}>{schedule.voice_agents?.name || '-'}</td>
                            <td style={{ padding: '12px' }}>{schedule.timezone || '-'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: schedule.is_active ? '#28a745' : '#6c757d',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {schedule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>{new Date(schedule.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination 
                  current={pagination.schedules.page}
                  total={pagination.schedules.total}
                  limit={pagination.schedules.limit}
                  onPageChange={(page) => setPagination(prev => ({
                    ...prev,
                    schedules: { ...prev.schedules, page }
                  }))}
                />
              </div>
            )}

            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading agents...</p>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No inbound agents found</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Company</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Phone</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Voice</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Model</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>User Email</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Created</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAgents.map((agent) => {
                          return (
                            <tr key={agent.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '12px', fontWeight: '500' }}>{agent.name}</td>
                              <td style={{ padding: '12px' }}>{agent.company_name || '-'}</td>
                              <td style={{ padding: '12px' }}>
                                {agent.agent_type && (
                                  <span style={{
                                    padding: '4px 8px',
                                    background: '#17a2b8',
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}>
                                    {agent.agent_type}
                                  </span>
                                )}
                                {!agent.agent_type && <span style={{ color: '#999', fontSize: '12px' }}>-</span>}
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  background: agent.status === 'active' ? '#28a745' :
                                    agent.status === 'inactive' ? '#6c757d' :
                                      agent.status === 'testing' ? '#ffc107' :
                                        agent.status === 'draft' ? '#6c757d' :
                                          '#dc3545',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}>
                                  {agent.status || 'inactive'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', fontSize: '12px' }}>{agent.phone_number || '-'}</td>
                              <td style={{ padding: '12px', fontSize: '12px' }}>
                                {agent.voice ? (
                                  <span style={{
                                    padding: '4px 8px',
                                    background: '#e5e7eb',
                                    color: '#333',
                                    borderRadius: '4px',
                                    fontSize: '11px'
                                  }}>
                                    {agent.voice}
                                  </span>
                                ) : '-'}
                              </td>
                              <td style={{ padding: '12px', fontSize: '12px' }}>{agent.model || 'gpt-4o'}</td>
                              <td style={{ padding: '12px', fontSize: '12px' }}>
                                {agent.user_email ? (
                                  <span title={agent.user_full_name || agent.user_id || ''}>
                                    {agent.user_email}
                                  </span>
                                ) : agent.user_full_name ? (
                                  <span style={{ color: '#666' }} title={agent.user_id || ''}>
                                    {agent.user_full_name}
                                  </span>
                                ) : agent.user_id ? (
                                  <span style={{ color: '#999', fontSize: '11px' }} title={agent.user_id}>
                                    {agent.user_id.substring(0, 8)}...
                                  </span>
                                ) : (
                                  <span style={{ color: '#999' }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                                {new Date(agent.created_at).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => handleViewAgent(agent)}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#17a2b8',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '12px'
                                    }}
                                    title="View Details"
                                  >
                                    <Eye size={14} />
                                    View
                                  </button>
                                  {canEdit && (
                                    <button
                                      onClick={() => handleEditAgent(agent)}
                                      style={{
                                        padding: '6px 12px',
                                        background: '#74317e',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '12px'
                                      }}
                                      title="Edit Agent"
                                    >
                                      <Edit2 size={14} />
                                      Edit
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteClick(agent, 'agent')}
                                      style={{
                                        padding: '6px 12px',
                                        background: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '12px'
                                      }}
                                      title="Delete Agent"
                                    >
                                      <Trash2 size={14} />
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination 
                  current={pagination.agents.page}
                  total={pagination.agents.total}
                  limit={pagination.agents.limit}
                  onPageChange={(page) => setPagination(prev => ({
                    ...prev,
                    agents: { ...prev.agents, page }
                  }))}
                />
              </div>
            )}
            {activeTab === 'settings' && (
              <InboundSettings />
            )}
            {activeTab === 'pricing' && (
              <PricingSettings />
            )}

          </div>
        </div>
      </div>

      {/* Number Detail Modal - Similar to OutboundGenie but for inbound numbers */}
      {showNumberModal && selectedNumber && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={closeModals}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{selectedNumber.phone_number} - Details</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {canEdit && (
                  <button
                    onClick={() => {
                      setShowNumberModal(false);
                      handleEditNumber(selectedNumber);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#74317e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                )}
                <button
                  onClick={closeModals}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '24px',
                    color: '#666'
                  }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
              <button
                onClick={() => setNumberModalTab('details')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: numberModalTab === 'details' ? '#74317e' : 'transparent',
                  color: numberModalTab === 'details' ? 'white' : '#666',
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: numberModalTab === 'details' ? '600' : '400'
                }}
              >
                Details
              </button>
              <button
                onClick={() => setNumberModalTab('calls')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: numberModalTab === 'calls' ? '#74317e' : 'transparent',
                  color: numberModalTab === 'calls' ? 'white' : '#666',
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: numberModalTab === 'calls' ? '600' : '400',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Phone size={16} />
                Calls ({numberCalls.length})
              </button>
              <button
                onClick={() => setNumberModalTab('analytics')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: numberModalTab === 'analytics' ? '#74317e' : 'transparent',
                  color: numberModalTab === 'analytics' ? 'white' : '#666',
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: numberModalTab === 'analytics' ? '600' : '400',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <BarChart3 size={16} />
                Analytics
              </button>
            </div>

            {/* Details Tab */}
            {numberModalTab === 'details' && (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div><strong>Phone Number:</strong> {selectedNumber.phone_number}</div>
                <div><strong>Country Code:</strong> {selectedNumber.country_code}</div>
                <div><strong>Label:</strong> {selectedNumber.phone_label || '-'}</div>
                <div><strong>Provider:</strong> {selectedNumber.provider}</div>
                <div><strong>Status:</strong> {selectedNumber.status}</div>
                <div><strong>Health Status:</strong> {selectedNumber.health_status || '-'}</div>
                <div><strong>Webhook Status:</strong> {selectedNumber.webhook_status || '-'}</div>
                <div><strong>Assigned Agent:</strong> {selectedNumber.voice_agents?.name || '-'}</div>
                <div><strong>Call Forwarding:</strong> {selectedNumber.call_forwarding_number || '-'}</div>
                <div><strong>SMS Enabled:</strong> {selectedNumber.sms_enabled ? 'Yes' : 'No'}</div>
                <div><strong>Created:</strong> {new Date(selectedNumber.created_at).toLocaleString()}</div>
                {selectedNumber.updated_at && (
                  <div><strong>Updated:</strong> {new Date(selectedNumber.updated_at).toLocaleString()}</div>
                )}
              </div>
            )}

            {/* Calls Tab */}
            {numberModalTab === 'calls' && (
              <div>
                {loadingCalls ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading calls...</p>
                  </div>
                ) : numberCalls.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No calls found for this number</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Caller</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Duration</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {numberCalls.map((call) => (
                          <tr key={call.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px' }}>{call.caller_number || '-'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: call.call_status === 'answered' || call.call_status === 'completed' ? '#28a745' :
                                  call.call_status === 'missed' ? '#dc3545' :
                                    '#ffc107',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {call.call_status || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>{call.call_duration ? `${Math.floor(call.call_duration / 60)}m ${Math.floor(call.call_duration % 60)}s` : '-'}</td>
                            <td style={{ padding: '12px' }}>{call.call_start_time ? new Date(call.call_start_time).toLocaleString() : '-'}</td>
                            <td style={{ padding: '12px' }}>
                              <button
                                onClick={() => {
                                  setSelectedCall(call);
                                  setShowCallModal(true);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#17a2b8',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px'
                                }}
                                title="View Details"
                              >
                                <Eye size={14} />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {numberModalTab === 'analytics' && (
              <div>
                {loadingAnalytics ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading analytics...</p>
                  </div>
                ) : !Array.isArray(numberAnalytics) || numberAnalytics.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>No analytics data available</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Total Calls</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Answered</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Missed</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Avg Duration</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(numberAnalytics) && numberAnalytics.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '12px' }}>{new Date(item.date).toLocaleDateString()}</td>
                            <td style={{ padding: '12px' }}>{item.total_calls || 0}</td>
                            <td style={{ padding: '12px' }}>{item.answered_calls || 0}</td>
                            <td style={{ padding: '12px' }}>{item.missed_calls || 0}</td>
                            <td style={{ padding: '12px' }}>{item.average_duration_seconds ? `${Math.floor(item.average_duration_seconds)}s` : '-'}</td>
                            <td style={{ padding: '12px' }}>${item.total_cost ? item.total_cost.toFixed(2) : '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Number Modal */}
      {(showCreateModal || showEditModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={closeModals}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{selectedNumber ? 'Edit' : 'Create'} Inbound Number</h3>
              <button
                onClick={closeModals}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Provider */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Provider *</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#fff'
                  }}
                >
                  <option value="twilio">Twilio</option>
                  <option value="vonage">Vonage</option>
                  <option value="telnyx">Telnyx</option>
                </select>
              </div>

              {/* Inbound Number with Country Code */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Inbound Number *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '120px' }}>
                    <select
                      value={formData.country_code}
                      onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#f9fafb'
                      }}
                    >
                      <option value="+1">🇺🇸 +1 (US)</option>
                      <option value="+44">🇬🇧 +44 (UK)</option>
                      <option value="+91">🇮🇳 +91 (IN)</option>
                      <option value="+61">🇦🇺 +61 (AU)</option>
                      <option value="+1-CA">🇨🇦 +1 (CA)</option>
                      <option value="+49">🇩🇪 +49 (DE)</option>
                      <option value="+33">🇫🇷 +33 (FR)</option>
                      <option value="+81">🇯🇵 +81 (JP)</option>
                      <option value="+86">🇨🇳 +86 (CN)</option>
                      <option value="+55">🇧🇷 +55 (BR)</option>
                      <option value="+27">🇿🇦 +27 (ZA)</option>
                      <option value="+971">🇦🇪 +971 (UAE)</option>
                      <option value="+92">🇵🇰 +92 (PK)</option>
                      {/* Add more as needed */}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '') })}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    placeholder="Enter number without code"
                  />
                </div>
              </div>

              {/* Name (Phone Label) */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Name (Label)</label>
                <input
                  type="text"
                  value={formData.phone_label}
                  onChange={(e) => setFormData({ ...formData, phone_label: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., Marketing Campaign"
                />
              </div>

              {/* Termination URL */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Termination URL</label>
                <input
                  type="text"
                  value={formData.termination_uri}
                  onChange={(e) => setFormData({ ...formData, termination_uri: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  placeholder="https://your-webhook.com/endpoint"
                />
              </div>

              {/* Provider Credentials (conditionally shown but kept for functionality) */}
              <div style={{ marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#74317e',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {showAdvanced ? 'Hide Settings' : 'Show Provider Settings'}
                </button>

                {showAdvanced && (
                  <div style={{ display: 'grid', gap: '15px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {formData.provider === 'twilio' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>Account SID</label>
                          <input
                            type="text"
                            value={formData.twilio_account_sid}
                            onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>Auth Token</label>
                          <input
                            type="password"
                            value={formData.twilio_auth_token}
                            onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}
                    {formData.provider === 'vonage' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>API Key</label>
                          <input
                            type="text"
                            value={formData.vonage_api_key}
                            onChange={(e) => setFormData({ ...formData, vonage_api_key: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>API Secret</label>
                          <input
                            type="password"
                            value={formData.vonage_api_secret}
                            onChange={(e) => setFormData({ ...formData, vonage_api_secret: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}
                    {formData.provider === 'telnyx' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '12px' }}>API Key</label>
                        <input
                          type="password"
                          value={formData.telnyx_api_key}
                          onChange={(e) => setFormData({ ...formData, telnyx_api_key: e.target.value })}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  onClick={closeModals}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNumber}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    background: '#74317e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {saving ? 'Saving...' : selectedNumber ? 'Update Number' : 'Create Number'}
                  {saving && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Detail Modal */}
      {showCallModal && selectedCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }} onClick={closeCallModal}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Call Details</h3>
              <button
                onClick={closeCallModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div><strong>Caller:</strong> {selectedCall.caller_number || '-'}</div>
              <div><strong>Called Number:</strong> {selectedCall.inbound_numbers?.phone_number || selectedCall.called_number || '-'}</div>
              <div><strong>Status:</strong> {selectedCall.call_status || '-'}</div>
              <div><strong>Duration:</strong> {selectedCall.call_duration ? `${Math.floor(selectedCall.call_duration / 60)}m ${Math.floor(selectedCall.call_duration % 60)}s` : '-'}</div>
              <div><strong>Agent:</strong> {selectedCall.voice_agents?.name || '-'}</div>
              <div><strong>Provider:</strong> {selectedCall.provider || '-'}</div>
              {selectedCall.user_id && (
                <div><strong>User ID:</strong> {selectedCall.user_id}</div>
              )}
              {selectedCall.call_start_time && (
                <div><strong>Start Time:</strong> {new Date(selectedCall.call_start_time).toLocaleString()}</div>
              )}
              {selectedCall.call_answered_time && (
                <div><strong>Answered:</strong> {new Date(selectedCall.call_answered_time).toLocaleString()}</div>
              )}
              {selectedCall.call_end_time && (
                <div><strong>End Time:</strong> {new Date(selectedCall.call_end_time).toLocaleString()}</div>
              )}
              {selectedCall.recording_url && (
                <div>
                  <strong>Recording:</strong>
                  <div style={{ marginTop: '12px' }}>
                    {/* Audio Player Controls */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <button
                        onClick={() => handlePlayRecording(selectedCall.recording_url, selectedCall.id)}
                        style={{
                          padding: '8px 16px',
                          background: playingAudioId === selectedCall.id ? '#dc3545' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '14px',
                          minWidth: '80px',
                          justifyContent: 'center'
                        }}
                      >
                        {playingAudioId === selectedCall.id ? <Pause size={16} /> : <Play size={16} />}
                        {playingAudioId === selectedCall.id ? 'Pause' : 'Play'}
                      </button>
                      <span style={{ fontSize: '12px', color: '#666', minWidth: '80px' }}>
                        {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                      </span>
                      <a
                        href={selectedCall.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '8px 16px',
                          background: '#17a2b8',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          fontSize: '14px',
                          marginLeft: 'auto'
                        }}
                      >
                        Download
                      </a>
                    </div>

                    {/* Progress Bar */}
                    <div
                      onClick={(e) => {
                        if (audioElement && audioDuration) {
                          handleProgressClick(e, audioElement);
                        } else if (selectedCall.recording_url) {
                          // If audio not loaded yet, load it first
                          handlePlayRecording(selectedCall.recording_url, selectedCall.id);
                          setTimeout(() => {
                            if (audioElement) {
                              handleProgressClick(e, audioElement);
                            }
                          }, 100);
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '8px',
                        background: '#e5e7eb',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        position: 'relative',
                        marginTop: '8px'
                      }}
                    >
                      <div
                        style={{
                          width: `${audioProgress}%`,
                          height: '100%',
                          background: playingAudioId === selectedCall.id ? '#28a745' : '#17a2b8',
                          borderRadius: '4px',
                          transition: playingAudioId === selectedCall.id ? 'width 0.1s linear' : 'none'
                        }}
                      />
                      {audioProgress > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${audioProgress}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '16px',
                            height: '16px',
                            background: playingAudioId === selectedCall.id ? '#28a745' : '#17a2b8',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedCall.transcript && (
                <div>
                  <strong>Transcript:</strong>
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    lineHeight: '1.6'
                  }}>
                    {(() => {
                      // Format transcript with each speaker on a new line
                      const transcript = selectedCall.transcript || '';
                      // Split by "AI:" or "User:" and format each line
                      const formatted = transcript
                        .replace(/\b(AI|User):\s*/gi, '\n$1: ') // Add newline before each speaker label
                        .replace(/^\n/, '') // Remove leading newline
                        .trim();
                      return formatted;
                    })()}
                  </div>
                </div>
              )}
              {selectedCall.call_cost && (
                <div><strong>Cost:</strong> ${selectedCall.call_cost.toFixed(2)}</div>
              )}
              {selectedCall.call_quality_score && (
                <div><strong>Quality Score:</strong> {selectedCall.call_quality_score}/10</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={closeModals}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>Confirm Delete</h3>
            <p style={{ marginBottom: '24px', color: '#666' }}>
              Are you sure you want to delete this {deleteType}? This action cannot be undone.
            </p>
            {deleteType === 'number' && (
              <p style={{ marginBottom: '24px', fontWeight: '600' }}>
                Number: {itemToDelete.phone_number}
              </p>
            )}
            {deleteType === 'call' && (
              <p style={{ marginBottom: '24px', fontWeight: '600' }}>
                Call ID: {itemToDelete.id}
              </p>
            )}
            {deleteType === 'agent' && (
              <p style={{ marginBottom: '24px', fontWeight: '600' }}>
                Agent: {itemToDelete.name}
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModals}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
                {deleting && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent View Modal */}
      {showAgentModal && selectedAgent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={closeModals}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{selectedAgent.name} - Details</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {canEdit && (
                  <button
                    onClick={() => {
                      setShowAgentModal(false);
                      handleEditAgent(selectedAgent);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#74317e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                )}
                <button
                  onClick={closeModals}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '24px',
                    color: '#666'
                  }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div><strong>Name:</strong> {selectedAgent.name}</div>
              <div><strong>Company:</strong> {selectedAgent.company_name || '-'}</div>
              <div><strong>Status:</strong> {selectedAgent.status}</div>
              <div><strong>Agent Type:</strong> {selectedAgent.agent_type || '-'}</div>
              <div><strong>Model:</strong> {selectedAgent.model || '-'}</div>
              <div><strong>Voice:</strong> {selectedAgent.voice || '-'}</div>
              <div><strong>Tone:</strong> {selectedAgent.tone || '-'}</div>
              <div><strong>Language:</strong> {selectedAgent.language || '-'}</div>
              <div><strong>Phone Number:</strong> {selectedAgent.phone_number || '-'}</div>
              <div><strong>Phone Provider:</strong> {selectedAgent.phone_provider || '-'}</div>
              <div><strong>Execution Mode:</strong> {selectedAgent.execution_mode || '-'}</div>
              {selectedAgent.goal && <div><strong>Goal:</strong> {selectedAgent.goal}</div>}
              {selectedAgent.welcome_message && <div><strong>Welcome Message:</strong> {selectedAgent.welcome_message}</div>}
              <div><strong>Created:</strong> {new Date(selectedAgent.created_at).toLocaleString()}</div>
              {selectedAgent.updated_at && (
                <div><strong>Updated:</strong> {new Date(selectedAgent.updated_at).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent Create/Edit Modal */}
      {(showAgentCreateModal || showAgentEditModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={closeModals}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>{selectedAgent ? 'Edit' : 'Create'} Inbound Agent</h3>
              <button
                onClick={closeModals}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: '#666'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Name *</label>
                <input
                  type="text"
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="Agent Name"
                />
              </div>

              {/* User Assignment */}
              <div className="user-search-container" style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Assign to Consumer *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={userSearchTerm || selectedUserDisplay}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUserSearchTerm(value);
                      if (!value) {
                        setAgentFormData({ ...agentFormData, user_id: '' });
                        setSelectedUserDisplay('');
                      }
                      setShowUserSuggestions(true);
                    }}
                    onFocus={() => {
                      if (filteredUsers.length > 0 || userSearchTerm.length >= 2) {
                        setShowUserSuggestions(true);
                      }
                    }}
                    placeholder="Type at least 2 letters to search consumers..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  {loadingUsers && (
                    <div style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#999'
                    }}>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                </div>

                {/* User Suggestions Dropdown */}
                {showUserSuggestions && filteredUsers.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}>
                    {filteredUsers.map(user => (
                      <div
                        key={user.user_id || user.id}
                        onClick={() => {
                          setAgentFormData({ ...agentFormData, user_id: user.user_id || user.id });
                          setSelectedUserDisplay(`${user.full_name || user.email || ''} ${user.email ? `(${user.email})` : ''}`.trim());
                          setUserSearchTerm('');
                          setShowUserSuggestions(false);
                        }}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        <div style={{ fontWeight: '500' }}>{user.full_name || 'No Name'}</div>
                        {user.email && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{user.email}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showUserSuggestions && !loadingUsers && userSearchTerm.length >= 2 && filteredUsers.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    marginTop: '4px',
                    padding: '12px',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    No users found
                  </div>
                )}
              </div>

              {/* Company Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Company Name</label>
                <input
                  type="text"
                  value={agentFormData.company_name}
                  onChange={(e) => setAgentFormData({ ...agentFormData, company_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="Company Name"
                />
              </div>

              {/* Agent Type */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Agent Type</label>
                <select
                  value={agentFormData.agent_type}
                  onChange={(e) => setAgentFormData({ ...agentFormData, agent_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select Type</option>
                  <option value="sales">Sales - For sales and lead generation</option>
                  <option value="support">Support - For customer support</option>
                  <option value="booking">Booking - For appointment scheduling</option>
                  <option value="general">General - General purpose agent</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Status</label>
                <select
                  value={agentFormData.status}
                  onChange={(e) => setAgentFormData({ ...agentFormData, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="active">Active - Agent is operational</option>
                  <option value="inactive">Inactive - Agent is disabled</option>
                  <option value="testing">Testing - Agent is in testing mode</option>
                  <option value="draft">Draft - Agent is being configured</option>
                  <option value="archived">Archived - Agent is archived</option>
                </select>
              </div>

              {/* Model */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>AI Model</label>
                <select
                  value={agentFormData.model}
                  onChange={(e) => setAgentFormData({ ...agentFormData, model: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="gpt-4o">GPT-4o - Latest and most capable</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo - Fast and efficient</option>
                  <option value="gpt-4">GPT-4 - High quality responses</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo - Cost-effective</option>
                </select>
              </div>

              {/* Voice */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Voice</label>
                <input
                  type="text"
                  value={agentFormData.voice}
                  onChange={(e) => setAgentFormData({ ...agentFormData, voice: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  placeholder="aura-helena-en"
                />
              </div>

              {/* Tone */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tone</label>
                <select
                  value={agentFormData.tone}
                  onChange={(e) => setAgentFormData({ ...agentFormData, tone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="professional">Professional - Formal and business-like</option>
                  <option value="friendly">Friendly - Warm and approachable</option>
                  <option value="casual">Casual - Relaxed and informal</option>
                  <option value="empathetic">Empathetic - Understanding and caring</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Language</label>
                <select
                  value={agentFormData.language}
                  onChange={(e) => setAgentFormData({ ...agentFormData, language: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                </select>
              </div>

              {/* Goal */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Goal</label>
                <textarea
                  value={agentFormData.goal}
                  onChange={(e) => setAgentFormData({ ...agentFormData, goal: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '80px'
                  }}
                  placeholder="Agent's primary goal or objective"
                />
              </div>

              {/* Welcome Message */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Welcome Message</label>
                <textarea
                  value={agentFormData.welcome_message}
                  onChange={(e) => setAgentFormData({ ...agentFormData, welcome_message: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '80px'
                  }}
                  placeholder="Initial message when call starts"
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  onClick={closeModals}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAgent}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    background: '#74317e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {saving ? 'Saving...' : selectedAgent ? 'Update' : 'Create'}
                  {saving && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Agent Modal */}
      {showAssignModal && selectedNumber && (
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
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#111827' }}>Assign Agent to {selectedNumber.phone_label || selectedNumber.phone_number}</h4>
              <button onClick={() => setShowAssignModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
                Select Agent
              </label>
              <select
                value={formData.assigned_to_agent_id || ''}
                onChange={(e) => setFormData({ ...formData, assigned_to_agent_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Unassigned (None)</option>
                {availableAgents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} {agent.company_name ? `(${agent.company_name})` : ''}
                  </option>
                ))}
              </select>
              <p style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                The selected agent will handle all incoming calls to this number.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={assigningLoading}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#74317e',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: assigningLoading ? 'not-allowed' : 'pointer',
                  opacity: assigningLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {assigningLoading ? 'Assigning...' : 'Confirm Assignment'}
                {assigningLoading && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default InboundGenie;
