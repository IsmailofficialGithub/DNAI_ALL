import React, { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, Globe, MapPin, ChevronDown, Package, CheckCircle, Shield, Tag, Info, Coins, Check, CreditCard } from 'lucide-react';
import { countries, searchCountries } from '../../utils/countryData';
import apiClient from '../../services/apiClient';
import { normalizeRole } from '../../utils/roleUtils';
import { getProducts, getAllPackages } from '../../api/backend';
import { getAllVapiAccounts } from '../../api/backend/vapi';
import { useAuth } from '../../hooks/useAuth';
import { hasRole } from '../../utils/roleUtils';
import toast from 'react-hot-toast';
import CreditsModal from './CreditsModal';

const UpdateConsumerModal = ({ isOpen, onClose, consumer, onUpdate, initialProductSettings }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    trial_expiry_date: '',
    country: '',
    city: '',
    subscribed_packages: [],
    roles: ['consumer'], // Default to consumer, but allow reseller too
    nickname: ''
  });

  // Available roles for consumer form
  const availableRoles = [
    { value: 'consumer', label: 'Consumer' },
    { value: 'reseller', label: 'Reseller' }
  ];

  // Check if consumer role is selected
  const isConsumerSelected = formData.roles?.includes('consumer') || false;

  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showPackagesDropdown, setShowPackagesDropdown] = useState(false);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showProductsDropdown, setShowProductsDropdown] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSettings, setProductSettings] = useState({});
  const [vapiAccounts, setVapiAccounts] = useState([]);
  const [loadingVapiAccounts, setLoadingVapiAccounts] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && consumer) {
      // Format date for input field (YYYY-MM-DD)
      let trialDate = '';
      if (consumer.trial_expiry || consumer.trial_expiry_date) {
        const dateStr = consumer.trial_expiry || consumer.trial_expiry_date;
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            trialDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('Invalid trial date:', dateStr);
        }
      }

      // Handle both subscribed_packages (new) and subscribed_products (backward compatibility)
      const consumerPackages = consumer.subscribed_packages || [];
      const consumerProducts = consumer.subscribed_products || [];


      // Initialize selected products from consumer data
      setSelectedProducts(Array.isArray(consumerProducts) ? consumerProducts : []);

      console.log('🔍 Update Modal Env Check:', {
        REACT_APP_INBOUND_DB_ID: process.env.REACT_APP_INBOUND_DB_ID,
        INBOUND_DB_ID: process.env.INBOUND_DB_ID,
        ResolvedInboundId: getInboundProductId()
      });

      // Initialize productSettings from prop or consumer data
      if (initialProductSettings && Object.keys(initialProductSettings).length > 0) {
        setProductSettings(initialProductSettings);
      } else if (consumer.productSettings && typeof consumer.productSettings === 'object') {
        // Normalize productSettings - ensure all keys are strings for consistent matching
        const normalizedSettings = {};
        Object.keys(consumer.productSettings).forEach(productId => {
          // Convert product ID to string for consistent matching
          const normalizedId = String(productId);
          normalizedSettings[normalizedId] = consumer.productSettings[productId];
        });
        setProductSettings(normalizedSettings);
      } else {
        setProductSettings({});
      }

      // Handle role - use normalizeRole utility to handle all formats (array, string, etc.)
      const consumerRoles = normalizeRole(consumer.role);

      // Ensure at least consumer role is present (default to consumer if empty)
      const finalRoles = consumerRoles.length > 0 ? consumerRoles : ['consumer'];

      setFormData({
        full_name: consumer.full_name || consumer.name || '',
        phone: '',
        trial_expiry_date: trialDate,
        country: consumer.country || '',
        city: consumer.city || '',
        subscribed_packages: consumerPackages || [],
        roles: finalRoles,
        nickname: consumer.nickname || ''
      });

      // If consumer has a country, find and set it
      if (consumer.country) {
        const country = countries.find(c => c.name === consumer.country);
        if (country) {
          setSelectedCountry(country);
          // Remove country code from phone if it exists
          if (consumer.phone) {
            // Extract just the number part (remove country code)
            const phoneStr = String(consumer.phone).trim();
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
          if (consumer.phone) {
            setFormData(prev => ({ ...prev, phone: String(consumer.phone).trim() }));
          }
        }
      } else {
        setSelectedCountry(null);
        // If no country but has phone, just set the phone as is
        if (consumer.phone) {
          setFormData(prev => ({ ...prev, phone: String(consumer.phone).trim() }));
        }
      }

      setCountrySearch('');
      setErrors({});
    }
  }, [isOpen, consumer]);



  // Fetch products when modal opens and consumer role is selected
  useEffect(() => {
    if (isOpen && isConsumerSelected) {
      const fetchProducts = async () => {
        setLoadingProducts(true);
        console.log('🔄 UpdateConsumerModal - Fetching products...');
        try {
          const result = await getProducts();
          if (result && result.success && result.data && Array.isArray(result.data)) {
            setProducts(result.data);
          } else if (result && result.error) {
            console.error('Error from getProducts:', result.error);
            setProducts([]);
          } else {
            setProducts([]);
          }
        } catch (error) {
          console.error('Error fetching products:', error);
          setProducts([]);
        } finally {
          setLoadingProducts(false);
        }
      };

      fetchProducts();
    }
  }, [isOpen, isConsumerSelected, consumer, initialProductSettings]);

  // Fetch VAPI accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchVapiAccounts = async () => {
        setLoadingVapiAccounts(true);
        try {
          const vapiResult = await getAllVapiAccounts();
          if (vapiResult && vapiResult.success && vapiResult.data && Array.isArray(vapiResult.data)) {
            setVapiAccounts(vapiResult.data);
          } else if (vapiResult && vapiResult.error) {
            console.error('Error from getAllVapiAccounts:', vapiResult.error);
            setVapiAccounts([]);
          } else {
            setVapiAccounts([]);
          }
        } catch (error) {
          console.error('Error fetching VAPI accounts:', error);
          setVapiAccounts([]);
        } finally {
          setLoadingVapiAccounts(false);
        }
      };

      fetchVapiAccounts();
    }
  }, [isOpen]);

  // Fetch packages when modal opens and consumer role is selected
  useEffect(() => {
    if (isOpen && isConsumerSelected) {
      const fetchPackages = async () => {
        setLoadingPackages(true);
        try {
          const response = await getAllPackages();
          if (response?.success && Array.isArray(response.data)) {
            setPackages(response.data);
          } else if (response?.error) {
            console.error('❌ Error from getPackages:', response.error);
            setPackages([]);
          }
        } catch (error) {
          console.error('Error fetching packages:', error);
          setPackages([]);
        } finally {
          setLoadingPackages(false);
        }
      };

      fetchPackages();
    }
  }, [isOpen, isConsumerSelected]);

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

  // Handle package selection
  const handlePackageToggle = (packageId) => {
    console.log('📦 Package toggled:', packageId);
    
    // Find the package object to check for credits
    const packageItem = packages.find(p => p.id === packageId);
    
    setFormData(prev => {
      // Convert both to strings for comparison to handle UUID string comparison issues
      const packageIdStr = String(packageId);
      const isSelecting = !prev.subscribed_packages.some(id => String(id) === packageIdStr);

      const newPackages = isSelecting
        ? [...prev.subscribed_packages, packageId]
        : prev.subscribed_packages.filter(id => String(id) !== packageIdStr);

      // If we are selecting an inbound package, update the balance
      if (isSelecting && packageItem && (packageItem.product_type === 'inbound' || packageItem.product_id === '1e27e1d8-2c82-408c-89c3-ecab9f608cc8')) {
        const inboundProductId = packageItem.product_id || '1e27e1d8-2c82-408c-89c3-ecab9f608cc8';
        
        // Find credits variable
        const creditsVar = packageItem.package_variables?.find(v => 
          v.variable_name === 'credits' || 
          v.variable_name === 'included_credits' || 
          v.variable_name === 'given_credits' ||
          v.variable_name === 'balance'
        );
        
        if (creditsVar) {
          const creditValue = parseFloat(creditsVar.variable_value) || 0;
          console.log(`💰 DEBUG: Found ${creditValue} credits in package ${packageItem.name}`);
          
          setProductSettings(prevSettings => ({
            ...prevSettings,
            [inboundProductId]: {
              ...(prevSettings[inboundProductId] || {
                low_credit_threshold: 10,
                auto_topup_enabled: false,
                auto_topup_amount: 50,
                auto_topup_threshold: 10
              }),
              balance: creditValue
            }
          }));
        }
      }

      return {
        ...prev,
        subscribed_packages: newPackages
      };
    });
  };

  // Check if package is selected
  const isPackageSelected = (packageId) => {
    // Convert both to strings for comparison to handle UUID string comparison issues
    const packageIdStr = String(packageId);
    return formData.subscribed_packages.some(id => String(id) === packageIdStr);
  };

  // Handle product selection
  const handleProductToggle = (productId) => {
    // Clear products error when user makes a selection
    if (errors.products) {
      setErrors(prev => ({
        ...prev,
        products: ''
      }));
    }

    setSelectedProducts(prev => {
      const isSelected = prev.includes(productId);
      const productName = products.find(p => p.id === productId)?.name?.toLowerCase();
      
      const newProducts = isSelected
        ? prev.filter(id => id !== productId)
        : [...prev, productId];

      // If adding Inbound product, initialize with default values
      const isInbound = productName?.includes('inbound') || 
                       productId === (process.env.REACT_APP_INBOUND_DB_ID || '').trim() ||
                       productId === (process.env.INBOUND_DB_ID || '').trim() ||
                       productId === '1e27e1d8-2c82-408c-89c3-ecab9f608cc8' ||
                       productId === 'fec12233-0a0b-438b-99a5-ad7de950727a';

      if (!isSelected && isInbound) {
        setProductSettings(prevSettings => {
          if (!prevSettings[productId]) {
            return {
              ...prevSettings,
              [productId]: {
                balance: 0,
                low_credit_threshold: 10,
                auto_topup_enabled: false,
                auto_topup_amount: 50,
                auto_topup_threshold: 10
              }
            };
          }
          return prevSettings;
        });
      }

      // If adding genie product, initialize with default values
      if (!isSelected && (productName === 'genie' || productName === 'genie_outbound')) {
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

      // Clean up productSettings if product is removed
      if (isSelected) {
        setProductSettings(prevSettings => {
          const newSettings = { ...prevSettings };
          delete newSettings[productId];
          return newSettings;
        });
      }

      return newProducts;
    });
  };

  // Check if product is selected
  const isProductSelected = (productId) => {
    return selectedProducts.includes(productId);
  };

  // Default settings for products
  const DEFAULT_SETTINGS = {
    genie: {
      list_limit: 1,
      agent_number: 3,
      vapi_account: 1,
      duration_limit: 60,
      concurrency_limit: 1
    },
    beeba: {
      brands: 3,
      posts: 10,
      analysis: 3,
      images: 10,
      video: 5,
      carasoul: 5
    }
  };

  // Handle product settings change
  const handleProductSettingChange = (productId, field, value) => {
    setProductSettings(prev => {
      let processedValue;
      if (value === '') {
        processedValue = undefined;
      } else if (field === 'vapi_account') {
        // VAPI account is a UUID string, not an integer
        processedValue = value;
      } else if (field === 'agent_number' || field === 'duration_limit' || field === 'list_limit' || field === 'concurrency_limit' || field === 'brands' || field === 'posts' || field === 'analysis' || field === 'images' || field === 'video' || field === 'carasoul') {
        // These are numeric fields
        const parsed = parseInt(value);
        processedValue = isNaN(parsed) ? undefined : parsed;
      } else {
        processedValue = value;
      }

      // Determine which defaults to use
      let defaults = {};
      const genieId = getGenieProductId();
      const beebaId = getBeebaProductId();

      if (String(productId) === String(genieId)) {
        defaults = DEFAULT_SETTINGS.genie;
      } else if (String(productId) === String(beebaId)) {
        defaults = DEFAULT_SETTINGS.beeba;
      }

      const newSettings = {
        ...prev,
        [productId]: {
          ...defaults,
          ...(prev[productId] || prev[String(productId)] || {}),
          [field]: processedValue
        }
      };
      return newSettings;
    });
  };
  // Get Inbound product ID (helper function)
  const getInboundProductId = () => {
    const inboundEnvId = (process.env.REACT_APP_INBOUND_DB_ID || '').trim() || 
                        (process.env.INBOUND_DB_ID || '').trim() || 
                        '1e27e1d8-2c82-408c-89c3-ecab9f608cc8';
    
    const envIds = [inboundEnvId, 'fec12233-0a0b-438b-99a5-ad7de950727a'].filter(id => id && id.length > 5);

    // Find if any selected product is an Inbound product
    const foundId = selectedProducts.find(productId => {
      if (envIds.includes(productId)) return true;
      const product = products.find(p => p.id === productId);
      if (product && product.name) {
        const name = product.name.toLowerCase();
        return name.includes('inbound');
      }
      return false;
    });

    return foundId || null;
  };

  // Check if legacy genie product is selected
  const getGenieProductId = () => {
    const inboundId = getInboundProductId();
    return selectedProducts.find(productId => {
      if (inboundId && productId === inboundId) return false;
      const product = products.find(p => p.id === productId);
      if (product && product.name) {
        const name = product.name.toLowerCase();
        return name.includes('genie') && !name.includes('inbound');
      }
      return false;
    });
  };

  // Check if Inbound product is selected (backward compatibility)
  const isInboundProductSelected = () => {
    return !!getInboundProductId();
  };

  // Check if Genie product is selected (backward compatibility)
  const isGenieProductSelected = () => {
    return !!getGenieProductId();
  };

  // Get Beeba product ID (helper function)
  const getBeebaProductId = () => {
    // Find the Beeba product ID from products list
    const beebaProduct = products.find(p => p.name && p.name.toLowerCase() === 'beeba');
    const foundId = beebaProduct?.id || selectedProducts.find(id => {
      const product = products.find(p => p.id === id);
      return product?.name && product.name.toLowerCase() === 'beeba';
    });

    // Also check if any selected product has settings, even if not named "beeba"
    if (!foundId && selectedProducts.length > 0 && Object.keys(productSettings).length > 0) {
      // Find first selected product that has beeba settings
      const productWithSettings = selectedProducts.find(id => {
        const idStr = String(id);
        const settings = productSettings[idStr] || productSettings[id];
        return settings && (settings.brands !== undefined || settings.posts !== undefined || settings.analysis !== undefined || settings.images !== undefined || settings.video !== undefined || settings.carasoul !== undefined);
      });
      if (productWithSettings) {
        return productWithSettings;
      }
    }

    return foundId;
  };

  // Check if Beeba product is selected
  const isBeebaProductSelected = () => {
    const beebaProductId = getBeebaProductId();
    return beebaProductId && selectedProducts.includes(beebaProductId);
  };

  // Check if user is admin or superadmin (only they can see Genie and Beeba Product Settings)
  const isAdmin = hasRole(profile?.role, 'admin');
  const isSuperAdmin = profile?.is_systemadmin === true;
  const canViewGenieSettings = isAdmin || isSuperAdmin;
  const canViewBeebaSettings = isAdmin || isSuperAdmin;

  // Handle role change
  const handleRoleChange = (roleValue) => {
    setFormData(prev => {
      const currentRoles = prev.roles || ['consumer'];
      const isSelected = currentRoles.includes(roleValue);

      let newRoles;
      if (isSelected) {
        // Remove role if already selected
        newRoles = currentRoles.filter(r => r !== roleValue);
        // Ensure at least consumer is selected (since this is update consumer form)
        if (newRoles.length === 0 || !newRoles.includes('consumer')) {
          newRoles = ['consumer'];
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
          subscribed_packages: [],
          trial_expiry_date: ''
        } : {})
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }
    // if(!formData.subscribed_packages || formData.subscribed_packages.length === 0) {
    //   newErrors.subscribed_packages = 'At least one package is required';
    // }

    // Products validation (required when consumer role is selected)
    if (isConsumerSelected && (!selectedProducts || selectedProducts.length === 0)) {
      newErrors.products = 'At least one product is required';
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
    console.log(newErrors);

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleSubmit = () => {
    const validationResult = validateForm();
    if (!validationResult.isValid) {
      toast.error('Please fix the errors above');
      
      // Scroll to first error field
      setTimeout(() => {
        const errorFields = [
          { selector: 'input[name="full_name"]', errorKey: 'full_name' },
          { selector: 'input[name="nickname"]', errorKey: 'nickname' },
          { selector: 'input[placeholder*="Search country"]', errorKey: 'country' },
          { selector: 'input[name="city"]', errorKey: 'city' },
          { selector: 'input[name="phone"]', errorKey: 'phone' }
        ];
        
        for (const { selector, errorKey } of errorFields) {
          if (validationResult.errors[errorKey]) {
            const field = document.querySelector(selector);
            if (field) {
              // Scroll the field into view within the modal
              field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
              // Don't focus country field as it has special behavior
              if (errorKey !== 'country') {
                field.focus();
              }
              break;
            }
          }
        }
      }, 100);
      
      return;
    }

    if (validationResult.isValid) {
      // Combine country code with phone number
      const fullPhone = selectedCountry && formData.phone
        ? `${selectedCountry.phoneCode} ${formData.phone.trim()}`
        : formData.phone.trim() || null;

      // Build updateData without spreading consumer to avoid including old subscribed_products
      const updateData = {
        user_id: consumer?.user_id || consumer?.id, // Include user_id for the API call
        id: consumer?.id || consumer?.user_id, // Include id as well for compatibility
        full_name: formData.full_name.trim(),
        phone: fullPhone,
        trial_expiry_date: formData.trial_expiry_date || null,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        roles: formData.roles || ['consumer'], // Send roles array
        nickname: formData.nickname ? formData.nickname.trim() : null
      };

      // Always include subscribed_packages (even if empty array)
      updateData.subscribed_packages = formData.subscribed_packages || [];

      // Include subscribed_products if any products are selected
      if (selectedProducts.length > 0) {
        updateData.subscribed_products = selectedProducts;
      } else {
        // Send empty array to clear products if none are selected
        updateData.subscribed_products = [];
      }

      // Include productSettings if any settings are configured
      // Check if productSettings has any non-empty values
      const hasProductSettings = Object.keys(productSettings).some(productId => {
        const settings = productSettings[productId];
        return settings && Object.values(settings).some(value => value !== undefined && value !== null && value !== '');
      });

      if (hasProductSettings) {
        updateData.productSettings = productSettings;
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
            Update Consumer
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
            backgroundColor: '#f0fdf4',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid #86efac'
          }}>
            <User size={18} style={{ color: '#16a34a' }} />
            <div>
              <div style={{
                fontSize: '12px',
                color: '#166534',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Consumer ID
              </div>
              <div style={{
                fontSize: '14px',
                color: '#111827',
                fontWeight: '600',
                marginTop: '4px',
                fontFamily: 'monospace'
              }}>
                #{consumer?.id?.toString().slice(0, 8) || consumer?.user_id?.toString().slice(0, 8) || '-'}
              </div>
            </div>
          </div>

          {/* Full Name Field */}
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
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter full name"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.full_name ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!errors.full_name) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.full_name ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            {errors.full_name && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.full_name}
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
            {formData.roles && formData.roles.length > 0 && (
              <p style={{
                color: '#6b7280',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                Selected: {formData.roles.join(', ')}
              </p>
            )}
          </div>

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

          {/* Products Section (for reference/display only) */}
          {isConsumerSelected && (
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
                Products <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => setShowProductsDropdown(!showProductsDropdown)}
                  style={{
                    width: '100%',
                    minHeight: '42px',
                    padding: '8px 40px 8px 12px',
                    border: errors.products ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!errors.products) {
                      e.currentTarget.style.borderColor = '#74317e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = errors.products ? '#ef4444' : '#d1d5db';
                  }}
                >
                  {loadingProducts ? (
                    <span style={{ color: '#9ca3af' }}>Loading products...</span>
                  ) : selectedProducts.length === 0 ? (
                    <span style={{ color: '#9ca3af' }}>Select products (Select at least one product)...</span>
                  ) : (
                    selectedProducts.map(productId => {
                      const product = products.find(p => p.id === productId);
                      return (
                        <span
                          key={productId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#74317e',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          {product?.name}
                          <X
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductToggle(productId);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </span>
                      );
                    })
                  )}
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                  }}>
                    <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                  </div>
                </div>

                {/* Products Dropdown */}
                {showProductsDropdown && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                      }}
                      onClick={() => setShowProductsDropdown(false)}
                    />
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
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}
                    >
                      {loadingProducts ? (
                        <div style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af' }}>
                          Loading products...
                        </div>
                      ) : products.length === 0 ? (
                        <div style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af' }}>
                          No products available
                        </div>
                      ) : (
                        products.map((product) => (
                          <div
                            key={product.id}
                            onClick={(e) => { e.stopPropagation(); handleProductToggle(product.id); }}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              transition: 'background-color 0.2s',
                              backgroundColor: isProductSelected(product.id) ? '#eff6ff' : 'white'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isProductSelected(product.id) ? '#dbeafe' : '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isProductSelected(product.id) ? '#eff6ff' : 'white';
                            }}
                          >
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                border: isProductSelected(product.id) ? '2px solid #74317e' : '2px solid #d1d5db',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isProductSelected(product.id) ? '#74317e' : 'white',
                                transition: 'all 0.2s'
                              }}
                            >
                              {isProductSelected(product.id) && (
                                <CheckCircle size={12} style={{ color: 'white' }} />
                              )}
                            </div>
                            <span style={{
                              fontSize: '14px',
                              color: '#374151',
                              fontWeight: isProductSelected(product.id) ? '500' : '400'
                            }}>
                              {product.name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              {errors.products && (
                <p style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0
                }}>
                  {errors.products}
                </p>
              )}
              {!errors.products && selectedProducts.length > 0 && (
                <p style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '16px' }}>ℹ️</span>
                  {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Genie Inbound Settings (Credit management display) */}
          {isConsumerSelected && isInboundProductSelected() && canViewGenieSettings && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f5f3ff',
              borderRadius: '8px',
              border: '1px solid #ddd6fe'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#7c3aed',
                marginBottom: '12px'
              }}>
                <Coins size={16} />
                Inbound Genie Settings
              </label>
              
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                This user has an active Inbound Genie product. You can manage their credit balance, 
                auto-topup settings, and subscribed packages using the management tool.
              </p>

              <button
                type="button"
                onClick={() => setShowCreditsModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #7c3aed',
                  borderRadius: '6px',
                  color: '#7c3aed',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f3ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <CreditCard size={14} />
                Manage Inbound Credits
              </button>
            </div>
          )}

          {/* Legacy Genie Product Settings Section */}
          {isConsumerSelected && isGenieProductSelected() && canViewGenieSettings && (
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
                // Try to find settings using both string and original ID format
                const genieProductIdStr = genieProductId ? String(genieProductId) : null;
                const settings = genieProductIdStr
                  ? (productSettings[genieProductIdStr] || productSettings[genieProductId] || DEFAULT_SETTINGS.genie)
                  : DEFAULT_SETTINGS.genie;

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
                          value={settings.vapi_account ? String(settings.vapi_account) : ''}
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
                              <option key={account.id} value={String(account.id)}>
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
          {isConsumerSelected && isBeebaProductSelected() && canViewBeebaSettings && (
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
                // Try to find settings using both string and original ID format
                const beebaProductIdStr = beebaProductId ? String(beebaProductId) : null;
                const settings = beebaProductIdStr
                  ? (productSettings[beebaProductIdStr] || productSettings[beebaProductId] || DEFAULT_SETTINGS.beeba)
                  : DEFAULT_SETTINGS.beeba;

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

          {/* Subscribed Packages Field (Multi-select) */}
          {/* <div style={{ marginBottom: '20px' }}> */}
          {/* <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              <Package size={16} style={{ color: '#74317e' }} />
              <span style={{ fontWeight: '600', color: '#374151' }}>Subscribed Packages</span>
              <span style={{ color: '#ef4444', fontWeight: '500', fontSize: '12px' }}>*</span>
              <span style={{ color: '#6b7280', fontWeight: '400', fontSize: '12px' }}>(Select packages to subscribe - this is what gets saved to database)</span>
            </label> */}
          {/* <div style={{ position: 'relative' }}> */}
          {/* <div
                onClick={() => setShowPackagesDropdown(!showPackagesDropdown)}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '8px 40px 8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#74317e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                {loadingPackages ? (
                  <span style={{ color: '#9ca3af' }}>Loading packages...</span>
                ) : formData.subscribed_packages.length === 0 ? (
                  <span style={{ color: '#9ca3af' }}>Select packages...</span>
                ) : (
                  formData.subscribed_packages.map(packageId => {
                    const pkg = packages.find(p => p.id === packageId);
                    return (
                      <span
                        key={packageId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          backgroundColor: '#74317e',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}
                      >
                        {pkg?.name || 'Unknown Package'}
                        <X
                          size={14}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePackageToggle(packageId);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </span>
                    );
                  })
                )}
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}>
                  <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                </div>
              </div> */}

          {/* Packages Dropdown */}
          {/* {showPackagesDropdown && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 999
                    }}
                    onClick={() => setShowPackagesDropdown(false)}
                  />
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
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}
                  >
                    {loadingPackages ? (
                      <div style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af' }}>
                        Loading packages...
                      </div>
                    ) : packages.length === 0 ? (
                      <div style={{ padding: '10px 12px', textAlign: 'center', color: '#9ca3af' }}>
                        No packages available
                      </div>
                    ) : (
                      packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePackageToggle(pkg.id);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'background-color 0.2s',
                          backgroundColor: isPackageSelected(pkg.id) ? '#eff6ff' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isPackageSelected(pkg.id) ? '#dbeafe' : '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isPackageSelected(pkg.id) ? '#eff6ff' : 'white';
                        }}
                      >
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            border: isPackageSelected(pkg.id) ? '2px solid #74317e' : '2px solid #d1d5db',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isPackageSelected(pkg.id) ? '#74317e' : 'white',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isPackageSelected(pkg.id) && (
                            <CheckCircle size={12} style={{ color: 'white' }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: '14px',
                            color: '#374151',
                            fontWeight: isPackageSelected(pkg.id) ? '500' : '400'
                          }}>
                            {pkg.name}
                          </span>
                          {pkg.products?.name && (
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginTop: '2px'
                            }}>
                              Product: {pkg.products.name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                </>
              )} */}
          {/* </div> */}
          {/* {formData.subscribed_packages.length > 0 && (
                <p style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  marginTop: '6px',
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '16px' }}>ℹ️</span>
                  {formData.subscribed_packages.length} package{formData.subscribed_packages.length !== 1 ? 's' : ''} selected
                </p>
              )} */}
          {/* </div> */}

          {/* Email Display (Read-only) */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500',
              marginBottom: '4px'
            }}>
              Email Address (Read-only)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#111827',
              fontWeight: '500'
            }}>
              {consumer?.email || 'No email'}
            </div>
          </div>

          {/* Created At Display */}
          {consumer?.created_at && (
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
                Created on {new Date(consumer.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          )}

          {/* Credits Management Section */}
          {(isGenieProductSelected() || isInboundProductSelected()) && isAdmin && (
            <div style={{
              marginTop: '16px',
              marginBottom: '20px',
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
                  backgroundColor: isInboundProductSelected() ? '#7c3aed' : '#74317e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{isInboundProductSelected() ? 'Inbound Credit Management' : 'Genie Credit Management'}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                    Manage balance and package subscriptions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditsModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  border: `1px solid ${isInboundProductSelected() ? '#7c3aed' : '#74317e'}`,
                  borderRadius: '6px',
                  color: isInboundProductSelected() ? '#7c3aed' : '#74317e',
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

          {/* Credits Modal Integration */}
          {showCreditsModal && (consumer?.id || consumer?.user_id) && (
            <CreditsModal
              isOpen={showCreditsModal}
              onClose={() => setShowCreditsModal(false)}
              userId={consumer?.id || consumer?.user_id}
              productId={getInboundProductId() || getGenieProductId()}
              userName={formData.full_name || 'Consumer'}
            />
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
            Update Consumer
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateConsumerModal;

