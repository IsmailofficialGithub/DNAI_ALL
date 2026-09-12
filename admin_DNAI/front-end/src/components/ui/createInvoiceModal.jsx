import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, DollarSign, Package, User, Mail, AlertCircle, CheckCircle, Plus, Trash2, Loader } from 'lucide-react';
import { getConsumerPackagesForInvoice, createInvoice, getAllPackages } from '../../api/backend';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { hasRole } from '../../utils/roleUtils';

const CreateInvoiceModal = ({ isOpen, onClose, onCreate, consumer }) => {
  const { profile } = useAuth();
  const isAdmin = hasRole(profile?.role, 'admin');
  const isReseller = hasRole(profile?.role, 'reseller');
  const [formData, setFormData] = useState({
    consumer_id: '',
    consumer_name: '',
    consumer_email: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    billing_address: '',
    packages: [],
    tax_rate: 10,
    notes: ''
  });

  const [availablePackages, setAvailablePackages] = useState([]); // Consumer's accessed packages
  const [allPackages, setAllPackages] = useState([]); // All packages (for admin manual addition)
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });

  // Initialize form data and fetch consumer products when modal opens
  useEffect(() => {
    if (isOpen && consumer) {
      const consumerId = consumer.user_id || consumer.id;
      setFormData(prev => ({
        ...prev,
        consumer_id: consumerId,
        consumer_name: consumer.full_name || '',
        consumer_email: consumer.email || '',
        billing_address: consumer.billing_address || `${consumer.city || ''}, ${consumer.country || ''}`.trim(),
        packages: [] // Reset packages
      }));

      // Fetch consumer's accessed packages
      const fetchConsumerPackages = async () => {
        setGeneratingInvoice(true);
        setLoadingPackages(true);
        try {
          const result = await getConsumerPackagesForInvoice(consumerId);
          if (result && result.success && result.data) {
            const { consumer: consumerInfo, packages } = result.data;
            
            // Update consumer info if needed
            if (consumerInfo) {
              setFormData(prev => ({
                ...prev,
                consumer_name: consumerInfo.full_name || prev.consumer_name,
                consumer_email: consumerInfo.email || prev.consumer_email
              }));
            }

            // Auto-populate packages with their prices (if consumer has accessed packages)
            if (packages && Array.isArray(packages) && packages.length > 0) {
              const invoicePackages = packages.map(pkg => ({
                package_id: pkg.package_id,
                package_name: pkg.package_name,
                quantity: 1,
                price: pkg.price,
                original_price: pkg.price, // Store original price for reseller validation
                subtotal: pkg.price * 1
              }));
              setFormData(prev => ({
                ...prev,
                packages: invoicePackages
              }));
              setAvailablePackages(packages);
              toast.success(`Loaded ${packages.length} package(s) for this consumer`);
            } else {
              // Consumer has no accessed packages - they can still add packages manually
            }

            // Fetch all packages for admin and reseller (for manual addition)
            if (isAdmin || isReseller) {
              try {
                const allPackagesResult = await getAllPackages({ limit: 1000 }); // Get all packages
                if (allPackagesResult && allPackagesResult.success && allPackagesResult.data && Array.isArray(allPackagesResult.data)) {
                  setAllPackages(allPackagesResult.data);
                }
              } catch (error) {
                console.error('Error fetching all packages:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching consumer packages:', error);
          toast.error(error?.message || 'Failed to load consumer packages');
        } finally {
          setGeneratingInvoice(false);
          setLoadingPackages(false);
        }
      };

      fetchConsumerPackages();
    } else if (!isOpen) {
      // Reset when modal closes
      setAvailablePackages([]);
      setAllPackages([]);
      setGeneratingInvoice(false);
      setLoadingPackages(false);
    }
  }, [isOpen, consumer]);

  // Calculate due date as 30 days from invoice date (only if invoice_date is valid and >= today)
  useEffect(() => {
    if (formData.invoice_date) {
      const invoiceDate = new Date(formData.invoice_date + 'T00:00:00');
      const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
      const today = new Date();
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // Only auto-calculate if invoice date is valid (>= today)
      if (invoiceDateOnly >= todayOnly) {
        const calculatedDueDate = new Date(invoiceDateOnly);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + 30);
        const currentDueDate = formData.due_date ? new Date(formData.due_date + 'T00:00:00') : null;
        const currentDueDateOnly = currentDueDate ? new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), currentDueDate.getDate()) : null;
        
        // Only update if there's no due date set or if current due date is before/invalid
        if (!currentDueDateOnly || currentDueDateOnly <= invoiceDateOnly) {
          setFormData(prev => ({
            ...prev,
            due_date: calculatedDueDate.toISOString().split('T')[0]
          }));
        }
      }
    }
  }, [formData.invoice_date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validate dates in real-time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (name === 'invoice_date' && value) {
      const invoiceDate = new Date(value + 'T00:00:00');
      const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      if (invoiceDateOnly < todayOnly) {
        setErrors(prev => ({
          ...prev,
          invoice_date: 'Invoice date must be today or later',
          due_date: prev.due_date // Keep due_date error if exists
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          invoice_date: '',
          // If due date is now invalid, validate it
          due_date: prev.due_date && formData.due_date ? (() => {
            const dueDate = new Date(formData.due_date + 'T00:00:00');
            const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            return dueDateOnly <= invoiceDateOnly ? 'Due date must be after invoice date' : '';
          })() : prev.due_date
        }));
      }
    }
    
    if (name === 'due_date' && value && formData.invoice_date) {
      const dueDate = new Date(value + 'T00:00:00');
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const invoiceDate = new Date(formData.invoice_date + 'T00:00:00');
      const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
      
      if (dueDateOnly <= invoiceDateOnly) {
        setErrors(prev => ({
          ...prev,
          due_date: 'Due date must be after invoice date'
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          due_date: ''
        }));
      }
    } else if (name === 'due_date' && value && !formData.invoice_date) {
      setErrors(prev => ({
        ...prev,
        due_date: 'Please select invoice date first'
      }));
    }
    
    // Clear error for other fields
    if (errors[name] && name !== 'invoice_date' && name !== 'due_date') {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleAddPackage = () => {
    setFormData(prev => ({
      ...prev,
      packages: [...prev.packages, { package_id: '', package_name: '', quantity: 1, price: 0, original_price: 0, subtotal: 0 }]
    }));
  };

  const handleRemovePackage = (index) => {
    setFormData(prev => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index)
    }));
  };

  const handlePackageChange = (index, field, value) => {
    setFormData(prev => {
      const newPackages = [...prev.packages];
      if (field === 'package_id') {
        // Search in both availablePackages (consumer's packages) and allPackages (for admin)
        const pkg = availablePackages.find(p => p.package_id === value || p.id === value) 
                     || allPackages.find(p => p.id === value);
        const originalPrice = parseFloat(pkg?.price || 0);
        newPackages[index] = {
          ...newPackages[index],
          package_id: value,
          package_name: pkg?.package_name || pkg?.name || '',
          product_name: pkg?.product_name || null,
          price: originalPrice,
          original_price: originalPrice, // Store original price for validation
          subtotal: originalPrice * (newPackages[index].quantity || 1)
        };
      } else if (field === 'quantity') {
        const qty = parseFloat(value) || 0;
        newPackages[index] = {
          ...newPackages[index],
          quantity: qty,
          subtotal: (newPackages[index].price || 0) * qty
        };
      } else if (field === 'price') {
        // Allow empty string and only parse when there's a value
        const priceStr = value.trim();
        const price = priceStr === '' ? '' : (isNaN(parseFloat(priceStr)) ? '' : parseFloat(priceStr));
        const priceNum = price === '' ? 0 : price;
        // Get original price BEFORE updating
        const originalPrice = parseFloat(newPackages[index].original_price || 0);
        
        // Update the package first
        newPackages[index] = {
          ...newPackages[index],
          price: price, // Store as string or number, allow empty string
          subtotal: priceNum * (newPackages[index].quantity || 1)
        };
        
        // For resellers: validate that price is equal to or greater than original price
        if (isReseller && priceNum > 0 && originalPrice > 0 && priceNum < originalPrice) {
          // Show error if reseller tries to set price lower than original
          setErrors(prev => ({
            ...prev,
            [`price_${index}`]: 'Price must be equal to or greater than original price'
          }));
        } else {
          // Clear error if validation passes
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`price_${index}`];
            return newErrors;
          });
        }
      }
      return {
        ...prev,
        packages: newPackages
      };
    });
  };

  const calculateTotals = () => {
    const subtotal = formData.packages.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const tax = subtotal * (formData.tax_rate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const validateForm = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    if (!formData.consumer_id) {
      newErrors.consumer_id = 'Consumer is required';
    }
    if (!formData.invoice_date) {
      newErrors.invoice_date = 'Invoice date is required';
    } else {
      const invoiceDate = new Date(formData.invoice_date + 'T00:00:00');
      const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (invoiceDateOnly < todayOnly) {
        newErrors.invoice_date = 'Invoice date must be today or later';
      }
    }
    if (!formData.due_date) {
      newErrors.due_date = 'Due date is required';
    } else {
      const dueDate = new Date(formData.due_date + 'T00:00:00');
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      if (formData.invoice_date) {
        const invoiceDate = new Date(formData.invoice_date + 'T00:00:00');
        const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
        if (dueDateOnly <= invoiceDateOnly) {
          newErrors.due_date = 'Due date must be after invoice date';
        }
      }
    }
    if (formData.packages.length === 0) {
      newErrors.packages = 'At least one package is required';
    }
    formData.packages.forEach((pkg, index) => {
      if (!pkg.package_id) {
        newErrors[`package_${index}`] = 'Package selection is required';
      }
      if (!pkg.quantity || pkg.quantity <= 0) {
        newErrors[`quantity_${index}`] = 'Valid quantity is required';
      }
      // Validate price for resellers: must be equal to or greater than original price
      if (isReseller && pkg.package_id && pkg.original_price) {
        const currentPrice = parseFloat(pkg.price || 0);
        const originalPrice = parseFloat(pkg.original_price || 0);
        if (currentPrice > 0 && originalPrice > 0 && currentPrice < originalPrice) {
          newErrors[`price_${index}`] = 'Price must be equal to or greater than original price';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setSubmitMessage({ type: 'error', text: 'Please fix the errors above' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });

    try {
      const { subtotal, tax, total } = calculateTotals();
      
      // Prepare invoice items for backend
      const invoiceItems = formData.packages.map(pkg => ({
        package_id: pkg.package_id,
        quantity: parseInt(pkg.quantity),
        unit_price: parseFloat(pkg.price),
        tax_rate: formData.tax_rate
      }));
      
      const invoiceData = {
        receiver_id: formData.consumer_id,
        issue_date: formData.invoice_date,
        due_date: formData.due_date,
        tax_rate: formData.tax_rate,
        notes: formData.notes || null,
        items: invoiceItems
      };

      // Call backend API to create invoice
      const result = await createInvoice(invoiceData);

      if (result && result.success) {
        setSubmitMessage({ type: 'success', text: 'Invoice created successfully!' });
        toast.success('Invoice created successfully!');
        
        // Call the onCreate callback if provided
        if (onCreate) {
          await onCreate(result.data);
        }
        
        setTimeout(() => {
          // Reset form
          setFormData({
            consumer_id: '',
            consumer_name: '',
            consumer_email: '',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: '',
            billing_address: '',
            packages: [],
            tax_rate: 10,
            notes: ''
          });
          setErrors({});
          setSubmitMessage({ type: '', text: '' });
          onClose();
        }, 1500);
      } else {
        const errorMessage = result?.error || result?.message || 'Failed to create invoice';
        setSubmitMessage({ type: 'error', text: errorMessage });
        toast.error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error?.message || 'An unexpected error occurred';
      setSubmitMessage({ type: 'error', text: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        consumer_id: '',
        consumer_name: '',
        consumer_email: '',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: '',
            billing_address: '',
            packages: [],
            tax_rate: 10,
            notes: ''
          });
      setErrors({});
      setSubmitMessage({ type: '', text: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '700px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 10
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FileText size={24} />
            Create Invoice
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              transition: 'all 0.2s',
              opacity: isSubmitting ? 0.5 : 1
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Loading State - Generating Invoice */}
          {generatingInvoice && (
            <div style={{
              marginBottom: '20px',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              textAlign: 'center'
            }}>
              <Loader size={24} style={{ 
                color: '#74317e', 
                marginBottom: '12px', 
                display: 'inline-block',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: '500' }}>
                Generating invoice... Loading consumer packages...
              </p>
            </div>
          )}

          {/* Success/Error Message */}
          {submitMessage.text && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: submitMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${submitMessage.type === 'success' ? '#86efac' : '#fecaca'}`
            }}>
              {submitMessage.type === 'success' ? (
                <CheckCircle size={20} style={{ color: '#22c55e' }} />
              ) : (
                <AlertCircle size={20} style={{ color: '#ef4444' }} />
              )}
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: submitMessage.type === 'success' ? '#166534' : '#991b1b',
                fontWeight: '500'
              }}>
                {submitMessage.text}
              </p>
            </div>
          )}

          {/* Consumer Info (Read-only if provided) */}
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <User size={16} color="#6b7280" />
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  {formData.consumer_name || 'Consumer Name'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
                <Mail size={14} color="#9ca3af" />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {formData.consumer_email || 'Consumer Email'}
                </span>
              </div>
            </div>
          </div>

          {/* Invoice Date */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Invoice Date <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="date"
                name="invoice_date"
                value={formData.invoice_date}
                onChange={handleChange}
                min={(() => {
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = String(today.getMonth() + 1).padStart(2, '0');
                  const day = String(today.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })()}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.invoice_date ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1
                }}
              />
            </div>
            {errors.invoice_date && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>
                {errors.invoice_date}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Due Date <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                min={formData.invoice_date ? (() => {
                  const minDate = new Date(formData.invoice_date);
                  minDate.setDate(minDate.getDate() + 1);
                  return minDate.toISOString().split('T')[0];
                })() : new Date().toISOString().split('T')[0]}
                disabled={isSubmitting || !formData.invoice_date}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.due_date ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting || !formData.invoice_date ? 0.6 : 1,
                  cursor: !formData.invoice_date ? 'not-allowed' : 'default'
                }}
              />
            </div>
            {errors.due_date && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>
                {errors.due_date}
              </p>
            )}
          </div>

          {/* Billing Address */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Billing Address
            </label>
            <textarea
              name="billing_address"
              value={formData.billing_address}
              onChange={handleChange}
              placeholder="Enter billing address"
              disabled={isSubmitting}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                opacity: isSubmitting ? 0.6 : 1,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Packages Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Subscribed Packages <span style={{ color: '#ef4444' }}>*</span>
                {formData.packages.length > 0 && (
                  <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '400', marginLeft: '8px' }}>
                    ({formData.packages.length} package{formData.packages.length !== 1 ? 's' : ''})
                  </span>
                )}
              </label>
              {(isAdmin || isReseller) && (availablePackages.length > 0 || allPackages.length > 0) && (
                <button
                  type="button"
                  onClick={handleAddPackage}
                  disabled={isSubmitting || generatingInvoice}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: '#74317e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: isSubmitting || generatingInvoice ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isSubmitting || generatingInvoice ? 0.5 : 1
                  }}
                >
                  <Plus size={14} />
                  {isAdmin ? 'Add Manual Package' : 'Add Package'}
                </button>
              )}
            </div>
            {errors.packages && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>
                {errors.packages}
              </p>
            )}
            {formData.packages.map((pkg, index) => (
              <div key={index} style={{
                marginBottom: '12px',
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Package {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePackage(index)}
                    disabled={isSubmitting}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                      Package
                    </label>
                    <select
                      value={pkg.package_id}
                      onChange={(e) => handlePackageChange(index, 'package_id', e.target.value)}
                      disabled={isSubmitting || loadingPackages}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: errors[`package_${index}`] ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select package...</option>
                      {/* Show consumer's subscribed packages (if any) */}
                      {availablePackages.length > 0 && (
                        <optgroup label="Consumer's Packages">
                          {availablePackages.map(p => {
                            const productName = p.product_name || '';
                            const packageName = p.package_name || p.name || '';
                            const displayName = productName ? `${productName} - ${packageName}` : packageName;
                            return (
                              <option key={p.package_id || p.id} value={p.package_id || p.id}>
                                {displayName} - ${parseFloat(p.price || 0).toFixed(2)}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {/* Show all packages for admin and reseller */}
                      {(isAdmin || isReseller) && allPackages.length > 0 && (
                        <optgroup label={availablePackages.length > 0 ? "All Packages" : "Packages"}>
                          {availablePackages.length > 0 ? (
                            // Show packages not in consumer's list
                            allPackages
                              .filter(p => !availablePackages.some(ap => (ap.package_id || ap.id) === p.id))
                              .map(p => {
                                const productName = p.product_name || '';
                                const packageName = p.name || '';
                                const displayName = productName ? `${productName} - ${packageName}` : packageName;
                                return (
                                  <option key={p.id} value={p.id}>
                                    {displayName} - ${parseFloat(p.price || 0).toFixed(2)}
                                  </option>
                                );
                              })
                          ) : (
                            // Show all packages if consumer has no packages
                            allPackages.map(p => {
                              const productName = p.product_name || '';
                              const packageName = p.name || '';
                              const displayName = productName ? `${productName} - ${packageName}` : packageName;
                              return (
                                <option key={p.id} value={p.id}>
                                  {displayName} - ${parseFloat(p.price || 0).toFixed(2)}
                                </option>
                              );
                            })
                          )}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pkg.quantity}
                      onChange={(e) => handlePackageChange(index, 'quantity', e.target.value)}
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: errors[`quantity_${index}`] ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                      Price {isAdmin ? '(Editable)' : isReseller ? '(Editable - Min: $' + (pkg.original_price || pkg.price || 0).toFixed(2) + ')' : '(Fixed)'}
                    </label>
                    <input
                      type="text"
                      value={pkg.price === 0 || pkg.price === '' || pkg.price === null || pkg.price === undefined ? '' : String(pkg.price)}
                      onChange={(e) => {
                        // Allow empty string and numeric input
                        const value = e.target.value;
                        // Allow empty string, numbers, decimals (no negative for price)
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          handlePackageChange(index, 'price', value);
                        }
                      }}
                      onBlur={(e) => {
                        // When user leaves the field, ensure valid number or empty
                        const value = e.target.value.trim();
                        if (value === '' || value === '-') {
                          handlePackageChange(index, 'price', '');
                        } else if (!isNaN(parseFloat(value))) {
                          handlePackageChange(index, 'price', value);
                        }
                      }}
                      placeholder="0.00"
                      disabled={isSubmitting || (!isAdmin && !isReseller)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: errors[`price_${index}`] ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: (isAdmin || isReseller) ? 'white' : '#f3f4f6',
                        cursor: (isAdmin || isReseller) ? 'text' : 'not-allowed',
                        opacity: (isAdmin || isReseller) ? 1 : 0.7
                      }}
                      title={!isAdmin && !isReseller ? 'Only admin and reseller can edit prices' : isReseller ? `Price must be equal to or greater than original price ($${(pkg.original_price || pkg.price || 0).toFixed(2)})` : 'Edit price'}
                    />
                    {errors[`price_${index}`] && (
                      <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>
                        {errors[`price_${index}`]}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '8px', textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Subtotal: </span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#74317e' }}>
                    ${(pkg.subtotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tax Rate */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Tax Rate (%)
            </label>
            <input
              type="number"
              name="tax_rate"
              value={formData.tax_rate}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.1"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                opacity: isSubmitting ? 0.6 : 1
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes or comments..."
              disabled={isSubmitting}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                opacity: isSubmitting ? 0.6 : 1,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Totals Summary */}
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Subtotal:</span>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Tax ({formData.tax_rate}%):</span>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                ${tax.toFixed(2)}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '2px solid #e5e7eb',
              marginTop: '8px'
            }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>Total:</span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#74317e' }}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'white'
        }}>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isSubmitting ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: isSubmitting ? '#b896c0' : '#74317e',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Creating...
              </>
            ) : (
              <>
                <FileText size={16} />
                Create Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;

