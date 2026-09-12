import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Star, Search, RefreshCw, X, Download, MoreVertical, Eye, Play, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getAllLeads, deleteLead, exportLeads, getAllBots } from "api/backend/genie";
import { usePermissions } from "hooks/usePermissions";
import { useGenieWebSocket } from "hooks/useGenieWebSocket";
import ConfirmationModal from "../ui/ConfirmationModal";
import toast from "react-hot-toast";

function LeadsTab() {
  const history = useHistory();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const { lastLeadEvent } = useGenieWebSocket();

  // Get initial page from URL
  const getInitialPage = () => {
    const params = new URLSearchParams(location.search);
    const pageFromUrl = parseInt(params.get('page'), 10);
    return pageFromUrl && pageFromUrl > 0 ? pageFromUrl : 1;
  };

  // State
  const [leads, setLeads] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Calculate default dates (last 2 days)
  const getDefaultDates = () => {
    const today = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      start: formatDate(twoDaysAgo),
      end: formatDate(today)
    };
  };

  const defaultDates = getDefaultDates();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBot, setSelectedBot] = useState("");
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);

  // Pagination
  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

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

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPositions, setDropdownPositions] = useState({}); // Store position for each dropdown
  const dropdownButtonRefs = useRef({});

  // Function to check if dropdown should open upward
  const checkDropdownPosition = (leadId, buttonElement, isLastRow = false) => {
    if (!buttonElement) return 'bottom';

    // Force upward for last row
    if (isLastRow) return 'top';

    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 200; // Approximate dropdown height

    // Check if we're in the last few rows (within last 40% of viewport)
    const isNearBottom = rect.bottom > viewportHeight * 0.6;

    // If near bottom or not enough space below but enough space above, open upward
    if (isNearBottom || (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight)) {
      return 'top';
    }
    return 'bottom';
  };

  // Handle dropdown toggle with position check
  const handleDropdownToggle = (leadId, buttonElement, isLastRow = false) => {
    if (openDropdown === leadId) {
      setOpenDropdown(null);
    } else {
      const position = checkDropdownPosition(leadId, buttonElement, isLastRow);
      setDropdownPositions(prev => ({ ...prev, [leadId]: position }));
      setOpenDropdown(leadId);
    }
  };

  // Permissions
  const canRead = hasPermission('genie.leads.read');
  const canDelete = hasPermission('genie.leads.delete');
  const canExport = hasPermission('genie.leads.export');

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit,
        search: searchQuery || undefined,
        botId: selectedBot || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const response = await getAllLeads(params);
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      setLeads(response?.data || []);
      setTotalCount(response?.total || 0);
      setTotalPages(response?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, selectedBot, startDate, endDate]);

  // Fetch bots for filter
  const fetchBots = useCallback(async () => {
    try {
      const response = await getAllBots();
      if (!response?.error) {
        setBots(response?.data || []);
      }
    } catch (error) {
      console.error("Error fetching bots:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Real-time updates
  useEffect(() => {
    if (lastLeadEvent) {
      fetchLeads();
    }
  }, [lastLeadEvent]);

  // Open delete modal
  const openDeleteModal = (lead) => {
    if (!canDelete) {
      toast.error("You don't have permission to delete leads");
      return;
    }
    setSelectedLead(lead);
    setIsDeleteModalOpen(true);
    setOpenDropdown(null);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedLead(null);
  };

  // Confirm delete lead
  const confirmDeleteLead = async () => {
    if (!selectedLead?.id) return;

    setDeleteLoading(true);
    try {
      const response = await deleteLead(selectedLead.id);
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      toast.success("Lead deleted successfully");
      fetchLeads();
      closeDeleteModal();
    } catch (error) {
      toast.error("Failed to delete lead");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    if (!canExport) {
      toast.error("You don't have permission to export leads");
      return;
    }

    setExporting(true);
    try {
      const params = {
        botId: selectedBot || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const response = await exportLeads(params);

      console.log('Export response:', {
        hasError: !!response?.error,
        dataType: typeof response?.data,
        isBlob: response?.data instanceof Blob,
        dataSize: response?.data?.size || response?.data?.length
      });

      if (response?.error) {
        toast.error(response.error);
        return;
      }

      // Handle both Blob and string responses
      let blob;
      if (response.data instanceof Blob) {
        blob = response.data;
      } else if (typeof response.data === 'string') {
        blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      } else if (response.data) {
        // Try to convert whatever we got to a blob
        blob = new Blob([JSON.stringify(response.data)], { type: 'text/csv;charset=utf-8' });
      } else {
        toast.error("No data received from server");
        return;
      }

      // Check if blob has content (more than just headers ~50 bytes)
      if (blob.size < 50) {
        toast.error("No leads to export");
        return;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success("Leads exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export leads");
    } finally {
      setExporting(false);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    updateUrlWithPage(1);
    fetchLeads();
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBot("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
    updateUrlWithPage(1);
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
            <Star size={20} style={{ color: '#74317e' }} />
            Leads
          </h5>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            {totalCount} leads captured from calls
          </p>
        </div>
        {canExport && (
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export CSV
              </>
            )}
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Search</label>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: '0 1 150px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Bot</label>
              <select
                value={selectedBot}
                onChange={(e) => { setSelectedBot(e.target.value); setCurrentPage(1); updateUrlWithPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Bots</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}{bot.owner_name ? ` -    (${bot.owner_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: '0 1 150px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); updateUrlWithPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ flex: '0 1 150px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); updateUrlWithPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={14} /> Clear
              </button>
              <button
                type="button"
                onClick={fetchLeads}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#74317e',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Leads Table */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
            <div style={{ width: '48px', height: '48px', border: '3px solid #f1f5f9', borderTopColor: '#74317e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', color: '#94a3b8' }}>
              <Star size={32} />
            </div>
            <h5 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: '600' }}>No leads found</h5>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Leads will appear here when calls are marked as leads</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Contact</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Owner</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Bot</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Summary</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => {
                    const isLastRow = index === leads.length - 1;
                    return (
                      <tr
                        key={lead.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                          {lead.email || "-"}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                          {lead.genie_bots?.name || "-"}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                          {truncateText(lead.summary, 40)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                          {formatDate(lead.created_at)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', position: 'relative' }}>
                          <button
                            ref={(el) => {
                              if (el) dropdownButtonRefs.current[lead.id] = el;
                            }}
                            onClick={(e) => handleDropdownToggle(lead.id, e.currentTarget, isLastRow)}
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
                          {openDropdown === lead.id && (() => {
                            const isTop = dropdownPositions[lead.id] === 'top';
                            return (
                              <div style={{
                                position: 'absolute',
                                right: '16px',
                                ...(isTop ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
                                backgroundColor: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 9999,
                                minWidth: '160px'
                              }}>
                                {canRead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setOpenDropdown(null);
                                      setTimeout(() => {
                                        history.push(`/admin/genie/leads/${lead.id}`);
                                      }, 0);
                                    }}
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
                                )}
                                {lead.recording_url && (
                                  <a
                                    href={lead.recording_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '10px 16px',
                                      textDecoration: 'none',
                                      fontSize: '14px',
                                      color: '#333'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Play size={16} /> Play Recording
                                  </a>
                                )}
                                {canDelete && (
                                  <>
                                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
                                    <button
                                      onClick={() => openDeleteModal(lead)}
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
                                      <Trash2 size={16} /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>
                Showing {leads.length} of {totalCount} leads (Page {currentPage} of {totalPages})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => { setCurrentPage(1); updateUrlWithPage(1); }}
                  disabled={currentPage <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage <= 1 ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => { const newPage = Math.max(1, currentPage - 1); setCurrentPage(newPage); updateUrlWithPage(newPage); }}
                  disabled={currentPage <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage <= 1 ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages = [];
                  const maxVisible = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => { setCurrentPage(1); updateUrlWithPage(1); }}
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: 'white',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px'
                        }}
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="ellipsis1" style={{ padding: '0 4px', color: '#64748b' }}>...</span>
                      );
                    }
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => { setCurrentPage(i); updateUrlWithPage(i); }}
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: i === currentPage ? 'none' : '1px solid #e2e8f0',
                          backgroundColor: i === currentPage ? '#74317e' : 'white',
                          color: i === currentPage ? 'white' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: i === currentPage ? '600' : '500',
                          fontSize: '14px'
                        }}
                      >
                        {i}
                      </button>
                    );
                  }

                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key="ellipsis2" style={{ padding: '0 4px', color: '#64748b' }}>...</span>
                      );
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => { setCurrentPage(totalPages); updateUrlWithPage(totalPages); }}
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: 'white',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px'
                        }}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}

                <button
                  onClick={() => { const newPage = Math.min(totalPages, currentPage + 1); setCurrentPage(newPage); updateUrlWithPage(newPage); }}
                  disabled={currentPage >= totalPages || totalPages <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage >= totalPages ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => { setCurrentPage(totalPages); updateUrlWithPage(totalPages); }}
                  disabled={currentPage >= totalPages || totalPages <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage >= totalPages ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteLead}
        title="Delete Lead"
        message="Are you sure you want to delete this lead?"
        warningText="This action cannot be undone. The lead record will be permanently deleted."
        itemName={selectedLead?.name || "Lead"}
        itemId={selectedLead?.id}
        consequences={[
          "Delete lead contact info",
          "Remove call transcript",
          "Delete all associated data"
        ]}
        confirmText="Yes, Delete Lead"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteLoading}
        loadingText="Deleting..."
      />

      {/* Click outside to close dropdown */}
      {openDropdown && (
        <div
          onClick={() => setOpenDropdown(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
        />
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LeadsTab;

