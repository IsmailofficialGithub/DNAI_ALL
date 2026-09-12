import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Table } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Lock, Save, Edit2, Globe, ChevronDown, X, Search, Activity, Plus, Trash2, Clock, Eye, Tag } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { createClient } from '../lib/supabase/Production/client';
import toast from 'react-hot-toast';
import { countries, searchCountries } from '../utils/countryData';
import { getActivityLogs, getMyCommission } from '../api/backend';
import apiClient from '../services/apiClient';
import { Award, Percent, DollarSign } from 'lucide-react';
import { hasRole } from '../utils/roleUtils';

const Account = () => {
  const { user, profile } = useAuth();
  const history = useHistory();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    role: '',
    nickname: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [referrerName, setReferrerName] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [commissionData, setCommissionData] = useState(null);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [commissionEarnings, setCommissionEarnings] = useState(0);

  const fetchReferrerName = async (referrerId) => {
    try {
      const supabase = createClient();
      const { data: referrerProfile, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', referrerId)
        .single();

      if (error) {
        console.error('Error fetching referrer:', error);
        setReferrerName(null);
        return;
      }

      if (referrerProfile) {
        setReferrerName(referrerProfile.full_name || 'Unknown');
      } else {
        setReferrerName(null);
      }
    } catch (error) {
      console.error('Error fetching referrer name:', error);
      setReferrerName(null);
    }
  };

  useEffect(() => {
    if (profile && user) {
      const phone = profile.phone || '';
      const countryName = profile.country || '';
      
      // Find country if it exists
      let country = null;
      if (countryName) {
        country = countries.find(c => c.name === countryName);
      }
      
      // Extract phone number without country code
      let phoneWithoutCode = phone;
      if (country && phone) {
        const phoneStr = String(phone).trim();
        // Remove country code if it exists at the start (handle with or without space)
        const codeToRemove = country.phoneCode.replace(/[^0-9+]/g, ''); // Get clean phone code (numbers and + only)
        const phoneStrClean = phoneStr.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
        if (phoneStrClean.startsWith(codeToRemove)) {
          phoneWithoutCode = phoneStrClean.substring(codeToRemove.length).trim();
        } else if (phoneStr.startsWith(country.phoneCode)) {
          // Try with the original format including spaces/dashes
          phoneWithoutCode = phoneStr.substring(country.phoneCode.length).trim();
        }
      }
      
      setFormData({
        full_name: profile.full_name || '',
        email: user.email || '',
        phone: phoneWithoutCode,
        country: countryName,
        city: profile.city || '',
        role: profile.role || '',
        nickname: profile.nickname || ''
      });
      
      setSelectedCountry(country);

      // Fetch referrer's name if referred_by exists
      if (profile.referred_by) {
        fetchReferrerName(profile.referred_by);
      } else {
        setReferrerName(null);
      }

      // Fetch activity logs for this user
      fetchUserActivityLogs(user.id);

      // Fetch commission data for resellers
      if (profile && hasRole(profile.role, 'reseller')) {
        fetchCommissionData();
      }
    }
  }, [profile, user]);

  const fetchCommissionData = async () => {
    setCommissionLoading(true);
    try {
      // Fetch commission
      const commissionResult = await getMyCommission();
      if (commissionResult && commissionResult.success && commissionResult.data) {
        setCommissionData(commissionResult.data);
        
        // Fetch invoices to calculate earnings
        const invoicesResponse = await apiClient.invoices.getMyInvoices('?status=paid');
        if (invoicesResponse && invoicesResponse.data) {
          const invoices = invoicesResponse.data.data || invoicesResponse.data || [];
          const revenue = invoices.reduce((sum, inv) => {
            return sum + parseFloat(inv.total_amount || inv.total || 0);
          }, 0);
          setTotalRevenue(revenue);
          
          const commissionRate = parseFloat(commissionResult.data.commissionRate || 0);
          const earnings = (revenue * commissionRate) / 100;
          setCommissionEarnings(earnings);
        }
      }
    } catch (error) {
      console.error('Error fetching commission data:', error);
    } finally {
      setCommissionLoading(false);
    }
  };

  const fetchUserActivityLogs = async (userId) => {
    setLoadingLogs(true);
    try {
      const result = await getActivityLogs({
        target_id: userId,
        page: 1,
        limit: 10 // Show last 10 activities
      });
      
      if (result && result.success && result.data) {
        setActivityLogs(result.data);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'create':
        return Plus;
      case 'update':
        return Edit2;
      case 'delete':
        return Trash2;
      default:
        return Activity;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case 'create':
        return { bg: '#f0fdf4', border: '#86efac', text: '#166534' };
      case 'update':
        return { bg: '#fffbeb', border: '#fde047', text: '#854d0e' };
      case 'delete':
        return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      default:
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionText = (actionType) => {
    switch (actionType) {
      case 'create':
        return 'Created by';
      case 'update':
        return 'Updated by';
      case 'delete':
        return 'Deleted by';
      default:
        return 'Action by';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, phone: numericValue }));
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setFormData(prev => ({
      ...prev,
      country: country.name,
      // Keep phone number as is - country code will be displayed separately
      phone: prev.phone || ''
    }));
    setCountrySearch('');
    setShowCountryDropdown(false);
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

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      toast.error('Full name must be at least 2 characters');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (!user || !user.id) {
        toast.error('User not authenticated');
        setLoading(false);
        return;
      }

      // Combine country code with phone number if country is selected
      const fullPhone = selectedCountry && formData.phone 
        ? `${selectedCountry.phoneCode} ${formData.phone.trim()}`
        : formData.phone ? formData.phone.trim() : null;

      // Update profile in Supabase
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: fullPhone,
          country: formData.country ? formData.country.trim() : null,
          city: formData.city ? formData.city.trim() : null,
          nickname: formData.nickname ? formData.nickname.trim() : null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error(`Failed to update profile: ${error.message}`);
        return;
      }

      toast.success('Profile updated successfully!');
      setIsEditing(false);
      
      // Optionally refresh the page to get updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match!');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters!');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (!user || !user.email) {
        toast.error('User not authenticated');
        setLoading(false);
        return;
      }

      // First, verify current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        setLoading(false);
        return;
      }

      // Update password using Supabase auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        toast.error(`Failed to update password: ${updateError.message}`);
        return;
      }

      toast.success('Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: '#3b82f6',
      reseller: '#8b5cf6',
      consumer: '#10b981'
    };
    return colors[role] || '#6c757d';
  };

  return (
    <Container fluid style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#2c3e50',
          margin: '0 0 8px 0'
        }}>
          Account Settings
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6c757d',
          margin: 0
        }}>
          Manage your account information and preferences
        </p>
      </div>

      <Row>
        {/* Profile Information Card */}
        <Col lg={8} style={{ marginBottom: '24px' }}>
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            <Card.Body style={{ padding: '32px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  margin: 0
                }}>
                  Profile Information
                </h4>
                {!isEditing && (
                  <Button
                    onClick={() => setIsEditing(true)}
                    style={{
                      backgroundColor: '#74317e',
                      border: 'none',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Edit2 size={16} />
                    Edit Profile
                  </Button>
                )}
              </div>

              <Form onSubmit={handleSubmit}>
                {/* Full Name */}
                <Form.Group style={{ marginBottom: '20px' }}>
                  <Form.Label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Full Name
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }} />
                    <Form.Control
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      style={{
                        paddingLeft: '40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? '#fff' : '#f9fafb'
                      }}
                    />
                  </div>
                </Form.Group>

                {/* Nickname */}
                <Form.Group style={{ marginBottom: '20px' }}>
                  <Form.Label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Nickname / Label
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }} />
                    <Form.Control
                      type="text"
                      name="nickname"
                      value={formData.nickname}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Enter a nickname or label"
                      style={{
                        paddingLeft: '40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? '#fff' : '#f9fafb'
                      }}
                    />
                  </div>
                  <Form.Text style={{ fontSize: '12px', color: '#6c757d' }}>
                    Optional: Add a custom nickname or label for easy identification
                  </Form.Text>
                </Form.Group>

                {/* Email */}
                <Form.Group style={{ marginBottom: '20px' }}>
                  <Form.Label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Email Address
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }} />
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled={true}
                      style={{
                        paddingLeft: '40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#f9fafb',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                  <Form.Text style={{ fontSize: '12px', color: '#6c757d' }}>
                    Email cannot be changed
                  </Form.Text>
                </Form.Group>

                {/* Country */}
                <Form.Group style={{ marginBottom: '20px' }}>
                  <Form.Label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Country
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Globe size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      zIndex: 1
                    }} />
                    <Form.Control
                      type="text"
                      value={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : countrySearch}
                      onChange={handleCountryInputChange}
                      onFocus={handleCountryInputFocus}
                      onClick={handleCountryInputClick}
                      placeholder="Search country..."
                      readOnly={false}
                      disabled={!isEditing}
                      style={{
                        paddingLeft: '40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? (selectedCountry ? '#f9fafb' : '#fff') : '#f9fafb',
                        cursor: isEditing ? (selectedCountry ? 'pointer' : 'text') : 'not-allowed'
                      }}
                      onBlur={(e) => {
                        setTimeout(() => setShowCountryDropdown(false), 200);
                      }}
                    />
                    {isEditing && selectedCountry && (
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
                          justifyContent: 'center',
                          color: '#9ca3af'
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                    {isEditing && showCountryDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        marginTop: '4px'
                      }}>
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => (
                            <div
                              key={country.code}
                              onClick={() => handleCountrySelect(country)}
                              style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                borderBottom: '1px solid #f3f4f6',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                              }}
                            >
                              <span style={{ fontSize: '20px' }}>{country.flag}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                                  {country.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {country.phoneCode}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                            No countries found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Form.Group>

                {/* City */}
                <Form.Group style={{ marginBottom: '20px' }}>
                  <Form.Label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    City
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }} />
                    <Form.Control
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!isEditing}
                      style={{
                        paddingLeft: '40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? '#fff' : '#f9fafb'
                      }}
                    />
                  </div>
                </Form.Group>

                {/* Phone */}
                <Form.Group style={{ marginBottom: '20px' }}>
                  <Form.Label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Phone Number
                  </Form.Label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Phone size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      color: '#9ca3af',
                      zIndex: 1
                    }} />
                    {selectedCountry && isEditing && (
                      <div style={{
                        position: 'absolute',
                        left: '40px',
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRight: 'none',
                        borderRadius: '8px 0 0 8px',
                        fontSize: '14px',
                        color: '#374151',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 1
                      }}>
                        {selectedCountry.phoneCode}
                      </div>
                    )}
                    <Form.Control
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      disabled={!isEditing}
                      style={{
                        paddingLeft: selectedCountry && isEditing ? '140px' : '40px',
                        border: '1px solid #d1d5db',
                        borderRadius: selectedCountry && isEditing ? '0 8px 8px 0' : '8px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? '#fff' : '#f9fafb'
                      }}
                      placeholder={selectedCountry ? 'Enter phone number' : 'Select country first'}
                    />
                  </div>
                  {selectedCountry && (
                    <Form.Text style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                      Country code: {selectedCountry.phoneCode}
                    </Form.Text>
                  )}
                </Form.Group>

                {isEditing && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <Button
                      type="submit"
                      disabled={loading}
                      style={{
                        backgroundColor: '#74317e',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Save size={16} />
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#6c757d',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#ffffff'
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Sidebar Cards */}
        <Col lg={4}>
          {/* Account Info Card */}
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <Card.Body style={{ padding: '24px' }}>
              <h5 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '16px'
              }}>
                Account Information
              </h5>

              {profile && hasRole(profile.role, 'reseller') && (
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <h6 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Award size={16} style={{ color: '#8b5cf6' }} />
                    Commission Information
                  </h6>
                  
                  {commissionLoading ? (
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Loading...</span>
                    </div>
                  ) : commissionData ? (
                    <>
                      <div style={{ marginBottom: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                          Commission Rate
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Percent size={14} style={{ color: '#8b5cf6' }} />
                          <span style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#2c3e50'
                          }}>
                            {commissionData.commissionRate.toFixed(2)}%
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: '#6c757d',
                            padding: '2px 6px',
                            backgroundColor: commissionData.commissionType === 'custom' ? '#dbeafe' : '#f3f4f6',
                            borderRadius: '4px'
                          }}>
                            {commissionData.commissionType === 'custom' ? 'Custom' : 'Default'}
                          </span>
                        </div>
                      </div>

                      {totalRevenue > 0 && (
                        <>
                          <div style={{ marginBottom: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                            <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                              Total Revenue (Paid Invoices)
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <DollarSign size={14} style={{ color: '#10b981' }} />
                              <span style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#2c3e50'
                              }}>
                                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <div style={{ marginBottom: '0', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                            <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                              My Earnings (After Commission)
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Award size={14} style={{ color: '#10b981' }} />
                              <span style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#10b981'
                              }}>
                                ${commissionEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>No commission data available</span>
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                  Role
                </p>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backgroundColor: `${getRoleBadgeColor(formData.role)}15`,
                  color: getRoleBadgeColor(formData.role),
                  textTransform: 'capitalize'
                }}>
                  {formData.role}
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                  User ID
                </p>
                <p style={{ fontSize: '14px', color: '#2c3e50', margin: 0, fontFamily: 'monospace' }}>
                  {user?.id?.slice(0, 16) || 'N/A'}...
                </p>
              </div>

              {referrerName && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                    Referred By
                  </p>
                  <p style={{ fontSize: '14px', color: '#2c3e50', margin: 0, fontWeight: '500' }}>
                    {referrerName}
                  </p>
                </div>
              )}

              <div>
                <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 4px 0' }}>
                  Account Created
                </p>
                <p style={{ fontSize: '14px', color: '#2c3e50', margin: 0 }}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>
            </Card.Body>
          </Card>

          {/* Activity Logs Card */}
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <Card.Body style={{ padding: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <Activity size={18} color="#2c3e50" />
                <h5 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  margin: 0
                }}>
                  Account Activity
                </h5>
              </div>

              {loadingLogs ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '14px'
                }}>
                  Loading activity logs...
                </div>
              ) : activityLogs.length === 0 ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '14px'
                }}>
                  No activity logs found
                </div>
              ) : (
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <Table hover style={{ margin: 0 }}>
                    <thead style={{
                      backgroundColor: '#f9fafb',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1
                    }}>
                      <tr>
                        <th style={{
                          padding: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          borderBottom: '2px solid #e5e7eb'
                        }}>
                          Action
                        </th>
                        <th style={{
                          padding: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          borderBottom: '2px solid #e5e7eb'
                        }}>
                          Actor
                        </th>
                        <th style={{
                          padding: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          borderBottom: '2px solid #e5e7eb'
                        }}>
                          Date
                        </th>
                        <th style={{
                          padding: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          borderBottom: '2px solid #e5e7eb',
                          width: '80px',
                          textAlign: 'center'
                        }}>
                          View
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((log) => {
                        const actionStyle = getActionColor(log.action_type);
                        const ActionIcon = getActionIcon(log.action_type);

                        return (
                          <tr
                            key={log.id}
                            style={{
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              borderBottom: '1px solid #e5e7eb'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                            onClick={() => {
                              const layout = profile?.role || 'admin';
                              history.push(`/${layout}/activity-logs/${log.id}`);
                            }}
                          >
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  backgroundColor: actionStyle.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: `1px solid ${actionStyle.border}`,
                                  flexShrink: 0
                                }}>
                                  <ActionIcon size={12} style={{ color: actionStyle.text }} />
                                </div>
                                <span style={{
                                  fontSize: '13px',
                                  color: actionStyle.text,
                                  fontWeight: '500',
                                  textTransform: 'capitalize'
                                }}>
                                  {log.action_type}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontSize: '13px', color: '#1f2937', fontWeight: '500' }}>
                                {log.actor_name || 'System'}
                              </div>
                              {log.actor_role && (
                                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>
                                  {log.actor_role}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Clock size={12} />
                                {formatDate(log.created_at)}
                              </div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const layout = profile?.role || 'admin';
                                  history.push(`/${layout}/activity-logs/${log.id}`);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  backgroundColor: 'white',
                                  color: '#6b7280',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s',
                                  margin: '0 auto'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#74317e';
                                  e.currentTarget.style.borderColor = '#74317e';
                                  e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.borderColor = '#e5e7eb';
                                  e.currentTarget.style.color = '#6b7280';
                                }}
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Security Card */}
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            <Card.Body style={{ padding: '24px' }}>
              <h5 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '16px'
              }}>
                Security
              </h5>

              {!showPasswordForm ? (
                <Button
                  onClick={() => setShowPasswordForm(true)}
                  style={{
                    width: '100%',
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    color: '#ffffff',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Lock size={16} />
                  Change Password
                </Button>
              ) : (
                <Form onSubmit={handlePasswordSubmit}>
                  <Form.Group style={{ marginBottom: '16px' }}>
                    <Form.Label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                      Current Password
                    </Form.Label>
                    <Form.Control
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      required
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </Form.Group>

                  <Form.Group style={{ marginBottom: '16px' }}>
                    <Form.Label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                      New Password
                    </Form.Label>
                    <Form.Control
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      required
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </Form.Group>

                  <Form.Group style={{ marginBottom: '16px' }}>
                    <Form.Label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                      Confirm New Password
                    </Form.Label>
                    <Form.Control
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </Form.Group>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      type="submit"
                      disabled={loading}
                      style={{
                        flex: 1,
                        backgroundColor: '#74317e',
                        border: 'none',
                        padding: '8px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#ffffff'
                      }}
                    >
                      {loading ? 'Updating...' : 'Update'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                      }}
                      disabled={loading}
                      style={{
                        flex: 1,
                        backgroundColor: '#6c757d',
                        border: 'none',
                        padding: '8px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#ffffff'
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </Form>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Account;

