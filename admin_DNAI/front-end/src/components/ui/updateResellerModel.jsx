import React, { useState, useEffect } from 'react';
import { X, User, Phone, Globe, MapPin, ChevronDown, Shield, Tag } from 'lucide-react';
import { countries, searchCountries } from '../../utils/countryData';

const UpdateResellerModal = ({ isOpen, onClose, reseller, onUpdate }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    country: '',
    city: '',
    roles: ['reseller'], // Default to reseller, but allow consumer too
    nickname: ''
  });
  
  // Available roles for reseller form
  const availableRoles = [
    { value: 'reseller', label: 'Reseller' },
    { value: 'consumer', label: 'Consumer' }
  ];

  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (reseller) {

      // Handle role - support both array and single value (backward compatibility)
      const resellerRoles = Array.isArray(reseller.role) 
        ? reseller.role 
        : (reseller.role ? [reseller.role] : ['reseller']);
      
      setFormData({
        full_name: reseller.full_name || reseller.name || '',
        phone: '',
        country: reseller.country || '',
        city: reseller.city || '',
        roles: resellerRoles,
        nickname: reseller.nickname || ''
      });
      
      // If reseller has a country, find and set it
      if (reseller.country) {
        const country = countries.find(c => c.name === reseller.country);
        if (country) {
          setSelectedCountry(country);
          // Remove country code from phone if it exists
          if (reseller.phone) {
            // Extract just the number part (remove country code)
            const phoneStr = String(reseller.phone).trim();
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
          if (reseller.phone) {
            setFormData(prev => ({ ...prev, phone: String(reseller.phone).trim() }));
          }
        }
      } else {
        setSelectedCountry(null);
        // If no country but has phone, just set the phone as is
        if (reseller.phone) {
          setFormData(prev => ({ ...prev, phone: String(reseller.phone).trim() }));
        }
      }
      
      setCountrySearch('');
      setErrors({});
    }
  }, [reseller]);

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
      const currentRoles = prev.roles || ['reseller'];
      const isSelected = currentRoles.includes(roleValue);
      
      let newRoles;
      if (isSelected) {
        // Remove role if already selected
        newRoles = currentRoles.filter(r => r !== roleValue);
        // Ensure at least reseller is selected (since this is update reseller form)
        if (newRoles.length === 0 || !newRoles.includes('reseller')) {
          newRoles = ['reseller'];
        }
      } else {
        // Add role
        newRoles = [...currentRoles, roleValue];
      }
      
      return {
        ...prev,
        roles: newRoles
      };
    });
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
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
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

      onUpdate({
        ...reseller,
        full_name: formData.full_name.trim(),
        phone: fullPhone,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        roles: formData.roles || ['reseller'], // Send roles array
        nickname: formData.nickname ? formData.nickname.trim() : null
      });
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
            Update Reseller
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
                Reseller ID
              </div>
              <div style={{
                fontSize: '14px',
                color: '#111827',
                fontWeight: '600',
                marginTop: '4px',
                fontFamily: 'monospace'
              }}>
                #{reseller?.id?.toString().slice(0, 8) || reseller?.user_id?.toString().slice(0, 8) || '-'}
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
                }}>
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
              {reseller?.email || 'No email'}
            </div>
          </div>

          {/* Created At Display */}
          {reseller?.created_at && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px 16px',
              borderRadius: '8px'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '500',
                marginBottom: '4px'
              }}>
                Created Date
              </div>
              <div style={{
                fontSize: '14px',
                color: '#111827',
                fontWeight: '500'
              }}>
                {new Date(reseller.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
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
            Update Reseller
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateResellerModal;

