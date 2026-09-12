import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button } from 'react-bootstrap';
import { Plus, Edit2, Trash2, Search, Tag, Calendar, DollarSign, Filter, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { checkUserPermissionsBulk } from '../api/backend/permissions';
import { useHistory } from 'react-router-dom';

const Offers = () => {
  const history = useHistory();
  const { isAdmin, user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, upcoming, expired, inactive
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOfferData, setDeleteOfferData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const offersPerPage = 10;
  const [permissions, setPermissions] = useState({
    create: false, // Start as false, update after checking
    delete: false,
    update: false,
    read: false,
  });
  const [hasViewPermission, setHasViewPermission] = useState(false); // Start as false
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true); // Track permission checking state

  // Fetch offers
  const fetchOffers = async () => {
    if (!isAdmin) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      queryParams.append('page', currentPage);
      queryParams.append('limit', offersPerPage);
      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }
      
      const response = await apiClient.offers.getAll(`?${queryParams.toString()}`);
      
      if (response && response.success && response.data) {
        setOffers(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || 0);
      } else {
        setError('Failed to load offers');
        toast.error('Failed to load offers');
      }
    } catch (err) {
      console.error('Error fetching offers:', err);
      setError('Failed to load offers');
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  // Check offers.view permission first (required to access the page)
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
    const hasViewPerm = hasPermission('offers.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
    
    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view offers.');
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
      setPermissions({ create: true, delete: true, update: true, read: true });
      setCheckingPermissions(false);
      return;
    }

    // Use permissions hook to check all permissions (already fetched, no API calls)
    try {

        // Use permissions hook to check all permissions (already fetched, no API calls)
        setPermissions({
          create: hasPermission('offers.create'),
          delete: hasPermission('offers.delete'),
          update: hasPermission('offers.update'),
          read: hasPermission('offers.read')
        });
    } catch (error) {
      console.error('Error checking offer permissions:', error);
      setPermissions({ create: false, delete: false, update: false, read: false });
    } finally {
      setCheckingPermissions(false);
    }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch offers (only if user has view permission)
  useEffect(() => {
    // Don't fetch if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission || !isAdmin) {
      return;
    }

    fetchOffers();
  }, [isAdmin, currentPage, statusFilter, checkingViewPermission, hasViewPermission]);

  // Handle create offer
  const handleCreateOffer = async (offerData) => {
    // Check permission before creating
    if (!permissions.create) {
      toast.error('You do not have permission to create offers.');
      setShowCreateModal(false);
      return;
    }

    try {
      const response = await apiClient.offers.create(offerData);
      if (response && response.success) {
        toast.success('Offer created successfully!');
        await fetchOffers();
        setShowCreateModal(false);
      } else {
        toast.error(response?.message || 'Failed to create offer');
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      toast.error(error.response?.data?.message || 'Failed to create offer');
    }
  };

  // Handle update offer
  const handleUpdateOffer = async (offerData) => {
    // Check permission before updating
    if (!permissions.update) {
      toast.error('You do not have permission to update offers.');
      setShowUpdateModal(false);
      setSelectedOffer(null);
      return;
    }

    try {
      const response = await apiClient.offers.update(selectedOffer.id, offerData);
      if (response && response.success) {
        toast.success('Offer updated successfully!');
        await fetchOffers();
        setShowUpdateModal(false);
        setSelectedOffer(null);
      } else {
        toast.error(response?.message || 'Failed to update offer');
      }
    } catch (error) {
      console.error('Error updating offer:', error);
      toast.error(error.response?.data?.message || 'Failed to update offer');
    }
  };

  // Handle delete offer
  const handleDeleteClick = (offer) => {
    // Check permission before showing delete confirmation
    if (!permissions.delete) {
      toast.error('You do not have permission to delete offers.');
      return;
    }

    setDeleteOfferData(offer);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteOfferData) return;

    // Check permission before deletion
    if (!permissions.delete) {
      toast.error('You do not have permission to delete offers.');
      setShowDeleteConfirm(false);
      setDeleteOfferData(null);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await apiClient.offers.delete(deleteOfferData.id);
      if (response && response.success) {
        toast.success('Offer deleted successfully!');
        await fetchOffers();
        setShowDeleteConfirm(false);
        setDeleteOfferData(null);
      } else {
        toast.error(response?.message || 'Failed to delete offer');
      }
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast.error(error.response?.data?.message || 'Failed to delete offer');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle edit click
  const handleEditClick = (offer) => {
    // Check permission before editing
    if (!permissions.update) {
      toast.error('You do not have permission to update offers.');
      return;
    }

    setSelectedOffer(offer);
    setShowUpdateModal(true);
  };

  // Get offer status
  const getOfferStatus = (offer) => {
    if (!offer.isActive) return 'inactive';
    
    const now = new Date();
    const startDate = new Date(offer.startDate);
    const endDate = new Date(offer.endDate);
    
    if (now < startDate) return 'upcoming';
    if (now > endDate) return 'expired';
    return 'active';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter offers by search
  const filteredOffers = offers.filter(offer =>
    offer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading while checking permission
  if (checkingViewPermission) {
    return (
      <Container fluid>
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
      </Container>
    );
  }

  // Show access denied if no permission
  if (!hasViewPermission) {
    return (
      <Container fluid>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3>Access Denied</h3>
          <p>You do not have permission to view offers.</p>
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
      </Container>
    );
  }

  // Create Offer Modal Component
  const CreateOfferModal = ({ isOpen, onClose, onCreate }) => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      commissionPercentage: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!formData.name || !formData.commissionPercentage || !formData.startDate || !formData.endDate) {
        toast.error('Please fill in all required fields');
        return;
      }

      setIsSubmitting(true);
      try {
        await onCreate(formData);
        setFormData({
          name: '',
          description: '',
          commissionPercentage: '',
          startDate: '',
          endDate: '',
          isActive: true
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h5 style={{ margin: 0, fontWeight: '600' }}>Create New Offer</h5>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Offer Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Enter offer name"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="Enter offer description"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Commission Percentage <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.commissionPercentage}
                onChange={(e) => setFormData({ ...formData, commissionPercentage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Enter commission percentage (e.g., 15.5)"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Start Date <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                End Date <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#74317e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: isSubmitting ? 0.6 : 1
                }}
              >
                {isSubmitting ? 'Creating...' : 'Create Offer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Update Offer Modal Component
  const UpdateOfferModal = ({ isOpen, onClose, onUpdate, offer }) => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      commissionPercentage: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
      if (offer) {
        // Convert dates to datetime-local format
        const startDate = offer.startDate ? new Date(offer.startDate).toISOString().slice(0, 16) : '';
        const endDate = offer.endDate ? new Date(offer.endDate).toISOString().slice(0, 16) : '';
        
        setFormData({
          name: offer.name || '',
          description: offer.description || '',
          commissionPercentage: offer.commissionPercentage || '',
          startDate: startDate,
          endDate: endDate,
          isActive: offer.isActive !== undefined ? offer.isActive : true
        });
      }
    }, [offer]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!formData.name || !formData.commissionPercentage || !formData.startDate || !formData.endDate) {
        toast.error('Please fill in all required fields');
        return;
      }

      setIsSubmitting(true);
      try {
        await onUpdate(formData);
      } catch (error) {
        console.error('Error updating offer:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!isOpen || !offer) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h5 style={{ margin: 0, fontWeight: '600' }}>Update Offer</h5>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Offer Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Enter offer name"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="Enter offer description"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Commission Percentage <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.commissionPercentage}
                onChange={(e) => setFormData({ ...formData, commissionPercentage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Enter commission percentage (e.g., 15.5)"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Start Date <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                End Date <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#74317e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: isSubmitting ? 0.6 : 1
                }}
              >
                {isSubmitting ? 'Updating...' : 'Update Offer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Delete Confirmation Modal
  const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, offer, isDeleting }) => {
    if (!isOpen || !offer) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          <h5 style={{ margin: '0 0 16px 0', fontWeight: '600' }}>Delete Offer</h5>
          <p style={{ margin: '0 0 24px 0', color: '#666' }}>
            Are you sure you want to delete the offer "<strong>{offer.name}</strong>"? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isDeleting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: isDeleting ? 0.6 : 1
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Show loading while checking permission
  if (checkingViewPermission) {
    return (
      <Container fluid>
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
      </Container>
    );
  }

  // Show access denied if no permission
  if (!hasViewPermission) {
    return (
      <Container fluid>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3>Access Denied</h3>
          <p>You do not have permission to view offers.</p>
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
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container fluid>
        <Row>
          <Col md="12">
            <Card>
              <Card.Body style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '18px', color: '#666' }}>Access denied. Admin only.</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row>
        <Col md="12">
          <Card className="strpied-tabled-with-hover" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <Card.Header style={{
              padding: '20px 24px',
              borderBottom: '2px solid #f0f0f0',
              backgroundColor: 'white'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{
                    margin: 0,
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Tag size={28} />
                    Commission Offers
                  </h4>
                  <p style={{
                    margin: '4px 0 0 0',
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    Manage commission offers and promotions
                  </p>
                </div>
                {!checkingPermissions && permissions.create && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    title="Create New Offer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      backgroundColor: '#74317e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(116,49,126,0.2)',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#5a2460';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(116,49,126,0.3)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#74317e';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(116,49,126,0.2)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Plus size={20} />
                    Create Offer
                  </button>
                )}
              </div>
            </Card.Header>

            <Card.Body style={{
              padding: '24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Search and Filter Bar */}
              <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                  <Search size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    placeholder="Search offers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Filter size={18} color="#666" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="all">All Offers</option>
                    <option value="active">Active</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="expired">Expired</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Offers Table */}
              {loading ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#666'
                }}>
                  Loading offers...
                </div>
              ) : error ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#dc3545'
                }}>
                  {error}
                </div>
              ) : filteredOffers.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <Tag size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>
                    {searchQuery ? 'No offers found' : 'No offers yet'}
                  </p>
                  {!searchQuery && !checkingPermissions && permissions.create && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      style={{
                        marginTop: '16px',
                        padding: '8px 16px',
                        backgroundColor: '#74317e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a2460'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#74317e'}
                    >
                      Create your first offer
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Description</th>
                          <th>Commission %</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Status</th>
                          {(permissions.update || permissions.delete) && (
                            <th>Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOffers.map((offer) => {
                          const status = getOfferStatus(offer);
                          const statusColors = {
                            active: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
                            upcoming: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
                            expired: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
                            inactive: { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
                          };
                          const statusColor = statusColors[status] || statusColors.inactive;

                          return (
                            <tr key={offer.id}>
                              <td style={{ fontWeight: '500' }}>{offer.name}</td>
                              <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {offer.description || 'N/A'}
                              </td>
                              <td style={{ fontWeight: '600', color: '#74317e' }}>
                                {offer.commissionPercentage}%
                              </td>
                              <td>{formatDate(offer.startDate)}</td>
                              <td>{formatDate(offer.endDate)}</td>
                              <td>
                                <Badge style={{
                                  backgroundColor: statusColor.bg,
                                  color: statusColor.text,
                                  border: `1px solid ${statusColor.border}`,
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  textTransform: 'capitalize'
                                }}>
                                  {status}
                                </Badge>
                              </td>
                              {(permissions.update || permissions.delete) && (
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {permissions.update && (
                                      <button
                                        onClick={() => handleEditClick(offer)}
                                        style={{
                                          padding: '6px 12px',
                                          backgroundColor: '#f3f4f6',
                                          color: '#374151',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '12px',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#e5e7eb';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                                        }}
                                        title="Edit Offer"
                                      >
                                        <Edit2 size={14} />
                                        Edit
                                      </button>
                                    )}
                                    {permissions.delete && (
                                      <button
                                        onClick={() => handleDeleteClick(offer)}
                                        style={{
                                          padding: '6px 12px',
                                          backgroundColor: '#fee2e2',
                                          color: '#dc2626',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '12px',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#fecaca';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = '#fee2e2';
                                        }}
                                        title="Delete Offer"
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '20px',
                      paddingTop: '20px',
                      borderTop: '1px solid #e9ecef'
                    }}>
                      <div style={{ fontSize: '14px', color: '#6c757d' }}>
                        Showing {((currentPage - 1) * offersPerPage) + 1} to {Math.min(currentPage * offersPerPage, total)} of {total} offers
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        >
                          Previous
                        </Button>
                        <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage >= totalPages || loading}
                          onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Offer Modal */}
      <CreateOfferModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateOffer}
      />

      {/* Update Offer Modal */}
      <UpdateOfferModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedOffer(null);
        }}
        onUpdate={handleUpdateOffer}
        offer={selectedOffer}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false);
            setDeleteOfferData(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        offer={deleteOfferData}
        isDeleting={isDeleting}
      />
    </Container>
  );
};

export default Offers;

