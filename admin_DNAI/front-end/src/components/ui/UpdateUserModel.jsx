import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Calendar, Globe, MapPin, Phone, ChevronDown, Tag, Users, Package, CreditCard } from 'lucide-react';
import { countries, searchCountries } from '../../utils/countryData';
import { getResellers, getProducts } from '../../api/backend';
import { getAllVapiAccounts } from '../../api/backend/vapi';
import { useAuth } from '../../hooks/useAuth';
import { hasRole } from '../../utils/roleUtils';
import CreditsModal from './CreditsModal';

const UpdateUserModal = ({ isOpen, onClose, user, onUpdate }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    roles: ['user'], // Default to user role
    country: '',
    city: '',
    phone: '',
    nickname: '',
    subscribed_products: [],
    referred_by: '',
    trial_expiry_date: ''
  });

  // Available roles for user form
  const availableRoles = [
    { value: 'user', label: 'User' },
    { value: 'admin', label: 'Admin' },
    { value: 'consumer', label: 'Consumer' },
    { value: 'reseller', label: 'Reseller' },
    { value: 'viewer', label: 'Viewer' },
    { value: 'support', label: 'Support' }
  ];

  // Check if consumer role is selected
  const isConsumerSelected = formData.roles?.includes('consumer') || false;

  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [errors, setErrors] = useState({});
  
  // Consumer-specific state
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductsDropdown, setShowProductsDropdown] = useState(false);
  const [resellers, setResellers] = useState([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [resellerSearchTerm, setResellerSearchTerm] = useState('');
  const [showResellerSuggestions, setShowResellerSuggestions] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);
  
  // Product settings state
  const [productSettings, setProductSettings] = useState({});
  const [vapiAccounts, setVapiAccounts] = useState([]);
  const [loadingVapiAccounts, setLoadingVapiAccounts] = useState(false);
  
  // Check if genie product is selected
  const isGenieProductSelected = formData.subscribed_products.some(productId => {
    const product = products.find(p => p.id === productId || p.product_id === productId);
    return product && product.name && product.name.toLowerCase() === 'genie';
  });

  // Credit Management state
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  // Check if beeba product is selected
  const isBeebaProductSelected = formData.subscribed_products.some(productId => {
    const product = products.find(p => p.id === productId || p.product_id === productId);
    return product && product.name && product.name.toLowerCase() === 'beeba';
  });

  // Check if user is admin or superadmin (only they can see Genie and Beeba Product Settings)
  const isAdmin = hasRole(profile?.role, 'admin');
  const isSuperAdmin = profile?.is_systemadmin === true;
  const canViewGenieSettings = isAdmin || isSuperAdmin;
  const canViewBeebaSettings = isAdmin || isSuperAdmin;

  // Fetch products and VAPI accounts when modal opens and consumer is selected
  useEffect(() => {
    if (isOpen && isConsumerSelected) {
      const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
          const result = await getProducts();
          if (result && result.success && result.data && Array.isArray(result.data)) {
            setProducts(result.data);
          } else if (result && result.error) {
            console.error('Error from getProducts:', result.error);
          }
        } catch (error) {
          console.error('Error fetching products:', error);
        } finally {
          setLoadingProducts(false);
        }
      };
      
      const fetchVapiAccounts = async () => {
        setLoadingVapiAccounts(true);
        try {
          const result = await getAllVapiAccounts();
          if (result && result.success && result.data && Array.isArray(result.data)) {
            setVapiAccounts(result.data);
          } else if (result && result.error) {
            console.error('Error from getAllVapiAccounts:', result.error);
          }
        } catch (error) {
          console.error('Error fetching VAPI accounts:', error);
        } finally {
          setLoadingVapiAccounts(false);
        }
      };
      
      fetchProducts();
      fetchVapiAccounts();
    }
  }, [isOpen, isConsumerSelected]);

  // Search resellers when user types 2+ characters
  useEffect(() => {
    if (isConsumerSelected && resellerSearchTerm.length >= 2) {
      const fetchResellers = async () => {
        setLoadingResellers(true);
        try {
          const result = await getResellers({ search: resellerSearchTerm });
          if (result && !result.error) {
            let resellersList = [];
            if (Array.isArray(result)) {
              resellersList = result;
            } else if (result.data && Array.isArray(result.data)) {
              resellersList = result.data;
            } else if (result.success && Array.isArray(result.data)) {
              resellersList = result.data;
            }
            setResellers(resellersList);
          } else {
            setResellers([]);
          }
        } catch (error) {
          console.error('Error fetching resellers:', error);
          setResellers([]);
        } finally {
          setLoadingResellers(false);
        }
      };
      
      const debounceTimer = setTimeout(() => {
        fetchResellers();
      }, 300);
      
      return () => clearTimeout(debounceTimer);
    } else {
      setResellers([]);
      setShowResellerSuggestions(false);
    }
  }, [resellerSearchTerm, isConsumerSelected]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showResellerSuggestions && !event.target.closest('.reseller-search-container')) {
        setShowResellerSuggestions(false);
      }
      if (showProductsDropdown && !event.target.closest('.products-dropdown-container')) {
        setShowProductsDropdown(false);
      }
    };
    
    if (showResellerSuggestions || showProductsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showResellerSuggestions, showProductsDropdown]);

  useEffect(() => {
    if (user) {
      // Handle role - support both array and single value (backward compatibility)
      const userRoles = Array.isArray(user.role) 
        ? user.role.map(r => String(r).toLowerCase())
        : (user.role ? [String(user.role).toLowerCase()] : ['user']);
      
      setFormData({
        name: user.full_name || user.name || '',
        email: user.email || '',
        roles: userRoles,
        country: user.country || '',
        city: user.city || '',
        phone: '',
        nickname: user.nickname || '',
        subscribed_products: user.subscribed_products || [],
        referred_by: user.referred_by || '',
        trial_expiry_date: user.trial_expiry ? new Date(user.trial_expiry).toISOString().split('T')[0] : ''
      });
      
      // If user has a country, find and set it
      if (user.country) {
        const country = countries.find(c => c.name === user.country);
        if (country) {
          setSelectedCountry(country);
          // Remove country code from phone if it exists
          if (user.phone) {
            // Extract just the number part (remove country code)
            const phoneStr = String(user.phone).trim();
            // Remove the country code if it's at the start
            let phoneWithoutCode = phoneStr;
            if (phoneStr.startsWith(country.phoneCode)) {
              phoneWithoutCode = phoneStr.substring(country.phoneCode.length).trim();
            }
            setFormData(prev => ({ ...prev, phone: phoneWithoutCode }));
          }
        } else {
          setSelectedCountry(null);
          // If country name doesn't match, just set phone as is
          if (user.phone) {
            setFormData(prev => ({ ...prev, phone: String(user.phone).trim() }));
          }
        }
      } else {
        setSelectedCountry(null);
        // If no country but has phone, just set the phone as is
        if (user.phone) {
          setFormData(prev => ({ ...prev, phone: String(user.phone).trim() }));
        }
      }
      
      // Load reseller if referred_by exists
      if (user.referred_by) {
        // Try to find reseller in user data or fetch it
        if (user.referred_by_name && user.referred_by_email) {
          setSelectedReseller({
            user_id: user.referred_by,
            full_name: user.referred_by_name,
            email: user.referred_by_email
          });
        }
      } else {
        setSelectedReseller(null);
      }
      
      // Load product settings if they exist
      if (user.productSettings && typeof user.productSettings === 'object') {
        setProductSettings(user.productSettings);
      } else if (user.product_settings && typeof user.product_settings === 'object') {
        setProductSettings(user.product_settings);
      }
      
      setCountrySearch('');
      setErrors({});
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '');
    
    setFormData(prev => ({ ...prev, phone: numericValue }));
    
    // Clear phone error when user starts typing
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
    
    // Real-time validation feedback (optional - can be removed if too intrusive)
    if (selectedCountry && numericValue) {
      const expectedNationalLength = selectedCountry.nationalLength;
      const phoneDigits = numericValue.replace(/\D/g, '');
      
      if (phoneDigits.length > expectedNationalLength) {
        // Don't set error here, just prevent further input
        // The validation will catch it on submit
      }
    }
  };

  // Handle role change
  const handleRoleChange = (roleValue) => {
    setFormData(prev => {
      const currentRoles = prev.roles || ['user'];
      const isSelected = currentRoles.includes(roleValue);
      
      let newRoles;
      if (isSelected) {
        // Remove role if already selected
        newRoles = currentRoles.filter(r => r !== roleValue);
        // Ensure at least one role is selected
        if (newRoles.length === 0) {
          newRoles = ['user']; // Default to user if all roles are deselected
        }
      } else {
        // Add role
        newRoles = [...currentRoles, roleValue];
      }
      
      // If consumer role is removed, clear consumer-specific fields
      const wasConsumer = currentRoles.includes('consumer');
      const isNowConsumer = newRoles.includes('consumer');
      
      return {
        ...prev,
        roles: newRoles,
        // Clear consumer-specific fields if consumer role is removed
        ...(wasConsumer && !isNowConsumer ? {
          referred_by: '',
          subscribed_products: [],
          trial_expiry_date: ''
        } : {})
      };
    });
    
    // Clear roles error when user changes selection
    if (errors.roles) {
      setErrors(prev => ({ ...prev, roles: '' }));
    }
  };

  // Handle product selection
  const handleProductToggle = (productId) => {
    // Clear products error when user makes a selection
    if (errors.subscribed_products) {
      setErrors(prev => ({
        ...prev,
        subscribed_products: ''
      }));
    }
    
    const isSelected = formData.subscribed_products.includes(productId);
    const product = products.find(p => p.id === productId || p.product_id === productId);
    const productName = product?.name?.toLowerCase();
    
    setFormData(prev => ({
      ...prev,
      subscribed_products: isSelected
        ? prev.subscribed_products.filter(id => id !== productId)
        : [...prev.subscribed_products, productId]
    }));
    
    // If removing genie product, clear its settings
    if (isSelected && productName === 'genie') {
      setProductSettings(prevSettings => {
        const newSettings = { ...prevSettings };
        delete newSettings[productId];
        return newSettings;
      });
    }
    
    // If removing beeba product, clear its settings
    if (isSelected && productName === 'beeba') {
      setProductSettings(prevSettings => {
        const newSettings = { ...prevSettings };
        delete newSettings[productId];
        return newSettings;
      });
    }
    
    // If adding genie product, initialize with default values
    if (!isSelected && productName === 'genie') {
      setProductSettings(prevSettings => {
        if (!prevSettings[productId]) {
          return {
            ...prevSettings,
            [productId]: {
              list_limit: 1,
              agent_number: 3,
              vapi_account: 1,
              duration_limit: 60,
              concurrency_limit: 1
            }
          };
        }
        return prevSettings;
      });
    }
    
    // If adding beeba product, initialize with default values
    if (!isSelected && productName === 'beeba') {
      setProductSettings(prevSettings => {
        if (!prevSettings[productId]) {
          return {
            ...prevSettings,
            [productId]: {
              posts: 10,
              video: 5,
              brands: 3,
              images: 10,
              analysis: 3,
              carasoul: 5
            }
          };
        }
        return prevSettings;
      });
    }
  };

  // Handle product settings change
  const handleProductSettingChange = (productId, field, value) => {
    setProductSettings(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value === '' ? undefined : (field === 'vapi_account' || field === 'agent_number' || field === 'duration_limit' || field === 'list_limit' || field === 'concurrency_limit' || field === 'brands' || field === 'posts' || field === 'analysis' || field === 'images' || field === 'video' || field === 'carasoul' ? parseInt(value) || undefined : value)
      }
    }));
  };

  // Get genie product ID
  const getGenieProductId = () => {
    return formData.subscribed_products.find(productId => {
      const product = products.find(p => p.id === productId || p.product_id === productId);
      return product && product.name && product.name.toLowerCase() === 'genie';
    });
  };

  // INBOUND_DB_ID must be declared AFTER getGenieProductId (const arrow fn, not hoisted)
  const INBOUND_DB_ID = process.env.REACT_APP_INBOUND_DB_ID || getGenieProductId();

  // Get beeba product ID
  const getBeebaProductId = () => {
    return formData.subscribed_products.find(productId => {
      const product = products.find(p => p.id === productId || p.product_id === productId);
      return product && product.name && product.name.toLowerCase() === 'beeba';
    });
  };

  // Check if product is selected
  const isProductSelected = (productId) => {
    return formData.subscribed_products.includes(productId);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    
    // Remove any existing country code from phone number
    let cleanPhone = formData.phone;
    if (selectedCountry && formData.phone && formData.phone.toString().startsWith(selectedCountry.phoneCode)) {
      cleanPhone = formData.phone.toString().substring(selectedCountry.phoneCode.length).trim();
    }
    
    setFormData(prev => ({
      ...prev,
      country: country.name,
      phone: cleanPhone // Just the local number without country code
    }));
    setCountrySearch('');
    setShowCountryDropdown(false);
    if (errors.country) {
      setErrors(prev => ({ ...prev, country: '' }));
    }
    
    // Re-validate phone if it exists when country changes
    if (formData.phone && formData.phone.toString().trim()) {
      const phoneDigits = formData.phone.toString().replace(/\D/g, '');
      const expectedNationalLength = country.nationalLength;
      
      if (phoneDigits.length !== expectedNationalLength) {
        setErrors(prev => ({
          ...prev,
          phone: `Phone number must be exactly ${expectedNationalLength} digits for ${country.name} (currently ${phoneDigits.length} digits)`
        }));
      } else {
        // Clear phone error if it's now valid
        if (errors.phone) {
          setErrors(prev => ({ ...prev, phone: '' }));
        }
      }
    }
  };

  const handleCountryInputChange = (e) => {
    const value = e.target.value;
    setCountrySearch(value);
    setSelectedCountry(null);
    setFormData(prev => ({ ...prev, country: '' }));
    setShowCountryDropdown(true);
  };

  const handleCountryInputFocus = () => {
    setShowCountryDropdown(true);
  };

  const handleCountryInputClick = () => {
    // If a country is selected and user clicks to edit, clear it for searching
    if (selectedCountry) {
      setSelectedCountry(null);
      setCountrySearch('');
      setFormData(prev => ({ ...prev, country: '' }));
      setShowCountryDropdown(true);
    }
  };

  const filteredCountries = countrySearch 
    ? searchCountries(countrySearch)
    : countries;

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.roles || formData.roles.length === 0) {
      newErrors.roles = 'At least one role is required';
    }
    
    // Consumer-specific validations
    if (isConsumerSelected) {
      // Require at least one product when consumer is selected
      if (!formData.subscribed_products || formData.subscribed_products.length === 0) {
        newErrors.subscribed_products = 'At least one product is required for consumers';
      }
    }
    
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }
    
    // City validation (optional)
    // No validation needed - city is optional
    
    // Phone validation (optional but must be valid if provided)
    // Check if phone has any value (even if just whitespace, we'll validate it)
    const phoneValue = formData.phone ? formData.phone.toString().trim() : '';
    
    if (phoneValue) {
      // Get only digits from the entered phone number
      const phoneDigits = phoneValue.replace(/\D/g, '');
      
      // Basic format validation - allow only digits, spaces, dashes, plus, parentheses
      if (!/^[\d\s\-\+\(\)]+$/.test(phoneValue)) {
        newErrors.phone = 'Please enter a valid phone number (only numbers allowed)';
      } else if (selectedCountry) {
        // Validate phone length based on country's nationalLength
        const expectedNationalLength = selectedCountry.nationalLength;
        
        if (phoneDigits.length === 0) {
          newErrors.phone = 'Phone number cannot be empty';
        } else if (phoneDigits.length !== expectedNationalLength) {
          newErrors.phone = `Phone number must be exactly ${expectedNationalLength} digits for ${selectedCountry.name} (you entered ${phoneDigits.length} digits)`;
        }
      } else {
        // If no country selected but phone is provided, require country selection
        if (phoneDigits.length > 0) {
          newErrors.phone = 'Please select a country to validate phone number';
        } else if (phoneDigits.length < 8) {
          newErrors.phone = 'Phone number must be at least 8 digits';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    const isValid = validateForm();
    if (!isValid) {
      console.log('Validation failed. Errors:', errors);
      return;
    }
    
    if (isValid) {
      // Combine country code with phone number
      const fullPhone = selectedCountry && formData.phone 
        ? `${selectedCountry.phoneCode} ${formData.phone.trim()}`
        : formData.phone.trim() || null;

      const updateData = {
        ...user,
        full_name: formData.name,  // Map 'name' to 'full_name'
        roles: formData.roles || ['user'], // Send roles array (already lowercase)
        email: formData.email || null,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        phone: fullPhone,
        nickname: formData.nickname.trim() || null
      };

      // Add consumer-specific fields if consumer role is selected
      if (isConsumerSelected) {
        updateData.referred_by = formData.referred_by || null;
        updateData.subscribed_products = formData.subscribed_products || [];
        updateData.trial_expiry_date = formData.trial_expiry_date || null;
        // Include product settings if any exist
        if (Object.keys(productSettings).length > 0) {
          updateData.productSettings = productSettings;
        }
      }

      onUpdate(updateData);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          maxWidth: '550px',
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
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#111827'
          }}>
            Update User
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* User ID Display */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <User size={18} style={{ color: '#6b7280' }} />
            <div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                User ID
              </div>
              <div style={{
                fontSize: '14px',
                color: '#111827',
                fontWeight: '600',
                marginTop: '4px',
                fontFamily: 'monospace'
              }}>
                #{user?.id?.toString().slice(0, 8) || '-'}
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }}>
                <User size={18} />
              </div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.name ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!errors.name) {
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

          {/* Nickname Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Nickname / Label <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }}>
                <Tag size={18} />
              </div>
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                placeholder="Enter a nickname or label"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.nickname ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!errors.nickname) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.nickname ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            {errors.nickname && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.nickname}
              </p>
            )}
          </div>

          {/* Roles Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Roles <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{
              border: errors.roles ? '1px solid #ef4444' : '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '12px',
              backgroundColor: 'white',
              minHeight: '80px'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {availableRoles.map((role) => {
                  const isChecked = formData.roles?.includes(role.value) || false;
                  return (
                    <label
                      key={role.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s',
                        backgroundColor: isChecked ? '#f3f4f6' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleRoleChange(role.value)}
                        style={{
                          width: '18px',
                          height: '18px',
                          marginRight: '12px',
                          cursor: 'pointer',
                          accentColor: '#74317e'
                        }}
                      />
                      <Shield size={16} style={{ marginRight: '8px', color: '#6b7280' }} />
                      <span style={{
                        fontSize: '14px',
                        color: '#374151',
                        fontWeight: isChecked ? '500' : '400'
                      }}>
                        {role.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            {errors.roles && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.roles}
              </p>
            )}
            {formData.roles && formData.roles.length > 0 && (
              <p style={{
                color: '#6b7280',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                Selected: {formData.roles.map(r => availableRoles.find(ar => ar.value === r)?.label || r).join(', ')}
              </p>
            )}
          </div>

          {/* Consumer-specific fields - only show when consumer role is selected */}
          {isConsumerSelected && (
            <>
              {/* Assign to Reseller Field (Optional) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Assign to Reseller <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
                </label>
                <div style={{ position: 'relative' }} className="reseller-search-container">
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    zIndex: 1,
                    pointerEvents: 'none'
                  }}>
                    <Users size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder={selectedReseller ? `${selectedReseller.full_name} (${selectedReseller.email})` : "Type at least 2 characters to search resellers..."}
                    value={selectedReseller ? `${selectedReseller.full_name} (${selectedReseller.email})` : resellerSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setResellerSearchTerm(value);
                      if (selectedReseller) {
                        setSelectedReseller(null);
                        setFormData(prev => ({ ...prev, referred_by: '' }));
                      }
                      setShowResellerSuggestions(value.length >= 2);
                    }}
                    onFocus={() => {
                      if (resellerSearchTerm.length >= 2 || resellers.length > 0) {
                        setShowResellerSuggestions(true);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 40px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'white',
                      cursor: 'text',
                      fontFamily: 'inherit',
                      color: selectedReseller ? '#374151' : '#9ca3af'
                    }}
                  />
                  {selectedReseller && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReseller(null);
                        setResellerSearchTerm('');
                        setFormData(prev => ({ ...prev, referred_by: '' }));
                        setShowResellerSuggestions(false);
                      }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      <X size={18} />
                    </button>
                  )}
                  
                  {/* Reseller Suggestions */}
                  {showResellerSuggestions && resellerSearchTerm.length >= 2 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {loadingResellers ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                          Searching...
                        </div>
                      ) : resellers.length > 0 ? (
                        resellers.map(reseller => (
                          <div
                            key={reseller.user_id}
                            onClick={() => {
                              setSelectedReseller(reseller);
                              setFormData(prev => ({
                                ...prev,
                                referred_by: reseller.user_id
                              }));
                              setResellerSearchTerm('');
                              setShowResellerSuggestions(false);
                            }}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                              {reseller.full_name || 'No Name'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                              {reseller.email || reseller.user_id}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                          No resellers found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedReseller && (
                  <p style={{
                    color: '#6b7280',
                    fontSize: '12px',
                    marginTop: '6px',
                    marginBottom: 0
                  }}>
                    This consumer will be assigned to: {selectedReseller.full_name}
                  </p>
                )}
              </div>

              {/* Subscribed Products Field (Multi-select) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  <Package size={16} style={{ color: '#6b7280' }} />
                  Subscribed Products <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }} className="products-dropdown-container">
                  <div
                    onClick={() => setShowProductsDropdown(!showProductsDropdown)}
                    style={{
                      width: '100%',
                      minHeight: '42px',
                      padding: '8px 40px 8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      alignItems: 'center'
                    }}
                  >
                    {formData.subscribed_products.length === 0 ? (
                      <span style={{ color: '#9ca3af', fontSize: '14px' }}>Select products...</span>
                    ) : (
                      formData.subscribed_products.map(productId => {
                        const product = products.find(p => p.id === productId || p.product_id === productId);
                        return product ? (
                          <span
                            key={productId}
                            style={{
                              backgroundColor: '#f3f4f6',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductToggle(productId);
                            }}
                          >
                            {product.name || product.product_name}
                            <X size={12} style={{ cursor: 'pointer' }} />
                          </span>
                        ) : null;
                      })
                    )}
                  </div>
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    pointerEvents: 'none'
                  }}>
                    <ChevronDown size={18} style={{ transform: showProductsDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                  
                  {showProductsDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {loadingProducts ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                          Loading products...
                        </div>
                      ) : products.length > 0 ? (
                        products.map(product => {
                          const productId = product.id || product.product_id;
                          const isSelected = isProductSelected(productId);
                          return (
                            <label
                              key={productId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: isSelected ? '#f9fafb' : 'white',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'white';
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleProductToggle(productId)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  marginRight: '12px',
                                  cursor: 'pointer',
                                  accentColor: '#74317e'
                                }}
                              />
                              <span style={{ fontSize: '14px', color: '#374151' }}>
                                {product.name || product.product_name}
                              </span>
                            </label>
                          );
                        })
                      ) : (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                          No products available
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {formData.subscribed_products.length > 0 && (
                  <p style={{
                    color: '#6b7280',
                    fontSize: '12px',
                    marginTop: '6px',
                    marginBottom: 0
                  }}>
                    {formData.subscribed_products.length} product(s) selected
                  </p>
                )}
                {errors.subscribed_products && (
                  <p style={{
                    color: '#ef4444',
                    fontSize: '12px',
                    marginTop: '6px',
                    marginBottom: 0
                  }}>
                    {errors.subscribed_products}
                  </p>
                )}
              </div>

              {/* Genie Product Settings Section */}
              {isGenieProductSelected && canViewGenieSettings && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px'
                  }}>
                    <Package size={16} style={{ color: '#74317e' }} />
                    Genie Product Settings <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
                  </label>
                  
                  {(() => {
                    const genieProductId = getGenieProductId();
                    const settings = productSettings[genieProductId] || {
                      list_limit: 1,
                      agent_number: 3,
                      vapi_account: 1,
                      duration_limit: 60,
                      concurrency_limit: 1
                    };
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* VAPI Account */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            VAPI Account
                          </label>
                          <div style={{ position: 'relative' }}>
                            <select
                              value={settings.vapi_account || ''}
                              onChange={(e) => handleProductSettingChange(genieProductId, 'vapi_account', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                color: settings.vapi_account ? '#374151' : '#9ca3af',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                paddingRight: '32px'
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
                              <option value="">Select VAPI account...</option>
                              {loadingVapiAccounts ? (
                                <option disabled>Loading...</option>
                              ) : (
                                vapiAccounts.map(account => (
                                  <option key={account.id} value={account.id}>
                                    {account.account_name}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Agent Number */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Agent Number
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.agent_number || ''}
                            onChange={(e) => handleProductSettingChange(genieProductId, 'agent_number', e.target.value)}
                            placeholder="Enter agent number"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Duration Limit */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Duration Limit <span style={{ color: '#9ca3af', fontWeight: '400' }}>(minutes)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.duration_limit || ''}
                            onChange={(e) => handleProductSettingChange(genieProductId, 'duration_limit', e.target.value)}
                            placeholder="Enter duration limit in minutes"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* List Limit */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            List Limit
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.list_limit || ''}
                            onChange={(e) => handleProductSettingChange(genieProductId, 'list_limit', e.target.value)}
                            placeholder="Enter list limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Concurrency Limit */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Concurrency Limit
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.concurrency_limit || ''}
                            onChange={(e) => handleProductSettingChange(genieProductId, 'concurrency_limit', e.target.value)}
                            placeholder="Enter concurrency limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Beeba Product Settings Section */}
              {isBeebaProductSelected && canViewBeebaSettings && (
                <div style={{ 
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px'
                  }}>
                    <Package size={16} style={{ color: '#74317e' }} />
                    Beeba Product Settings <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
                  </label>
                  
                  {(() => {
                    const beebaProductId = getBeebaProductId();
                    const settings = productSettings[beebaProductId] || {
                      posts: 10,
                      video: 5,
                      brands: 3,
                      images: 10,
                      analysis: 3,
                      carasoul: 5
                    };
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Brands */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Brands
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.brands || ''}
                            onChange={(e) => handleProductSettingChange(beebaProductId, 'brands', e.target.value)}
                            placeholder="Enter brands limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Posts */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Posts
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.posts || ''}
                            onChange={(e) => handleProductSettingChange(beebaProductId, 'posts', e.target.value)}
                            placeholder="Enter posts limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Analysis */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Analysis
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.analysis || ''}
                            onChange={(e) => handleProductSettingChange(beebaProductId, 'analysis', e.target.value)}
                            placeholder="Enter analysis limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Images */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Images
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.images || ''}
                            onChange={(e) => handleProductSettingChange(beebaProductId, 'images', e.target.value)}
                            placeholder="Enter images limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Video */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Video
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.video || ''}
                            onChange={(e) => handleProductSettingChange(beebaProductId, 'video', e.target.value)}
                            placeholder="Enter video limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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

                        {/* Carasoul */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                          }}>
                            Carasoul
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={settings.carasoul || ''}
                            onChange={(e) => handleProductSettingChange(beebaProductId, 'carasoul', e.target.value)}
                            placeholder="Enter carasoul limit"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box',
                              backgroundColor: 'white'
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
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Trial Period Field (Required for Consumer) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Trial Period <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }}>
                    <Calendar size={18} />
                  </div>
                  <input
                    type="date"
                    name="trial_expiry_date"
                    value={formData.trial_expiry_date}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: errors.trial_expiry_date ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      if (!errors.trial_expiry_date) {
                        e.target.style.borderColor = '#74317e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.trial_expiry_date ? '#ef4444' : '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                {errors.trial_expiry_date && (
                  <p style={{
                    color: '#ef4444',
                    fontSize: '12px',
                    marginTop: '6px',
                    marginBottom: 0
                  }}>
                    {errors.trial_expiry_date}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Country Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Country <span style={{ color: '#ef4444' }}>*</span>
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
                <Globe size={18} />
              </div>
              <input
                type="text"
                value={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : countrySearch}
                onChange={handleCountryInputChange}
                onFocus={handleCountryInputFocus}
                onClick={handleCountryInputClick}
                placeholder="Search country..."
                readOnly={false}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 40px',
                  border: errors.country ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  cursor: selectedCountry ? 'pointer' : 'text',
                  backgroundColor: selectedCountry ? '#f9fafb' : 'white'
                }}
                onFocusCapture={(e) => {
                  if (!errors.country) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  setTimeout(() => setShowCountryDropdown(false), 200);
                  e.target.style.borderColor = errors.country ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {selectedCountry ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCountry(null);
                    setCountrySearch('');
                    setFormData(prev => ({ ...prev, country: '' }));
                    setShowCountryDropdown(true);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#9ca3af',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#9ca3af';
                  }}
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCountryDropdown(!showCountryDropdown);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: `translateY(-50%) rotate(${showCountryDropdown ? '180deg' : '0deg'})`,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#9ca3af',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#9ca3af';
                  }}
                >
                  <ChevronDown size={18} />
                </button>
              )}
              
              {/* Country Dropdown */}
              {showCountryDropdown && !selectedCountry && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  zIndex: 1000
                }}
                onMouseDown={(e) => e.preventDefault()}
                >
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((country) => (
                      <div
                        key={country.code}
                        onClick={() => handleCountrySelect(country)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <span style={{ fontSize: '20px' }}>{country.flag}</span>
                        <span style={{ fontSize: '14px', color: '#374151', flex: 1 }}>{country.name}</span>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{country.phoneCode}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#9ca3af',
                      fontSize: '14px'
                    }}>
                      No countries found
                    </div>
                  )}
                </div>
              )}
            </div>
            {errors.country && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.country}
              </p>
            )}
          </div>

          {/* City Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              City <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }}>
                <MapPin size={18} />
              </div>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.city ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!errors.city) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.city ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            {errors.city && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.city}
              </p>
            )}
          </div>

          {/* Phone Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Phone Number <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
              {selectedCountry && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  minWidth: '80px',
                  justifyContent: 'center'
                }}>
                  {selectedCountry.phoneCode}
                </div>
              )}
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}>
                  <Phone size={18} />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder={selectedCountry ? "Enter phone number" : "Select country first"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={selectedCountry ? selectedCountry.nationalLength : undefined}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: errors.phone ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    // If no country is selected, open the country dropdown
                    if (!selectedCountry) {
                      setShowCountryDropdown(true);
                      e.target.blur();
                      const countrySection = document.querySelector('input[placeholder*="Search country"]');
                      if (countrySection) {
                        countrySection.focus();
                        countrySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    } else if (!errors.phone) {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.phone ? '#ef4444' : '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
            {errors.phone && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.phone}
              </p>
            )}
            {!errors.phone && selectedCountry && formData.phone && (
              <p style={{
                color: '#6b7280',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {(() => {
                  const expectedNationalLength = selectedCountry.nationalLength;
                  const phoneDigits = formData.phone.replace(/\D/g, '');
                  const remaining = expectedNationalLength - phoneDigits.length;
                  if (remaining > 0) {
                    return `${remaining} digit${remaining !== 1 ? 's' : ''} remaining`;
                  } else if (remaining === 0) {
                    return '✓ Valid length';
                  } else {
                    return `${Math.abs(remaining)} digit${Math.abs(remaining) !== 1 ? 's' : ''} too many`;
                  }
                })()}
              </p>
            )}
            {!errors.phone && selectedCountry && !formData.phone && (
              <p style={{
                color: '#6b7280',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {(() => {
                  const expectedNationalLength = selectedCountry.nationalLength;
                  return `Enter ${expectedNationalLength} digits`;
                })()}
              </p>
            )}
          </div>

          {/* Created At Display */}
          {user?.createdAt && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Calendar size={16} style={{ color: '#6b7280' }} />
              <div style={{
                fontSize: '13px',
                color: '#6b7280'
              }}>
                Created on {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          )}

          {/* Credits Management Section */}
          {isGenieProductSelected && isAdmin && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: '#f5f3ff',
              borderRadius: '8px',
              border: '1px solid #ddd6fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#74317e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Credit Management</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Manage balance and package subscriptions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditsModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #74317e',
                  borderRadius: '6px',
                  color: '#74317e',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Manage Credits
              </button>
            </div>
          )}
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
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#74317e',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#5a2460';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#74317e';
            }}
          >
            Update User
          </button>
        </div>
      </div>
      {showCreditsModal && (
        <CreditsModal
          isOpen={showCreditsModal}
          onClose={() => setShowCreditsModal(false)}
          userId={user?.id}
          productId={getGenieProductId()}
          userName={formData.name || user?.full_name}
        />
      )}
    </div>
  );
};

export default UpdateUserModal;