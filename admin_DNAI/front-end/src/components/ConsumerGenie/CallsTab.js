import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, Download, ChevronLeft, ChevronRight, Eye, MoreVertical, Filter, X, ChevronDown, Search, Clock, Calendar, Bot } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';
import CallDetailModal from './CallDetailModal';

function CallsTab({ consumerId }) {
  const [calls, setCalls] = useState([]);
  const [allCalls, setAllCalls] = useState([]); // Store all calls for frontend filtering
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bots, setBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    botId: '',
    status: '',
    startDate: '',
    endDate: '',
    search: '',
    minDuration: '',
    maxDuration: ''
  });
  
  const limit = 10;
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    fetchBots();
  }, [consumerId]);

  const applyFrontendFilters = () => {
    if (!allCalls || allCalls.length === 0) {
      setCalls([]);
      setTotalCount(0);
      setTotalPages(1);
      return;
    }

    let filtered = [...allCalls];
    
    // Filter by duration (frontend only)
    if (filters.minDuration) {
      const minSeconds = parseFloat(filters.minDuration) * 60;
      filtered = filtered.filter(call => {
        const callSeconds = (call.duration || 0) * 60;
        return callSeconds >= minSeconds;
      });
    }
    
    if (filters.maxDuration) {
      const maxSeconds = parseFloat(filters.maxDuration) * 60;
      filtered = filtered.filter(call => {
        const callSeconds = (call.duration || 0) * 60;
        return callSeconds <= maxSeconds;
      });
    }
    
    // Update pagination based on filtered results
    const filteredTotal = filtered.length;
    const filteredPages = Math.ceil(filteredTotal / limit) || 1;
    const startIndex = (currentPage - 1) * limit;
    const paginatedCalls = filtered.slice(startIndex, startIndex + limit);
    
    setCalls(paginatedCalls);
    setTotalCount(filteredTotal);
    setTotalPages(filteredPages);
  };

  useEffect(() => {
    fetchCalls();
  }, [consumerId, currentPage, filters.botId, filters.status, filters.startDate, filters.endDate, filters.search]);

  useEffect(() => {
    // Apply frontend filters (duration) to allCalls
    if (filters.minDuration || filters.maxDuration) {
      applyFrontendFilters();
    }
  }, [allCalls, filters.minDuration, filters.maxDuration, currentPage]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        // Keep filter panel open on outside click - user might want to keep it open
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchBots = async () => {
    setLoadingBots(true);
    try {
      const response = await apiClient.genie.getAllBots({ ownerUserId: consumerId });
      if (response?.success) {
        setBots(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching bots:', error);
    } finally {
      setLoadingBots(false);
    }
  };

  const fetchCalls = async () => {
    setLoading(true);
    try {
      console.log('📞 Fetching calls for consumer:', consumerId, 'with filters:', filters);
      const params = {
        page: currentPage,
        limit: (filters.minDuration || filters.maxDuration) ? 10000 : limit // Get all for frontend filtering if duration filters exist
      };
      
      if (filters.botId) params.botId = filters.botId;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.search) params.search = filters.search;
      
      const response = await apiClient.genie.getAllCallsByOwnerId(consumerId, params);
      console.log('📞 Calls response:', response);
      if (response?.data) {
        setAllCalls(response.data || []);
        // If no duration filters, use backend pagination
        if (!filters.minDuration && !filters.maxDuration) {
          setCalls(response.data || []);
          setTotalCount(response.total || 0);
          setTotalPages(response.totalPages || 1);
        } else {
          // Frontend filtering will handle pagination
          applyFrontendFilters();
        }
        console.log(`📞 Loaded ${response.data.length} calls for consumer ${consumerId}`);
      } else {
        toast.error('Failed to fetch calls');
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast.error('Failed to fetch calls');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const clearFilters = () => {
    setFilters({
      botId: '',
      status: '',
      startDate: '',
      endDate: '',
      search: '',
      minDuration: '',
      maxDuration: ''
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== '');
  };

  const handleViewDetails = (callId) => {
    setSelectedCallId(callId);
    setShowCallModal(true);
    setOpenDropdown(null);
  };

  const handleDownloadCalls = async () => {
    setDownloading(true);
    try {
      // Fetch all calls for export with current filters
      const params = {
        page: 1,
        limit: 10000 // Get all calls
      };
      
      if (filters.botId) params.botId = filters.botId;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.search) params.search = filters.search;

      const response = await apiClient.genie.getAllCallsByOwnerId(consumerId, params);

      if (!response?.data || response.data.length === 0) {
        toast.error('No calls to export');
        return;
      }

      // Apply frontend duration filters if any
      let exportCalls = response.data;
      if (filters.minDuration) {
        const minSeconds = parseFloat(filters.minDuration) * 60;
        exportCalls = exportCalls.filter(call => {
          const callSeconds = (call.duration || 0) * 60;
          return callSeconds >= minSeconds;
        });
      }
      if (filters.maxDuration) {
        const maxSeconds = parseFloat(filters.maxDuration) * 60;
        exportCalls = exportCalls.filter(call => {
          const callSeconds = (call.duration || 0) * 60;
          return callSeconds <= maxSeconds;
        });
      }

      if (exportCalls.length === 0) {
        toast.error('No calls match the current filters');
        return;
      }

      // Create CSV content
      const headers = ['Name', 'Phone', 'Call Status', 'Duration', 'Started At', 'Bot Name'];
      const rows = exportCalls.map(call => [
        call.name || '',
        call.phone || '',
        call.call_status || '',
        formatDuration(call.duration),
        call.started_at ? new Date(call.started_at).toLocaleString() : '',
        call.genie_bots?.name || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `calls-${consumerId}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${exportCalls.length} call(s) successfully`);
    } catch (error) {
      console.error('Error exporting calls:', error);
      toast.error('Failed to export calls');
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (decimalMinutes) => {
    if (!decimalMinutes) return '0:00';
    const totalSeconds = Math.round(decimalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      in_progress: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      failed: { bg: '#fee2e2', color: '#991b1b' }
    };
    const style = styles[status] || { bg: '#f3f4f6', color: '#374151' };
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {status || '-'}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #74317e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
        <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading calls...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header with Download Button and Filter Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
            Call Logs ({totalCount})
          </h4>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '10px 20px',
              backgroundColor: showFilters ? '#74317e' : 'white',
              color: showFilters ? 'white' : '#74317e',
              border: '1px solid #74317e',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              position: 'relative'
            }}
          >
            <Filter size={18} />
            Filters
            {hasActiveFilters() && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600'
              }}>
                {Object.values(filters).filter(v => v !== '').length}
              </span>
            )}
          </button>
          <button
            onClick={handleDownloadCalls}
            disabled={downloading || totalCount === 0}
            style={{
              padding: '10px 20px',
              backgroundColor: downloading || totalCount === 0 ? '#ccc' : '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: downloading || totalCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={18} />
            {downloading ? 'Exporting...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div ref={filterDropdownRef} style={{
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}>
            {/* Bot Filter */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                <Bot size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Bot
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={filters.botId}
                  onChange={(e) => handleFilterChange('botId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    color: '#495057',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">All Bots</option>
                  {bots.map(bot => (
                    <option key={bot.id} value={bot.id}>{bot.name || 'Unnamed Bot'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#495057',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Start Date
              </label>
              <input
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#495057',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
            </div>

            {/* End Date */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                End Date
              </label>
              <input
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#495057',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
            </div>

            {/* Min Duration */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Min Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={filters.minDuration}
                onChange={(e) => handleFilterChange('minDuration', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#495057',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
            </div>

            {/* Max Duration */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Max Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={filters.maxDuration}
                onChange={(e) => handleFilterChange('maxDuration', e.target.value)}
                placeholder="No limit"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#495057',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
            </div>

            {/* Search */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}>
                <Search size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                Search (Name/Phone)
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name or phone..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#495057',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters() && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={clearFilters}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: '#74317e',
                  border: '1px solid #74317e',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <X size={16} />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calls Table - Responsive */}
      {calls.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '1px dashed #dee2e6'
        }}>
          <PhoneCall size={48} color="#adb5bd" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>No calls found</p>
        </div>
      ) : (
        <>
          <div style={{ 
            width: '100%', 
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <div style={{ minWidth: '800px' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>Contact</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>Bot</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>Duration</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb' }}>Started At</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e5e7eb', width: '50px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
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
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b', fontSize: '14px', marginBottom: '4px' }}>{call.name || '-'}</div>
                          <div style={{ color: '#64748b', fontSize: '13px' }}>{call.phone || '-'}</div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                        {call.genie_bots?.name || '-'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {getStatusBadge(call.call_status)}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '500', fontSize: '14px', color: '#1e293b' }}>
                        {formatDuration(call.duration)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                        {formatDate(call.started_at)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', position: 'relative' }}>
                        <div className="dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={() => setOpenDropdown(openDropdown === call.id ? null : call.id)}
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
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openDropdown === call.id && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '8px',
                              backgroundColor: 'white',
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              zIndex: 100,
                              minWidth: '160px'
                            }}>
                              <button
                                onClick={() => handleViewDetails(call.id)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: '#333',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Eye size={16} /> View Details
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
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
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} calls
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px'
                  }}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: currentPage >= totalPages ? '#f3f4f6' : 'white',
                    color: currentPage >= totalPages ? '#9ca3af' : '#374151',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px'
                  }}
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Call Detail Modal */}
      <CallDetailModal
        callId={selectedCallId}
        isOpen={showCallModal}
        onClose={() => {
          setShowCallModal(false);
          setSelectedCallId(null);
        }}
      />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default CallsTab;
