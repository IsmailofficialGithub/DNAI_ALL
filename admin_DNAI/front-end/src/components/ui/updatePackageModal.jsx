import React, { useState, useEffect } from 'react';
import { X, Package, FileText, DollarSign, AlertCircle, CheckCircle, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import { updatePackage } from '../../api/backend/packages';
import { getProducts } from '../../api/backend';

const UpdatePackageModal = ({ isOpen, onClose, packageData, onUpdate }) => {
  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    description: '',
    price: ''
  });

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });

  // Fetch products when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
          const result = await getProducts();
          if (result && result.success && result.data && Array.isArray(result.data)) {
            setProducts(result.data);
          }
        } catch (error) {
          console.error('Error fetching products:', error);
        } finally {
          setLoadingProducts(false);
        }
      };
      fetchProducts();
    }
  }, [isOpen]);

  // Load package data when packageData changes
  useEffect(() => {
    if (packageData) {
      setFormData({
        product_id: packageData.product_id || '',
        name: packageData.name || '',
        description: packageData.description || '',
        price: packageData.price !== null && packageData.price !== undefined ? packageData.price.toString() : ''
      });
      setErrors({});
      setSubmitMessage({ type: '', text: '' });
    }
  }, [packageData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Product ID validation
    if (!formData.product_id) {
      newErrors.product_id = 'Product is required';
    }
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Package name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Package name must be at least 2 characters';
    }
    
    // Description validation (optional but if provided, must be valid)
    if (formData.description && formData.description.trim().length > 0 && formData.description.trim().length < 5) {
      newErrors.description = 'Description must be at least 5 characters if provided';
    }
    
    // Price validation (optional but if provided, must be valid)
    if (formData.price && formData.price.trim() !== '') {
      const priceNum = parseFloat(formData.price);
      if (isNaN(priceNum) || priceNum < 0) {
        newErrors.price = 'Price must be a non-negative number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });

    try {
      const updateData = {
        product_id: formData.product_id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price && formData.price.trim() !== '' ? parseFloat(formData.price) : null
      };

      const result = await updatePackage(packageData.id, updateData);

      if (result.success) {
        setSubmitMessage({ type: 'success', text: 'Package updated successfully!' });
        toast.success('Package updated successfully!');
        
        setTimeout(() => {
          setSubmitMessage({ type: '', text: '' });
          onUpdate(result.data);
        }, 1000);
      } else {
        setSubmitMessage({ type: 'error', text: result.error || 'Failed to update package' });
        toast.error(result.error || 'Failed to update package');
      }
    } catch (error) {
      console.error('Error updating package:', error);
      setSubmitMessage({ type: 'error', text: 'An unexpected error occurred' });
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setErrors({});
      setSubmitMessage({ type: '', text: '' });
      onClose();
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
      padding: '20px',
      animation: 'fadeIn 0.2s ease-in-out'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '550px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '600',
            color: '#111827'
          }}>
            Update Package
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              opacity: isSubmitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={24} color="#666" />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1
        }}>
          <form onSubmit={handleSubmit}>
            {/* Product Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Product <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  zIndex: 1
                }}>
                  <Box size={18} />
                </div>
                <select
                  name="product_id"
                  value={formData.product_id}
                  onChange={handleChange}
                  disabled={isSubmitting || loadingProducts}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: errors.product_id ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    opacity: isSubmitting || loadingProducts ? 0.6 : 1,
                    backgroundColor: 'white',
                    cursor: isSubmitting || loadingProducts ? 'not-allowed' : 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '40px'
                  }}
                  onFocus={(e) => {
                    if (!errors.product_id && !isSubmitting) {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.product_id ? '#ef4444' : '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select a product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.product_id && (
                <p style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0
                }}>
                  {errors.product_id}
                </p>
              )}
            </div>

            {/* Package Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Package Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}>
                  <Package size={18} />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Free Plan, Premium, Enterprise"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: errors.name ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  onFocus={(e) => {
                    if (!errors.name && !isSubmitting) {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.name ? '#ef4444' : '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              {errors.name && (
                <p style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0
                }}>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Description <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '12px',
                  color: '#9ca3af'
                }}>
                  <FileText size={18} />
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter package description (optional)"
                  disabled={isSubmitting}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: errors.description ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  onFocus={(e) => {
                    if (!errors.description && !isSubmitting) {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.description ? '#ef4444' : '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              {errors.description && (
                <p style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0
                }}>
                  {errors.description}
                </p>
              )}
            </div>

            {/* Price */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Price <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}>
                  <DollarSign size={18} />
                </div>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: errors.price ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  onFocus={(e) => {
                    if (!errors.price && !isSubmitting) {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.price ? '#ef4444' : '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              {errors.price && (
                <p style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0
                }}>
                  {errors.price}
                </p>
              )}
            </div>

            {/* Submit Message */}
            {submitMessage.text && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: submitMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
                border: `1px solid ${submitMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {submitMessage.type === 'success' ? (
                  <CheckCircle size={18} color="#10b981" />
                ) : (
                  <AlertCircle size={18} color="#ef4444" />
                )}
                <span style={{
                  fontSize: '14px',
                  color: submitMessage.type === 'success' ? '#065f46' : '#991b1b'
                }}>
                  {submitMessage.text}
                </span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              color: '#374151',
              opacity: isSubmitting ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isSubmitting ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#5a2460';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#74317e';
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
                Updating...
              </>
            ) : (
              'Update Package'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UpdatePackageModal;

