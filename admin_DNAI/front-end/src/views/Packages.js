import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Plus, Edit2, Trash2, Search, Package, DollarSign, FileText, MoreVertical, Box, Filter, X } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import toast from 'react-hot-toast';
import CreatePackageModal from '../components/ui/createPackageModal';
import UpdatePackageModal from '../components/ui/updatePackageModal';
import { getAllPackages, deletePackage } from '../api/backend/packages';
import { getProducts } from '../api/backend';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

const Packages = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePackageData, setDeletePackageData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [permissions, setPermissions] = useState({
    create: false,
    delete: false,
    update: false,
    read: false,
  });
  const [hasViewPermission, setHasViewPermission] = useState(false);
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  // Fetch packages and products
  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAllPackages();
      
      if (result.error) {
        setError(result.error);
        toast.error(`Error: ${result.error}`);
      } else {
        setPackages(result.data || []);
      }
    } catch (err) {
      setError('Failed to load packages');
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  // Fetch products for display
  const fetchProducts = async () => {
    try {
      const result = await getProducts();
      if (result && result.success && result.data && Array.isArray(result.data)) {
        setProducts(result.data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Check packages.view permission first
  useEffect(() => {
    if (!user || !profile) {
      setHasViewPermission(false);
      setCheckingViewPermission(false);
      return;
    }

    if (isLoadingPermissions) {
      setCheckingViewPermission(true);
      return;
    }

    const hasViewPerm = hasPermission('packages.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
    
    if (!hasViewPerm) {
      toast.error('You do not have permission to view packages.');
      setTimeout(() => {
        history.push('/admin/users');
      }, 500);
    }
  }, [user, profile, history, hasPermission, isLoadingPermissions]);

  // Check multiple permissions
  useEffect(() => {
    if (checkingViewPermission || !hasViewPermission || isLoadingPermissions) {
      return;
    }

    setCheckingPermissions(true);
    
    // Systemadmins always have all permissions (bypass permission checks)
    // Note: If you're testing permission removal, make sure you're logged in as a regular admin, not a systemadmin
    if (profile?.is_systemadmin === true) {
      setPermissions({ create: true, delete: true, update: true, read: true });
      setCheckingPermissions(false);
      return;
    }

    // For regular users (including admins), check actual permissions
    // Only checks packages.* permissions (no fallback to products.*)
    try {
      setPermissions({
        create: hasPermission('packages.create'),
        delete: hasPermission('packages.delete'),
        update: hasPermission('packages.update'),
        read: hasPermission('packages.read')
      });
    } catch (error) {
      console.error('Error checking package permissions:', error);
      setPermissions({ create: false, delete: false, update: false, read: false });
    } finally {
      setCheckingPermissions(false);
    }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch packages and products (only if user has view permission)
  useEffect(() => {
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    fetchPackages();
    fetchProducts();
  }, [checkingViewPermission, hasViewPermission]);

  // Handle create package
  const handleCreatePackage = async (packageData) => {
    if (!permissions.create) {
      toast.error('You do not have permission to create packages.');
      setShowCreateModal(false);
      return;
    }

    await fetchPackages();
    setShowCreateModal(false);
  };

  // Handle update package
  const handleUpdatePackage = async (packageData) => {
    if (!permissions.update) {
      toast.error('You do not have permission to update packages.');
      setShowUpdateModal(false);
      setSelectedPackage(null);
      return;
    }

    await fetchPackages();
    setShowUpdateModal(false);
    setSelectedPackage(null);
  };

  // Handle delete click
  const handleDeleteClick = (packageItem) => {
    if (!permissions.delete) {
      toast.error('You do not have permission to delete packages.');
      setOpenDropdownId(null);
      return;
    }

    setDeletePackageData(packageItem);
    setShowDeleteConfirm(true);
    setOpenDropdownId(null);
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!deletePackageData) return;

    setIsDeleting(true);
    try {
      const result = await deletePackage(deletePackageData.id);
      
      if (result.success) {
        toast.success('Package deleted successfully');
        setShowDeleteConfirm(false);
        setDeletePackageData(null);
        await fetchPackages();
      } else {
        toast.error(result.error || 'Failed to delete package');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('An error occurred while deleting the package');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle edit click
  const handleEditClick = (packageItem) => {
    if (!permissions.update) {
      toast.error('You do not have permission to update packages.');
      setOpenDropdownId(null);
      return;
    }

    setSelectedPackage(packageItem);
    setShowUpdateModal(true);
    setOpenDropdownId(null);
  };

  // Get product name by ID
  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  // Filter packages by search and filters
  const filteredPackages = packages.filter(packageItem => {
    const productName = getProductName(packageItem.product_id);
    const packagePrice = packageItem.price !== null && packageItem.price !== undefined ? parseFloat(packageItem.price) : 0;
    
    // Name/description search filter
    const matchesSearch = !searchQuery || (
      packageItem.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      packageItem.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      productName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Product filter
    const matchesProduct = !filterProduct || packageItem.product_id === filterProduct;
    
    // Price range filter
    let matchesPrice = true;
    if (minPrice && minPrice.trim() !== '') {
      const min = parseFloat(minPrice);
      if (!isNaN(min) && packagePrice < min) {
        matchesPrice = false;
      }
    }
    if (maxPrice && maxPrice.trim() !== '') {
      const max = parseFloat(maxPrice);
      if (!isNaN(max) && packagePrice > max) {
        matchesPrice = false;
      }
    }
    
    return matchesSearch && matchesProduct && matchesPrice;
  });

  // Count active filters
  const activeFiltersCount = [
    searchQuery ? 1 : 0,
    filterProduct ? 1 : 0,
    minPrice ? 1 : 0,
    maxPrice ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterProduct('');
    setMinPrice('');
    setMaxPrice('');
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
          <p>You do not have permission to view packages.</p>
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
                    <Package size={28} />
                    Packages
                  </h4>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    {!checkingPermissions && (
                      <>
                        {permissions.create && permissions.update && permissions.delete 
                          ? 'Manage packages for your products'
                          : permissions.read && !permissions.update && !permissions.delete
                          ? 'View available packages (Read-only)'
                          : permissions.read
                          ? 'View and manage packages'
                          : 'Packages'
                        }
                      </>
                    )}
                    {checkingPermissions && 'Loading permissions...'}
                  </p>
                </div>
                {!checkingPermissions && permissions.create && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    title="Create New Package"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px',
                      backgroundColor: '#74317e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(116,49,126,0.2)'
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
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  flexWrap: 'wrap',
                  alignItems: 'flex-start'
                }}>
                  {/* Search by Name */}
                  <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                    <Search size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      zIndex: 1
                    }} />
                    <input
                      type="text"
                      placeholder="Search by package name, description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#74317e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Filter by Product */}
                  <div style={{ position: 'relative', minWidth: '200px' }}>
                    <Box size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      zIndex: 1,
                      pointerEvents: 'none'
                    }} />
                    <select
                      value={filterProduct}
                      onChange={(e) => setFilterProduct(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '40px',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#74317e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <option value="">All Products</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Min Price */}
                  <div style={{ position: 'relative', minWidth: '120px' }}>
                    <DollarSign size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      zIndex: 1,
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="number"
                      placeholder="Min Price"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#74317e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Filter by Max Price */}
                  <div style={{ position: 'relative', minWidth: '120px' }}>
                    <DollarSign size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      zIndex: 1,
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="number"
                      placeholder="Max Price"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#74317e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Clear Filters Button */}
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={clearFilters}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                    >
                      <X size={16} />
                      Clear ({activeFiltersCount})
                    </button>
                  )}
                </div>

                {/* Active Filters Summary */}
                {activeFiltersCount > 0 && (
                  <div style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      Active filters:
                    </span>
                    {searchQuery && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        Name: "{searchQuery}"
                        <X 
                          size={12} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSearchQuery('')}
                        />
                      </span>
                    )}
                    {filterProduct && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        Product: {getProductName(filterProduct)}
                        <X 
                          size={12} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setFilterProduct('')}
                        />
                      </span>
                    )}
                    {(minPrice || maxPrice) && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        Price: {minPrice ? `$${minPrice}` : '$0'} - {maxPrice ? `$${maxPrice}` : '∞'}
                        <X 
                          size={12} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setMinPrice('');
                            setMaxPrice('');
                          }}
                        />
                      </span>
                    )}
                  </div>
                )}

                {/* Results Count */}
                {!loading && (
                  <div style={{
                    marginTop: '12px',
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    Showing {filteredPackages.length} of {packages.length} package{packages.length !== 1 ? 's' : ''}
                    {activeFiltersCount > 0 && (
                      <span style={{ marginLeft: '8px', color: '#74317e', fontWeight: '500' }}>
                        (filtered)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Packages Grid */}
              {loading ? (
                <div style={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#666'
                }}>
                  Loading packages...
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
              ) : filteredPackages.length === 0 ? (
                <div style={{ 
                  flex: 1,
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>
                    {searchQuery || filterProduct || minPrice || maxPrice 
                      ? 'No packages found matching your filters' 
                      : 'No packages yet'}
                  </p>
                  {!searchQuery && !filterProduct && !minPrice && !maxPrice && !checkingPermissions && permissions.create && (
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
                      Create your first package
                    </button>
                  )}
                  {!searchQuery && !filterProduct && !minPrice && !maxPrice && !checkingPermissions && !permissions.create && permissions.read && (
                    <p style={{ fontSize: '14px', margin: '8px 0 0 0', color: '#9ca3af' }}>
                      You have read-only access. Contact an administrator to create packages.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '20px',
                  overflow: 'auto'
                }}>
                  {filteredPackages.map((packageItem) => (
                    <div
                      key={packageItem.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: 'white',
                        transition: 'all 0.2s',
                        cursor: permissions.read ? 'default' : 'pointer',
                        position: 'relative',
                        opacity: permissions.read ? 1 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (permissions.read || permissions.update || permissions.delete) {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Actions Dropdown - Only show if user has at least one action permission */}
                      {(permissions.update || permissions.delete) && (
                        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === packageItem.id ? null : packageItem.id);
                            }}
                            style={{
                              padding: '6px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Package actions"
                          >
                            <MoreVertical size={18} color="#666" />
                          </button>

                          {openDropdownId === packageItem.id && (
                            <>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(null);
                                }}
                                style={{
                                  position: 'fixed',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  zIndex: 999
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: '4px',
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  zIndex: 1000,
                                  minWidth: '150px',
                                  overflow: 'hidden'
                                }}
                              >
                                {permissions.update && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditClick(packageItem);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      color: '#374151',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Edit2 size={16} />
                                    Edit
                                  </button>
                                )}
                                {permissions.delete && (
                                  <>
                                    {permissions.update && (
                                      <div style={{
                                        height: '1px',
                                        backgroundColor: '#e5e7eb',
                                        margin: '4px 0'
                                      }} />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(packageItem);
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
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Trash2 size={16} />
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Read-only indicator - Show if user only has read permission */}
                      {permissions.read && !permissions.update && !permissions.delete && (
                        <div style={{ 
                          position: 'absolute', 
                          top: '16px', 
                          right: '16px',
                          padding: '4px 8px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          Read Only
                        </div>
                      )}

                      {/* Package Icon */}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#f0fdf4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px'
                      }}>
                        <Package size={24} color="#16a34a" />
                      </div>

                      {/* Product Name */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        <Box size={14} color="#6b7280" />
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          {getProductName(packageItem.product_id)}
                        </span>
                      </div>

                      {/* Package Name */}
                      <h5 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1f2937',
                        margin: '0 0 8px 0',
                        paddingRight: '30px'
                      }}>
                        {packageItem.name}
                      </h5>

                      {/* Package Description */}
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '0 0 16px 0',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: '42px'
                      }}>
                        {packageItem.description || 'No description'}
                      </p>

                      {/* Package Price */}
                      {packageItem.price !== null && packageItem.price !== undefined ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          backgroundColor: '#f0fdf4',
                          borderRadius: '8px',
                          width: 'fit-content'
                        }}>
                          <DollarSign size={18} color="#16a34a" />
                          <span style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#16a34a'
                          }}>
                            {parseFloat(packageItem.price || 0).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '8px',
                          width: 'fit-content'
                        }}>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#6b7280'
                          }}>
                            Free
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Package Modal */}
      <CreatePackageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePackage}
      />

      {/* Update Package Modal */}
      {selectedPackage && (
        <UpdatePackageModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedPackage(null);
          }}
          packageData={selectedPackage}
          onUpdate={handleUpdatePackage}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletePackageData && (
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
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#dc3545' }}>
                Delete Package
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: 0, fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
                Are you sure you want to delete <strong>{deletePackageData.name}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePackageData(null);
                }}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isDeleting ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Container>
  );
};

export default Packages;

