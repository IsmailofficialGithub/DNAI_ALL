import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Plus, Edit2, Trash2, Search, Package, FileText, MoreVertical, ExternalLink } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import toast from 'react-hot-toast';
import CreateProductModal from '../components/ui/createProductModal';
import UpdateProductModal from '../components/ui/updateProductModal';
import { getAllProducts, deleteProduct } from '../api/backend/products';
import { checkUserPermissionsBulk } from '../api/backend/permissions';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

const Products = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteProductData, setDeleteProductData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [permissions, setPermissions] = useState({
    create: false, // Start as false, update after checking
    delete: false,
    update: false,
    read: false,
  });
  const [hasViewPermission, setHasViewPermission] = useState(false); // Start as false
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true); // Track permission checking state

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAllProducts();
      
      if (result.error) {
        setError(result.error);
        toast.error(`Error: ${result.error}`);
      } else {
        setProducts(result.data || []);
      }
    } catch (err) {
      setError('Failed to load products');
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Check products.view permission first (required to access the page)
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
    const hasViewPerm = hasPermission('products.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
    
    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view products.');
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
          create: hasPermission('products.create'),
          delete: hasPermission('products.delete'),
          update: hasPermission('products.update'),
          read: hasPermission('products.read')
        });
    } catch (error) {
      console.error('Error checking product permissions:', error);
      setPermissions({ create: false, delete: false, update: false, read: false });
    } finally {
      setCheckingPermissions(false);
    }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch products (only if user has view permission)
  useEffect(() => {
    // Don't fetch if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    fetchProducts();
  }, [checkingViewPermission, hasViewPermission]);

  // Handle create product
  const handleCreateProduct = async (productData) => {
    // Check permission before creating
    if (!permissions.create) {
      toast.error('You do not have permission to create products.');
      setShowCreateModal(false);
      return;
    }

    await fetchProducts();
    setShowCreateModal(false);
  };

  // Handle update product
  const handleUpdateProduct = async (productData) => {
    // Check permission before updating
    if (!permissions.update) {
      toast.error('You do not have permission to update products.');
      setShowUpdateModal(false);
      setSelectedProduct(null);
      return;
    }

    await fetchProducts();
    setShowUpdateModal(false);
    setSelectedProduct(null);
  };

  // Handle delete product
  const handleDeleteClick = (product) => {
    // Check permission before showing delete confirmation
    if (!permissions.delete) {
      toast.error('You do not have permission to delete products.');
      setOpenDropdownId(null);
      return;
    }

    setDeleteProductData(product);
    setShowDeleteConfirm(true);
    setOpenDropdownId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteProductData) return;

    // Check permission before deletion
    if (!permissions.delete) {
      toast.error('You do not have permission to delete products.');
      setShowDeleteConfirm(false);
      setDeleteProductData(null);
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteProduct(deleteProductData.id);
      
      if (result.error) {
        toast.error(`Error: ${result.error}`);
      } else {
        toast.success('Product deleted successfully!');
        await fetchProducts();
        setShowDeleteConfirm(false);
        setDeleteProductData(null);
      }
    } catch (error) {
      toast.error('Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle edit click
  const handleEditClick = (product) => {
    // Check permission before editing
    if (!permissions.update) {
      toast.error('You do not have permission to update products.');
      setOpenDropdownId(null);
      return;
    }

    setSelectedProduct(product);
    setShowUpdateModal(true);
    setOpenDropdownId(null);
  };

  // Handle switch to product
  const handleSwitchToProduct = (product) => {
    // Check permission before viewing details
    if (!permissions.read) {
      toast.error('You do not have permission to view product details.');
      setOpenDropdownId(null);
      return;
    }

    setOpenDropdownId(null);
    history.push(`/admin/product/${product.id}`);
  };

  // Filter products by search
  const filteredProducts = products.filter(product => 
    product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <p>You do not have permission to view products.</p>
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
                    Products
                  </h4>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    Manage your products
                  </p>
                </div>
                {!checkingPermissions && permissions.create && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    title="Create New Product"
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
            }}>
              {/* Search Bar */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                  <Search size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    placeholder="Search products..."
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
              </div>

              {/* Products Grid */}
              {loading ? (
                <div style={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#666'
                }}>
                  Loading products...
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
              ) : filteredProducts.length === 0 ? (
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
                    {searchQuery ? 'No products found' : 'No products yet'}
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
                      Create your first product
                    </button>
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '20px',
                  overflow: 'auto'
                }}>
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: 'white',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Actions Dropdown - Only show if user has at least one permission */}
                      {(permissions.read || permissions.update || permissions.delete) && (
                        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === product.id ? null : product.id);
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
                          >
                            <MoreVertical size={18} color="#666" />
                          </button>

                          {openDropdownId === product.id && (
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
                                {permissions.read && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSwitchToProduct(product);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      color: '#74317e',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      fontWeight: '500'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <ExternalLink size={16} />
                                    View Details
                                  </button>
                                )}
                                {permissions.update && (
                                  <>
                                    {permissions.read && (
                                      <div style={{
                                        height: '1px',
                                        backgroundColor: '#e5e7eb',
                                        margin: '4px 0'
                                      }} />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(product);
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
                                  </>
                                )}
                                {permissions.delete && (
                                  <>
                                    {(permissions.read || permissions.update) && (
                                      <div style={{
                                        height: '1px',
                                        backgroundColor: '#e5e7eb',
                                        margin: '4px 0'
                                      }} />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(product);
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

                      {/* Product Icon */}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#eff6ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px'
                      }}>
                        <Package size={24} color="#3b82f6" />
                      </div>

                      {/* Product Name */}
                      <h5 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#1f2937',
                        margin: '0 0 8px 0',
                        paddingRight: '30px'
                      }}>
                        {product.name}
                      </h5>

                      {/* Product Description */}
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '0',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: '42px'
                      }}>
                        {product.description || 'No description'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProduct}
      />

      {/* Update Product Modal */}
      {selectedProduct && (
        <UpdateProductModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onUpdate={handleUpdateProduct}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteProductData && (
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
                Delete Product
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: 0, fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
                Are you sure you want to delete <strong>{deleteProductData.name}</strong>?
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
                  setDeleteProductData(null);
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
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
};

export default Products;


