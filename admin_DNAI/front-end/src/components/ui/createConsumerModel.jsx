import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, Phone, Calendar, CheckCircle, AlertCircle, MapPin, Globe, ChevronDown, RefreshCw, Eye, Users, Package, Shield, CloudCog, EyeOff, Tag, CreditCard, Coins, Check } from 'lucide-react';
import CreditsModal from './CreditsModal';
import { countries, searchCountries } from '../../utils/countryData';
import { generatePassword } from '../../utils/passwordGenerator';
import { getResellers, getProducts } from '../../api/backend';
import { getAllPackages } from '../../api/backend/packages';
import { getAllVapiAccounts } from '../../api/backend/vapi';
import { useAuth } from '../../hooks/useAuth';
import { hasRole } from '../../utils/roleUtils';
import toast from 'react-hot-toast';

const CreateConsumerModal = ({ isOpen, onClose, onCreate }) => {
  const { profile } = useAuth();
  const userRole = profile?.role || 'admin';
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    roles: ['consumer'], // Default to consumer, but allow reseller too
    phone: '',
    trial_expiry_date: '',
    country: '',
    city: '',
    referred_by: '',
    subscribed_packages: [],
    nickname: ''
  });

  // Separate state for products (for display/reference only)
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Product settings state - stores settings per product ID
  const [productSettings, setProductSettings] = useState({});

  // VAPI accounts state
  const [vapiAccounts, setVapiAccounts] = useState([]);
  const [loadingVapiAccounts, setLoadingVapiAccounts] = useState(false);

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showProductsDropdown, setShowProductsDropdown] = useState(false);
  const [resellers, setResellers] = useState([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [resellerSearchTerm, setResellerSearchTerm] = useState('');
  const [showResellerSuggestions, setShowResellerSuggestions] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [activePackageDropdown, setActivePackageDropdown] = useState(null); // 'inbound', 'genie', 'beeba', or null

  // Check if inbound product is selected
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

  const isInboundProductSelected = !!getInboundProductId();
  const isGenieProductSelected = !!getGenieProductId();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || hasRole(profile?.role, 'admin');
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.is_systemadmin === true;
  const canViewGenieSettings = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (isOpen) {
      console.log('🔍 Create Modal Env Check:', {
        REACT_APP_INBOUND_DB_ID: process.env.REACT_APP_INBOUND_DB_ID,
        INBOUND_DB_ID: process.env.INBOUND_DB_ID,
        ResolvedInboundId: getInboundProductId()
      });
    }
  }, [isOpen]);

  // Check if beeba product is selected (case-insensitive) - must be after products state is declared
  const isBeebaProductSelected = selectedProducts.some(productId => {
    const product = products.find(p => p.id === productId);
    return product && product.name && product.name.toLowerCase() === 'beeba';
  });

  const canViewBeebaSettings = isAdmin || isSuperAdmin;

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [createdUserId, setCreatedUserId] = useState(null);

  // Fetch products, packages, and VAPI accounts when modal opens and consumer role is selected
  useEffect(() => {
    if (isOpen && isConsumerSelected) {
      const fetchData = async () => {
        // Fetch products
        setLoadingProducts(true);
        try {
          const result = await getProducts();
          console.log('Fetched products:', result);
          if (result && result.success && result.data && Array.isArray(result.data)) {
            setProducts(result.data);
            console.log('Products set:', result.data.length);
          } else if (result && result.error) {
            console.error('Error from getProducts:', result.error);
          }
        } catch (error) {
          console.error('Error fetching products:', error);
        } finally {
          setLoadingProducts(false);
        }

        // Fetch packages
        setLoadingPackages(true);
        try {
          const packagesResult = await getAllPackages();
          console.log('📦 DEBUG: Fetched packages result:', packagesResult);
          if (packagesResult && packagesResult.success && packagesResult.data && Array.isArray(packagesResult.data)) {
            setPackages(packagesResult.data);
            console.log('📦 DEBUG: Packages set in state:', packagesResult.data.length);
            console.log('📦 DEBUG: Sample package:', packagesResult.data[0]);
          } else if (packagesResult && packagesResult.error) {
            console.error('❌ DEBUG: Error from getAllPackages:', packagesResult.error);
          }
        } catch (error) {
          console.error('Error fetching packages:', error);
        } finally {
          setLoadingPackages(false);
        }

        // Fetch VAPI accounts
        setLoadingVapiAccounts(true);
        try {
          const vapiResult = await getAllVapiAccounts();
          console.log('Fetched VAPI accounts:', vapiResult);
          if (vapiResult && vapiResult.success && vapiResult.data && Array.isArray(vapiResult.data)) {
            setVapiAccounts(vapiResult.data);
            console.log('VAPI accounts set:', vapiResult.data.length);
          } else if (vapiResult && vapiResult.error) {
            console.error('Error from getAllVapiAccounts:', vapiResult.error);
          }
        } catch (error) {
          console.error('Error fetching VAPI accounts:', error);
        } finally {
          setLoadingVapiAccounts(false);
        }
      };

      fetchData();
    }
  }, [isOpen, isConsumerSelected]);

  // Ensure consumer role is selected when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => {
        const currentRoles = prev.roles || [];
        if (!currentRoles.includes('consumer')) {
          return {
            ...prev,
            roles: ['consumer', ...currentRoles]
          };
        }
        return prev;
      });
    }
  }, [isOpen]);

  // Search resellers when user types 2+ characters
  useEffect(() => {
    if (resellerSearchTerm.length >= 2) {
      const fetchResellers = async () => {
        setLoadingResellers(true);
        try {
          const result = await getResellers({ search: resellerSearchTerm });
          console.log('🔍 Resellers search result:', result);
          if (result && !result.error) {
            // Ensure we have an array of resellers
            let resellersList = [];
            if (Array.isArray(result)) {
              resellersList = result;
            } else if (result.data && Array.isArray(result.data)) {
              resellersList = result.data;
            } else if (result.success && Array.isArray(result.data)) {
              resellersList = result.data;
            }
            console.log('📋 Resellers list:', resellersList);
            console.log('📋 First reseller:', resellersList[0]);
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
      }, 300); // Debounce search

      return () => clearTimeout(debounceTimer);
    } else {
      setResellers([]);
      setShowResellerSuggestions(false);
    }
  }, [resellerSearchTerm]);

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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showResellerSuggestions && !event.target.closest('.reseller-search-container')) {
        setShowResellerSuggestions(false);
      }
    };

    if (showResellerSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showResellerSuggestions]);

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

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(12);
    setFormData(prev => ({
      ...prev,
      password: newPassword,
      confirmPassword: newPassword
    }));
    if (errors.password || errors.confirmPassword) {
      setErrors(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));
    }
    // Clear submit message
    if (submitMessage.text) {
      setSubmitMessage({ type: '', text: '' });
    }
  };

  // Handle product selection (for display/reference only)
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
      const newProducts = isSelected
        ? prev.filter(id => id !== productId)
        : [...prev, productId];

      const product = products.find(p => p.id === productId);
      const productName = product?.name?.toLowerCase();

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
          // Only set defaults if settings don't already exist for this product
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
          // Only set defaults if settings don't already exist for this product
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

      return newProducts;
    });
  };

  // Handle product settings change
  const handleProductSettingChange = (productId, field, value) => {
    setProductSettings(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value === '' ? undefined : (
          field === 'vapi_account' ||
            field === 'agent_number' ||
            field === 'duration_limit' ||
            field === 'list_limit' ||
            field === 'concurrency_limit' ||
            field === 'brands' ||
            field === 'posts' ||
            field === 'analysis' ||
            field === 'images' ||
            field === 'video' ||
            field === 'carasoul' ||
            field === 'balance' ||
            field === 'low_credit_threshold' ||
            field === 'auto_topup_amount' ||
            field === 'auto_topup_threshold'
            ? parseFloat(value) || 0
            : value
        )
      }
    }));
  };


  // Get beeba product ID
  const getBeebaProductId = () => {
    return selectedProducts.find(productId => {
      const product = products.find(p => p.id === productId);
      return product && product.name && product.name.toLowerCase() === 'beeba';
    });
  };

  // Check if product is selected
  const isProductSelected = (productId) => {
    return selectedProducts.includes(productId);
  };

  // Handle package selection
  const handlePackageToggle = (packageId) => {
    console.log('📦 Package toggled:', packageId);
    
    // Find the package object to check for credits
    const packageItem = packages.find(p => p.id === packageId);
    
    setFormData(prev => {
      const isSelecting = !prev.subscribed_packages.includes(packageId);
      const nextPackages = isSelecting
        ? [...prev.subscribed_packages, packageId]
        : prev.subscribed_packages.filter(id => id !== packageId);

      console.log('📋 Current subscribed packages array:', nextPackages);
      
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
        subscribed_packages: nextPackages
      };
    });
  };

  // Check if package is selected
  const isPackageSelected = (packageId) => {
    return formData.subscribed_packages.includes(packageId);
  };

  // Handle role change
  const handleRoleChange = (roleValue) => {
    setFormData(prev => {
      const currentRoles = prev.roles || ['consumer'];
      const isSelected = currentRoles.includes(roleValue);

      let newRoles;
      if (isSelected) {
        // Remove role if already selected
        newRoles = currentRoles.filter(r => r !== roleValue);
        // Ensure at least consumer is selected (since this is create consumer form)
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
          referred_by: '',
          subscribed_packages: [],
          trial_expiry_date: ''
        } : {})
      };
    });

    // Clear error for roles when user makes a selection
    if (errors.roles) {
      setErrors(prev => ({
        ...prev,
        roles: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const selectedCountryName = selectedCountry?.name || '';
    const countryValue = (formData.country || selectedCountryName).trim();
    if (!formData.roles || formData.roles.length === 0) {
      newErrors.roles = 'At least one role is required';
    }
    // if(!formData.subscribed_packages || formData.subscribed_packages.length === 0) {
    //   newErrors.subscribed_packages = 'At least one package is required';
    // }

    // Full Name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Confirm Password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Country validation
    if (!countryValue) {
      newErrors.country = 'Country is required';
    }

    // City validation (optional)
    // No validation needed - city is optional

    // Roles validation
    if (!formData.roles || formData.roles.length === 0) {
      newErrors.roles = 'At least one role is required';
    }

    // Consumer-specific validations
    if (formData.roles?.includes('consumer')) {
      // Products validation (required for consumer)
      if (!selectedProducts || selectedProducts.length === 0) {
        newErrors.products = 'At least one product is required';
      }

      // Trial Period validation (required for consumer)
      if (!formData.trial_expiry_date) {
        newErrors.trial_expiry_date = 'Trial period is required for consumers';
      }
    }

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
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleSubmit = async () => {
    const validationResult = validateForm();
    if (!validationResult.isValid) {
      toast.error('Please fix the errors above');
      setSubmitMessage({ type: 'error', text: 'Please fix the errors above' });
      console.log('Validation failed. Errors:', validationResult.errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });

    try {
      // Combine country code with phone number
      const fullPhone = selectedCountry && formData.phone
        ? `${selectedCountry.phoneCode} ${formData.phone.trim()}`
        : formData.phone.trim() || null;

      // Calculate trial expiry date from selected days
      let trialExpiryDate = null;
      if (formData.trial_expiry_date) {
        const days = parseInt(formData.trial_expiry_date);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        trialExpiryDate = expiryDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      }

      // Logic: If reseller is assigned, use that reseller ID
      // If no reseller assigned, use the logged-in user from token
      const referredBy = (formData.referred_by && formData.referred_by !== '')
        ? formData.referred_by
        : (selectedReseller?.user_id || profile?.id || profile?.user_id || null);

      console.log('🔍 Creating consumer with referred_by:', {
        selectedReseller: selectedReseller,
        selectedResellerId: selectedReseller?.user_id,
        profile: profile,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
        formDataReferredBy: formData.referred_by,
        finalReferredBy: referredBy
      });

      const result = await onCreate({
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        roles: formData.roles || ['consumer'], // Send roles array
        phone: fullPhone,
        trial_expiry_date: trialExpiryDate,
        country: (formData.country || selectedCountry?.name || '').trim() || null,
        city: formData.city.trim() || null,
        referred_by: referredBy,
        subscribed_packages: formData.subscribed_packages,
        subscribed_products: selectedProducts.length > 0 ? selectedProducts : [],
        productSettings: Object.keys(productSettings).length > 0 ? productSettings : undefined,
        nickname: formData.nickname ? formData.nickname.trim() : null
      });

      if (result.success) {
        setSubmitMessage({ type: 'success', text: 'Consumer created successfully!' });

        // Store created user ID for credit management
        if (result.user && result.user.id) {
          setCreatedUserId(result.user.id);
        }

        // Reset form but keep createdUserId for the credits modal
        setTimeout(() => {
          setFormData({
            full_name: '',
            email: '',
            password: '',
            confirmPassword: '',
            roles: ['consumer'],
            phone: '',
            trial_expiry_date: '',
            country: '',
            city: '',
            referred_by: '',
            subscribed_packages: [],
            nickname: ''
          });
          setSelectedProducts([]);
          setProductSettings({});
          setSelectedReseller(null);
          setResellerSearchTerm('');
          setShowResellerSuggestions(false);
          setSelectedCountry(null);
          setCountrySearch('');
          setShowPassword(false);
          setShowConfirmPassword(false);
          setSubmitMessage({ type: '', text: '' });
          // If Genie product was selected, we might want to keep the ID or handle it differently
          // For now, let's follow the original flow and close
          onClose();
        }, 1500);
      } else {
        setSubmitMessage({ type: 'error', text: result.error || 'Failed to create consumer' });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Don't reset form data - retain values when modal is hidden
      // Only clear errors and submit messages
      setErrors({});
      setSubmitMessage({ type: '', text: '' });
      setShowProductsDropdown(false);
      setShowResellerSuggestions(false);
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
            color: '#111827'
          }}>
            Create New Consumer
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
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#111827';
              }
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
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.full_name ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.full_name && !isSubmitting) {
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
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.nickname ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  backgroundColor: isSubmitting ? '#f9fafb' : 'white'
                }}
                onFocus={(e) => {
                  if (!errors.nickname && !isSubmitting) {
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

          {/* Email Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.email ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.email && !isSubmitting) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.email ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            {errors.email && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                disabled={isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',

                  gap: '4px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  color: '#74317e',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #74317e',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dbeafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
              >
                <RefreshCw size={12} />
                Generate
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password (min. 6 characters)"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 40px',
                  border: errors.password ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.password && !isSubmitting) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.password ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
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
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {errors.password && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Confirm Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 40px',
                  border: errors.confirmPassword ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.confirmPassword && !isSubmitting) {
                    e.target.style.borderColor = '#74317e';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.confirmPassword ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isSubmitting}
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
                {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '6px',
                marginBottom: 0
              }}>
                {errors.confirmPassword}
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
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s',
                        opacity: isSubmitting ? 0.6 : 1,
                        backgroundColor: isChecked ? '#f3f4f6' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSubmitting) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
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
                        disabled={isSubmitting}
                        style={{
                          width: '18px',
                          height: '18px',
                          marginRight: '12px',
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
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
                disabled={isSubmitting}
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
                  opacity: isSubmitting ? 0.6 : 1,
                  cursor: selectedCountry ? 'pointer' : 'text',
                  backgroundColor: selectedCountry ? '#f9fafb' : 'white'
                }}
                onFocusCapture={(e) => {
                  if (!errors.country && !isSubmitting) {
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
                    setFormData(prev => ({ ...prev, country: '', phone: '' }));
                    setShowCountryDropdown(true);
                  }}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
              {showCountryDropdown && !isSubmitting && !selectedCountry && (
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
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: errors.city ? '1px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (!errors.city && !isSubmitting) {
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

          {/* Phone Field (Optional) */}
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
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: errors.phone ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  onFocus={(e) => {
                    // If no country is selected, open the country dropdown
                    if (!selectedCountry && !isSubmitting) {
                      setShowCountryDropdown(true);
                      e.target.blur(); // Remove focus from phone field
                      // Scroll to country field
                      const countrySection = document.querySelector('input[placeholder*="Search country"]');
                      if (countrySection) {
                        countrySection.focus();
                        countrySection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    } else if (!errors.phone && !isSubmitting) {
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

          {/* Consumer-specific fields - only show when consumer role is selected */}
          {isConsumerSelected && (
            <>
              {/* Reseller Field (Optional) - Only for Admin */}
              {userRole === 'admin' && (
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
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        opacity: isSubmitting ? 0.6 : 1,
                        backgroundColor: 'white',
                        cursor: isSubmitting ? 'not-allowed' : 'text',
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
                                console.log('🎯 Reseller selected:', reseller);
                                setSelectedReseller(reseller);
                                setFormData(prev => {
                                  console.log('📝 Setting referred_by to:', reseller.user_id);
                                  return { ...prev, referred_by: reseller.user_id };
                                });
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
                      marginBottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '16px' }}>ℹ️</span>
                      This consumer will be assigned to: {selectedReseller.full_name}
                    </p>
                  )}
                </div>
              )}

              {/* Products Section (for reference/display only) */}
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
                    onClick={() => !isSubmitting && setShowProductsDropdown(!showProductsDropdown)}
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
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      alignItems: 'center',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting && !errors.products) {
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
                      <span style={{ color: '#9ca3af' }}>Select products (optional)...</span>
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
                                if (!isSubmitting) handleProductToggle(productId);
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
                  {showProductsDropdown && !isSubmitting && (
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
                            onClick={() => handleProductToggle(product.id)}
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
                    {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected (for reference only)
                  </p>
                )}
              </div>
              {formData.subscribed_packages.length > 0 && (
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
              )}

              {/* Genie Inbound Settings (Initial Credit Configuration) */}
              {isInboundProductSelected && canViewGenieSettings && (
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
                  
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                    Configure the initial credit settings and subscription for this consumer. 
                  </p>

                  {(() => {
                    const inboundId = getInboundProductId();
                    const settings = productSettings[inboundId] || {
                      balance: 0,
                      low_credit_threshold: 10,
                      auto_topup_enabled: false,
                      auto_topup_amount: 50,
                      auto_topup_threshold: 10
                    };

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          {/* Starting Balance */}
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                              Starting Balance ($)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={settings.balance || 0}
                              onChange={(e) => handleProductSettingChange(inboundId, 'balance', e.target.value)}
                              disabled={isSubmitting}
                              style={{ 
                                width: '100%', 
                                padding: '8px 12px', 
                                border: '1px solid #d1d5db', 
                                borderRadius: '6px', 
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'all 0.2s'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#7c3aed';
                                e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#d1d5db';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>

                          {/* Low Credit Threshold */}
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                              Low Credit Alert ($)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={settings.low_credit_threshold || 10}
                              onChange={(e) => handleProductSettingChange(inboundId, 'low_credit_threshold', e.target.value)}
                              disabled={isSubmitting}
                              style={{ 
                                width: '100%', 
                                padding: '8px 12px', 
                                border: '1px solid #d1d5db', 
                                borderRadius: '6px', 
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'all 0.2s'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#7c3aed';
                                e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#d1d5db';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>
                        </div>

                        {/* Auto Top-up Toggle */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px', 
                          padding: '12px', 
                          backgroundColor: 'white', 
                          borderRadius: '8px', 
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handleProductSettingChange(inboundId, 'auto_topup_enabled', !settings.auto_topup_enabled)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ddd6fe'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                        >
                          <div style={{
                            width: '20px',
                            height: '20px',
                            border: settings.auto_topup_enabled ? '2px solid #7c3aed' : '2px solid #d1d5db',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: settings.auto_topup_enabled ? '#7c3aed' : 'white',
                            transition: 'all 0.2s'
                          }}>
                            {settings.auto_topup_enabled && <Check size={14} style={{ color: 'white' }} />}
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Enable Auto Top-up
                          </span>
                        </div>

                         {/* Initial Subscription Package */}
                        <div style={{ marginTop: '4px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#7c3aed', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Initial Subscription Package
                          </label>
                          <div style={{ position: 'relative' }}>
                            <div
                              onClick={() => !isSubmitting && setActivePackageDropdown(activePackageDropdown === 'inbound' ? null : 'inbound')}
                              style={{
                                width: '100%',
                                minHeight: '42px',
                                padding: '8px 40px 8px 12px',
                                border: '1px solid #ddd6fe',
                                borderRadius: '8px',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box',
                                backgroundColor: 'white',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                alignItems: 'center',
                                opacity: isSubmitting ? 0.6 : 1
                              }}
                            >
                              {loadingPackages ? (
                                <span style={{ color: '#9ca3af' }}>Loading packages...</span>
                              ) : formData.subscribed_packages.filter(id => {
                                const pkg = packages.find(p => p.id === id);
                                return pkg && (pkg.product_id === inboundId || pkg.product_type === 'inbound');
                              }).length === 0 ? (
                                <span style={{ color: '#9ca3af' }}>Select inbound package (optional)...</span>
                              ) : (
                                formData.subscribed_packages
                                  .filter(id => {
                                    const pkg = packages.find(p => p.id === id);
                                    return pkg && (pkg.product_id === inboundId || pkg.product_type === 'inbound');
                                  })
                                  .map(packageId => {
                                    const packageItem = packages.find(p => p.id === packageId);
                                    return (
                                      <span
                                        key={packageId}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '4px 8px',
                                          backgroundColor: '#7c3aed',
                                          color: 'white',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '500'
                                        }}
                                      >
                                        {packageItem?.name}
                                        <X
                                          size={14}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isSubmitting) handlePackageToggle(packageId);
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

                            {activePackageDropdown === 'inbound' && !isSubmitting && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  marginTop: '4px',
                                  backgroundColor: 'white',
                                  border: '1px solid #ddd6fe',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  zIndex: 1000
                                }}
                              >
                                {(() => {
                                  const filtered = packages.filter(pkg => pkg.product_id === inboundId || pkg.product_type === 'inbound');
                                  console.log('📦 DEBUG: Inbound filtered packages:', { 
                                    inboundId, 
                                    totalPackages: packages.length, 
                                    filteredCount: filtered.length 
                                  });
                                  return filtered.length === 0 ? (
                                    <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                      No packages available for this product
                                    </div>
                                  ) : filtered.map((packageItem) => (
                                    <div
                                      key={packageItem.id}
                                      onClick={() => handlePackageToggle(packageItem.id)}
                                      style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'background-color 0.2s',
                                        backgroundColor: isPackageSelected(packageItem.id) ? '#f5f3ff' : 'white'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isPackageSelected(packageItem.id) ? '#ede9fe' : '#f9fafb';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isPackageSelected(packageItem.id) ? '#f5f3ff' : 'white';
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          border: isPackageSelected(packageItem.id) ? '2px solid #7c3aed' : '2px solid #d1d5db',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: isPackageSelected(packageItem.id) ? '#7c3aed' : 'white'
                                        }}
                                      >
                                        {isPackageSelected(packageItem.id) && (
                                          <Check size={12} style={{ color: 'white' }} />
                                        )}
                                      </div>
                                      <span style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        fontWeight: isPackageSelected(packageItem.id) ? '500' : '400'
                                      }}>
                                        {packageItem.name} - ${packageItem.price}/{packageItem.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                                      </span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {settings.auto_topup_enabled && (
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '16px', 
                            padding: '16px', 
                            backgroundColor: 'white', 
                            borderRadius: '8px', 
                            border: '1px dashed #ddd6fe' 
                          }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#7c3aed', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Top-up Amount ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={settings.auto_topup_amount || 50}
                                onChange={(e) => handleProductSettingChange(inboundId, 'auto_topup_amount', e.target.value)}
                                disabled={isSubmitting}
                                style={{ 
                                  width: '100%', 
                                  padding: '8px 10px', 
                                  border: '1px solid #d1d5db', 
                                  borderRadius: '6px', 
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#7c3aed', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Trigger at ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={settings.auto_topup_threshold || 10}
                                onChange={(e) => handleProductSettingChange(inboundId, 'auto_topup_threshold', e.target.value)}
                                disabled={isSubmitting}
                                style={{ 
                                  width: '100%', 
                                  padding: '8px 10px', 
                                  border: '1px solid #d1d5db', 
                                  borderRadius: '6px', 
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Legacy Genie Product Settings Section */}
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
                              disabled={isSubmitting}
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
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                fontFamily: 'inherit',
                                color: settings.vapi_account ? '#374151' : '#9ca3af',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                paddingRight: '32px'
                              }}
                              onFocus={(e) => {
                                if (!isSubmitting) {
                                  e.target.style.borderColor = '#74317e';
                                  e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                                }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>

                         {/* Initial Subscription Package */}
                        <div style={{ marginTop: '4px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#74317e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Initial Subscription Package
                          </label>
                          <div style={{ position: 'relative' }}>
                            <div
                              onClick={() => !isSubmitting && setActivePackageDropdown(activePackageDropdown === 'genie' ? null : 'genie')}
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
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                alignItems: 'center',
                                opacity: isSubmitting ? 0.6 : 1
                              }}
                            >
                              {loadingPackages ? (
                                <span style={{ color: '#9ca3af' }}>Loading packages...</span>
                              ) : formData.subscribed_packages.filter(id => {
                                const pkg = packages.find(p => p.id === id);
                                return pkg && (pkg.product_id === genieProductId || pkg.product_type === 'genie');
                              }).length === 0 ? (
                                <span style={{ color: '#9ca3af' }}>Select genie package (optional)...</span>
                              ) : (
                                formData.subscribed_packages
                                  .filter(id => {
                                    const pkg = packages.find(p => p.id === id);
                                    return pkg && (pkg.product_id === genieProductId || pkg.product_type === 'genie');
                                  })
                                  .map(packageId => {
                                    const packageItem = packages.find(p => p.id === packageId);
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
                                        {packageItem?.name}
                                        <X
                                          size={14}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isSubmitting) handlePackageToggle(packageId);
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

                            {activePackageDropdown === 'genie' && !isSubmitting && (
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
                                {(() => {
                                  const filtered = packages.filter(pkg => pkg.product_id === genieProductId || pkg.product_type === 'genie');
                                  console.log('📦 DEBUG: Genie filtered packages:', { 
                                    genieProductId, 
                                    totalPackages: packages.length, 
                                    filteredCount: filtered.length 
                                  });
                                  
                                  if (filtered.length === 0) {
                                    return (
                                      <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                        No packages available for this product
                                      </div>
                                    );
                                  }

                                  return filtered.map((packageItem) => (
                                    <div
                                      key={packageItem.id}
                                      onClick={() => handlePackageToggle(packageItem.id)}
                                      style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'background-color 0.2s',
                                        backgroundColor: isPackageSelected(packageItem.id) ? '#eff6ff' : 'white'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isPackageSelected(packageItem.id) ? '#dbeafe' : '#f9fafb';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isPackageSelected(packageItem.id) ? '#eff6ff' : 'white';
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          border: isPackageSelected(packageItem.id) ? '2px solid #74317e' : '2px solid #d1d5db',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: isPackageSelected(packageItem.id) ? '#74317e' : 'white'
                                        }}
                                      >
                                        {isPackageSelected(packageItem.id) && (
                                          <Check size={12} style={{ color: 'white' }} />
                                        )}
                                      </div>
                                      <span style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        fontWeight: isPackageSelected(packageItem.id) ? '500' : '400'
                                      }}>
                                        {packageItem.name} - ${packageItem.price}/{packageItem.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                                      </span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>

                         {/* Initial Subscription Package */}
                        <div style={{ marginTop: '16px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#74317e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Initial Subscription Package
                          </label>
                          <div style={{ position: 'relative' }}>
                            <div
                              onClick={() => !isSubmitting && setActivePackageDropdown(activePackageDropdown === 'beeba' ? null : 'beeba')}
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
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                alignItems: 'center',
                                opacity: isSubmitting ? 0.6 : 1
                              }}
                            >
                              {loadingPackages ? (
                                <span style={{ color: '#9ca3af' }}>Loading packages...</span>
                              ) : formData.subscribed_packages.filter(id => {
                                const pkg = packages.find(p => p.id === id);
                                return pkg && (pkg.product_id === beebaProductId || pkg.product_type === 'beeba');
                              }).length === 0 ? (
                                <span style={{ color: '#9ca3af' }}>Select beeba package (optional)...</span>
                              ) : (
                                formData.subscribed_packages
                                  .filter(id => {
                                    const pkg = packages.find(p => p.id === id);
                                    return pkg && (pkg.product_id === beebaProductId || pkg.product_type === 'beeba');
                                  })
                                  .map(packageId => {
                                    const packageItem = packages.find(p => p.id === packageId);
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
                                        {packageItem?.name}
                                        <X
                                          size={14}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isSubmitting) handlePackageToggle(packageId);
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

                            {activePackageDropdown === 'beeba' && !isSubmitting && (
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
                                {(() => {
                                  const filtered = packages.filter(pkg => pkg.product_id === beebaProductId || pkg.product_type === 'beeba');
                                  console.log('📦 DEBUG: Beeba filtered packages:', { 
                                    beebaProductId, 
                                    totalPackages: packages.length, 
                                    filteredCount: filtered.length 
                                  });
                                  
                                  if (filtered.length === 0) {
                                    return (
                                      <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                        No packages available for this product
                                      </div>
                                    );
                                  }

                                  return filtered.map((packageItem) => (
                                    <div
                                      key={packageItem.id}
                                      onClick={() => handlePackageToggle(packageItem.id)}
                                      style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'background-color 0.2s',
                                        backgroundColor: isPackageSelected(packageItem.id) ? '#eff6ff' : 'white'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isPackageSelected(packageItem.id) ? '#dbeafe' : '#f9fafb';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isPackageSelected(packageItem.id) ? '#eff6ff' : 'white';
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          border: isPackageSelected(packageItem.id) ? '2px solid #74317e' : '2px solid #d1d5db',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: isPackageSelected(packageItem.id) ? '#74317e' : 'white'
                                        }}
                                      >
                                        {isPackageSelected(packageItem.id) && (
                                          <Check size={12} style={{ color: 'white' }} />
                                        )}
                                      </div>
                                      <span style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        fontWeight: isPackageSelected(packageItem.id) ? '500' : '400'
                                      }}>
                                        {packageItem.name} - ${packageItem.price}/{packageItem.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                                      </span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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
                            disabled={isSubmitting}
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
                              backgroundColor: 'white',
                              opacity: isSubmitting ? 0.6 : 1
                            }}
                            onFocus={(e) => {
                              if (!isSubmitting) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
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

              {/* Trial Period Field (Required) */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  <Calendar size={18} style={{ color: '#74317e' }} />
                  Trial Subscription Period <span style={{ color: '#ef4444' }}>*</span>
                </label>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '10px',
                  marginBottom: '12px'
                }}>
                  {[
                    { label: '1 Day', value: '1' },
                    { label: '3 Days', value: '3' },
                    { label: '7 Days', value: '7' },
                    { label: '30 Days', value: '30' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleChange({ target: { name: 'trial_expiry_date', value: option.value } })}
                      style={{
                        padding: '10px 4px',
                        backgroundColor: formData.trial_expiry_date === option.value ? '#f5f3ff' : 'white',
                        border: `1px solid ${formData.trial_expiry_date === option.value ? '#7c3aed' : '#d1d5db'}`,
                        borderRadius: '8px',
                        color: formData.trial_expiry_date === option.value ? '#7c3aed' : '#4b5563',
                        fontSize: '13px',
                        fontWeight: formData.trial_expiry_date === option.value ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (formData.trial_expiry_date !== option.value) {
                          e.currentTarget.style.borderColor = '#7c3aed';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (formData.trial_expiry_date !== option.value) {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    zIndex: 1
                  }}>
                    <Calendar size={16} />
                  </div>
                  <select
                    name="trial_expiry_date"
                    value={formData.trial_expiry_date}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 40px',
                      border: errors.trial_expiry_date ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box',
                      opacity: isSubmitting ? 0.6 : 1,
                      backgroundColor: 'white',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      color: formData.trial_expiry_date ? '#374151' : '#9ca3af',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '40px'
                    }}
                    onFocus={(e) => {
                      if (!errors.trial_expiry_date && !isSubmitting) {
                        e.target.style.borderColor = '#74317e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = errors.trial_expiry_date ? '#ef4444' : '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Custom duration...</option>
                    {[5, 10, 14, 15, 21, 45, 60, 90].map(days => (
                      <option key={days} value={String(days)}>{days} Days</option>
                    ))}
                  </select>
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
                {formData.trial_expiry_date && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: '#10b981' 
                    }} />
                    <span style={{ color: '#4b5563', fontSize: '13px', fontWeight: '500' }}>
                      Trial expires: <span style={{ color: '#111827', fontWeight: '600' }}>
                        {(() => {
                          const days = parseInt(formData.trial_expiry_date);
                          const expiryDate = new Date();
                          expiryDate.setDate(expiryDate.getDate() + days);
                          return expiryDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                        })()}
                      </span>
                    </span>
                  </div>
                )}
              </div>
              {/* Credits Management Section */}
              {(isGenieProductSelected || isInboundProductSelected) && isAdmin && (
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
                      backgroundColor: isInboundProductSelected ? '#7c3aed' : '#74317e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{isInboundProductSelected ? 'Inbound Credit Management' : 'Genie Credit Management'}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                        {createdUserId ? 'Manage balance and package subscriptions' : 'Available after creation'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (createdUserId) {
                        setShowCreditsModal(true);
                      } else {
                        toast.error('Please create the consumer first to manage credits');
                      }
                    }}
                    disabled={!createdUserId}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: createdUserId ? 'white' : '#f3f4f6',
                      border: `1px solid ${createdUserId ? (isInboundProductSelected ? '#7c3aed' : '#74317e') : '#d1d5db'}`,
                      borderRadius: '6px',
                      color: createdUserId ? (isInboundProductSelected ? '#7c3aed' : '#74317e') : '#9ca3af',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: createdUserId ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s'
                    }}
                  >
                    Manage Credits
                  </button>
                </div>
              )}

              {/* Credits Modal Integration */}
              {showCreditsModal && createdUserId && (
                <CreditsModal
                  isOpen={showCreditsModal}
                  onClose={() => setShowCreditsModal(false)}
                  userId={createdUserId}
                  productId={getInboundProductId() || getGenieProductId()}
                  userName={formData.full_name || 'New Consumer'}
                />
              )}

            </>
          )}
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
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }
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
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#5a2460';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#74317e';
              }
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
              'Create Consumer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateConsumerModal;

