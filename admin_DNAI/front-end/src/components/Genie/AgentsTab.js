import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Bot, Eye, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, X, ArrowUp, ArrowDown, Filter, User } from 'lucide-react';
import { getAllBots } from 'api/backend/genie';
import { usePermissions } from 'hooks/usePermissions';
import toast from 'react-hot-toast';
import BotDetailsModal from '../ConsumerGenie/BotDetailsModal';
import { supabase } from '../../lib/supabase/Production/client';

function AgentsTab() {
  const history = useHistory();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('genie.agents.view') || hasPermission('genie.bots.view');

  // Get initial page from URL
  const getInitialPage = () => {
    const params = new URLSearchParams(location.search);
    const pageFromUrl = parseInt(params.get('page'), 10);
    return pageFromUrl && pageFromUrl > 0 ? pageFromUrl : 1;
  };

  // State
  const [allAgents, setAllAgents] = useState([]); // Store all agents before filtering
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [ownerSearchInput, setOwnerSearchInput] = useState(''); // Owner search input
  const [ownerSearchQuery, setOwnerSearchQuery] = useState(''); // Owner search query
  const [ownerProfiles, setOwnerProfiles] = useState(new Map()); // Map of owner_user_id to profile

  // Pagination
  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Update URL with current page
  const updateUrlWithPage = useCallback((page) => {
    const params = new URLSearchParams(location.search);
    if (page > 1) {
      params.set('page', page.toString());
    } else {
      params.delete('page'); // Remove page param if it's page 1
    }
    history.push({ pathname: location.pathname, search: params.toString() });
  }, [history, location.pathname, location.search]);

  // Sync page from URL when browser back/forward is used
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pageFromUrl = parseInt(params.get('page'), 10);
    const validPage = pageFromUrl && pageFromUrl > 0 ? pageFromUrl : 1;

    if (validPage !== currentPage) {
      setCurrentPage(validPage);
    }
  }, [location.search]);

  // Track which owner IDs we've already fetched
  const fetchedOwnerIdsRef = useRef(new Set());

  // Fetch owner profiles when agents are loaded (only once per unique owner IDs)
  useEffect(() => {
    const fetchOwnerProfiles = async () => {
      if (allAgents.length === 0) return;

      // Extract unique owner_user_ids
      const ownerIds = Array.from(new Set(
        allAgents
          .map(agent => agent.owner_user_id)
          .filter(Boolean)
      ));

      if (ownerIds.length === 0) return;

      // Find missing owner IDs that we haven't fetched yet
      const missingIds = ownerIds.filter(id => !fetchedOwnerIdsRef.current.has(id));

      if (missingIds.length === 0) return; // All profiles already loaded or being loaded

      // Mark these IDs as being fetched
      missingIds.forEach(id => fetchedOwnerIdsRef.current.add(id));

      try {
        // Fetch user profiles from auth_role_with_profiles view
        const { data: profiles, error } = await supabase
          .from('auth_role_with_profiles')
          .select('user_id, full_name, email')
          .in('user_id', missingIds);

        if (error) {
          console.error('Error fetching owner profiles:', error);
          // Remove from fetched set so we can retry later
          missingIds.forEach(id => fetchedOwnerIdsRef.current.delete(id));
          return;
        }

        // Update the map with new profiles
        setOwnerProfiles(prev => {
          const updated = new Map(prev);
          (profiles || []).forEach(profile => {
            updated.set(profile.user_id, {
              id: profile.user_id,
              name: profile.full_name || 'Unknown',
              email: profile.email || ''
            });
          });
          return updated;
        });
      } catch (error) {
        console.error('Error fetching owner profiles:', error);
        // Remove from fetched set so we can retry later
        missingIds.forEach(id => fetchedOwnerIdsRef.current.delete(id));
      }
    };

    fetchOwnerProfiles();
  }, [allAgents.length]); // Only depend on length, not the entire array

  // Fetch agents - separate API call from filtering
  // Use useCallback with empty deps to ensure it only gets created once
  const fetchAgentsFromAPI = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllBots();
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      const agentsData = response?.data || [];
      setAllAgents(agentsData); // Store all agents for owner extraction
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch genie agents');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter and paginate agents based on filters
  useEffect(() => {
    if (allAgents.length === 0) {
      setAgents([]);
      setTotalCount(0);
      setTotalPages(1);
      return;
    }

    let filteredData = [...allAgents]; // Work with a copy

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredData = filteredData.filter(agent =>
        agent.name?.toLowerCase().includes(query) ||
        agent.company_name?.toLowerCase().includes(query) ||
        agent.goal?.toLowerCase().includes(query) ||
        agent.website_url?.toLowerCase().includes(query)
      );
    }

    // Apply owner filter by name or email
    if (ownerSearchQuery) {
      const query = ownerSearchQuery.toLowerCase();
      filteredData = filteredData.filter(agent => {
        const ownerId = agent.owner_user_id;
        if (!ownerId) return false;

        // If owner profiles are loaded, use them for filtering
        if (ownerProfiles.size > 0) {
          const owner = ownerProfiles.get(ownerId);
          if (!owner) return false;

          const ownerName = (owner.name || '').toLowerCase();
          const ownerEmail = (owner.email || '').toLowerCase();

          return ownerName.includes(query) || ownerEmail.includes(query);
        }

        // If profiles not loaded yet, allow filtering by owner_user_id (partial match)
        // This provides immediate feedback while profiles are loading
        return ownerId.toLowerCase().includes(query);
      });
    }

    // Sort by created_at
    filteredData.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Calculate pagination
    const total = filteredData.length;
    const totalPagesCalc = Math.ceil(total / limit);
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    setAgents(paginatedData);
    setTotalCount(total);
    setTotalPages(totalPagesCalc);
  }, [allAgents, searchQuery, ownerSearchQuery, sortOrder, currentPage, ownerProfiles, limit]);

  // Initial fetch only once on mount
  useEffect(() => {
    fetchAgentsFromAPI();
  }, [fetchAgentsFromAPI]); // Only run when fetchAgentsFromAPI changes (which is never due to empty deps)

  // Handle search
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1); // Reset to first page on search
    updateUrlWithPage(1);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
    updateUrlWithPage(1);
  };

  // Handle sort toggle
  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setCurrentPage(1);
    updateUrlWithPage(1);
  };

  // Handle owner search
  const handleOwnerSearch = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOwnerSearchQuery(ownerSearchInput);
    setCurrentPage(1);
    updateUrlWithPage(1);
  };

  // Handle clear owner search
  const handleClearOwnerSearch = () => {
    setOwnerSearchInput('');
    setOwnerSearchQuery('');
    setCurrentPage(1);
    updateUrlWithPage(1);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
    updateUrlWithPage(page);
  };

  // Handle view agent
  const handleViewAgent = (agent) => {
    setSelectedAgent(agent);
    setShowModal(true);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!canRead) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        border: '1px dashed #dee2e6'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <X size={24} color="#dc3545" />
        </div>
        <h4 style={{ margin: '0 0 12px 0', color: '#333', fontWeight: '600' }}>Access Denied</h4>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>You don't have permission to view Genie Agents.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Stats */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', opacity: 0.9 }}>Total Genie Agents</p>
            <h2 style={{ margin: 0, fontSize: '36px', fontWeight: '700' }}>{totalCount}</h2>
          </div>
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6c757d'
            }} />
            <input
              type="text"
              placeholder="Search agents by name, company, goal, or website..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%',
                padding: '12px 16px 12px 40px',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#74317e'}
              onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} color="#6c757d" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            style={{
              padding: '12px 24px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a2770'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#74317e'}
          >
            <Search size={16} />
            Search
          </button>
          <button
            onClick={fetchAgentsFromAPI}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#74317e',
              border: '1px solid #74317e',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Secondary Filters Row */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sort by Created Date */}
          <button
            onClick={handleSortToggle}
            style={{
              padding: '12px 20px',
              backgroundColor: 'white',
              color: '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#74317e';
              e.currentTarget.style.color = '#74317e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#dee2e6';
              e.currentTarget.style.color = '#495057';
            }}
          >
            {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            Sort: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
          </button>

          {/* Owner Search Filter */}
          <div style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
            <User size={18} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6c757d'
            }} />
            <input
              type="text"
              placeholder="Filter by owner name or email..."
              value={ownerSearchInput}
              onChange={(e) => setOwnerSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleOwnerSearch()}
              style={{
                width: '100%',
                padding: '12px 16px 12px 40px',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#74317e'}
              onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
            />
            {ownerSearchInput && (
              <button
                onClick={handleClearOwnerSearch}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} color="#6c757d" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleOwnerSearch}
            style={{
              padding: '12px 20px',
              backgroundColor: ownerSearchQuery ? '#74317e' : 'white',
              color: ownerSearchQuery ? 'white' : '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}
            onMouseEnter={(e) => {
              if (!ownerSearchQuery) {
                e.currentTarget.style.borderColor = '#74317e';
                e.currentTarget.style.color = '#74317e';
              }
            }}
            onMouseLeave={(e) => {
              if (!ownerSearchQuery) {
                e.currentTarget.style.borderColor = '#dee2e6';
                e.currentTarget.style.color = '#495057';
              }
            }}
          >
            <Search size={16} />

          </button>
        </div>
      </div>

      {/* Agents Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #74317e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '16px', color: '#6c757d', fontSize: '14px' }}>Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '1px dashed #dee2e6'
        }}>
          <Bot size={48} color="#adb5bd" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>
            {searchQuery ? 'No agents found matching your search' : 'No Genie agents created yet'}
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Company</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Owner</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Goal</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Voice</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Language</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Model</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Agent Type</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Created
                      <button
                        onClick={handleSortToggle}
                        style={{
                          padding: '4px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#495057'
                        }}
                        title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                      >
                        {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      </button>
                    </div>
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#495057', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, index) => (
                  <tr
                    key={agent.id}
                    style={{
                      borderBottom: index < agents.length - 1 ? '1px solid #f0f0f0' : 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontWeight: '500', color: '#333' }}>{agent.name || '-'}</td>
                    <td style={{ padding: '16px', color: '#666' }}>{agent.company_name || '-'}</td>
                    <td style={{ padding: '16px', color: '#666' }}>
                      {(() => {
                        const ownerId = agent.owner_user_id;
                        if (!ownerId) return '-';
                        const owner = ownerProfiles.get(ownerId);
                        if (!owner) return `User ${ownerId.substring(0, 8)}...`;
                        return (
                          <div>
                            <div style={{ fontWeight: '500' }}>{owner.name}</div>
                            {owner.email && (
                              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                                {owner.email}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{
                      padding: '16px',
                      color: '#666',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{agent.goal || '-'}</td>
                    <td style={{ padding: '16px', color: '#666' }}>{agent.voice || '-'}</td>
                    <td style={{ padding: '16px', color: '#666' }}>{agent.language || '-'}</td>
                    <td style={{ padding: '16px', color: '#666' }}>{agent.model || '-'}</td>
                    <td style={{ padding: '16px', color: '#666' }}>{agent.agent_type || '-'}</td>
                    <td style={{ padding: '16px', color: '#666', fontSize: '13px' }}>{formatDate(agent.created_at)}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleViewAgent(agent)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#74317e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a2770'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#74317e'}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '20px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} agents
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: currentPage === 1 ? '#f8f9fa' : 'white',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: currentPage === 1 ? '#f8f9fa' : 'white',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ padding: '0 12px', fontSize: '14px', color: '#495057' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: currentPage === totalPages ? '#f8f9fa' : 'white',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: currentPage === totalPages ? '#f8f9fa' : 'white',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Details Modal */}
      {showModal && selectedAgent && (
        <BotDetailsModal
          bot={selectedAgent}
          show={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedAgent(null);
          }}
        />
      )}

      {/* Styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AgentsTab;

