import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Save, X, ChevronRight, ChevronDown, 
  Settings, Layers, Variable, Check, AlertCircle, RefreshCw
} from 'lucide-react';
import { 
  getAllPackages,
  updatePackage,
  getPackageFeatures, 
  createPackageFeature, 
  updatePackageFeature, 
  deletePackageFeature,
  getPackageVariables,
  createPackageVariable,
  updatePackageVariable,
  deletePackageVariable
} from '../api/backend/packages';
import toast from 'react-hot-toast';

const InboundSettings = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [features, setFeatures] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Modal/Form states
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    credits_included: 0,
    tier: '',
    is_active: true
  });

  const [featureForm, setFeatureForm] = useState({
    feature_name: '',
    feature_key: '',
    feature_label: '',
    feature_value: '',
    feature_template: '',
    is_enabled: true,
    is_highlighted: false,
    display_order: 0
  });

  const [variableForm, setVariableForm] = useState({
    variable_name: '',
    variable_value: '',
    variable_type: 'text'
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await getAllPackages();
      if (response.success) {
        setPackages(response.data);
      } else {
        toast.error(response.error || 'Failed to fetch packages');
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('An error occurred while fetching packages');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackageDetails = async (pkg) => {
    try {
      setLoadingDetails(true);
      setSelectedPackage(pkg);
      
      const [featuresRes, variablesRes] = await Promise.all([
        getPackageFeatures(pkg.id),
        getPackageVariables(pkg.id)
      ]);

      if (featuresRes.success) setFeatures(featuresRes.data);
      if (variablesRes.success) setVariables(variablesRes.data);
      
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load package details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveFeature = async (e) => {
    e.preventDefault();
    if (!selectedPackage || saving) return;

    try {
      setSaving(true);
      let response;
      if (isEditing) {
        response = await updatePackageFeature(selectedPackage.id, editingItem.id, featureForm);
      } else {
        response = await createPackageFeature(selectedPackage.id, featureForm);
      }

      if (response.success) {
        toast.success(`Feature ${isEditing ? 'updated' : 'created'} successfully`);
        setShowFeatureModal(false);
        fetchPackageDetails(selectedPackage);
      } else {
        toast.error(response.error || 'Failed to save feature');
      }
    } catch (error) {
      toast.error('Error saving feature');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVariable = async (e) => {
    e.preventDefault();
    if (!selectedPackage || saving) return;

    try {
      setSaving(true);
      let response;
      if (isEditing) {
        response = await updatePackageVariable(selectedPackage.id, editingItem.id, variableForm);
      } else {
        response = await createPackageVariable(selectedPackage.id, variableForm);
      }

      if (response.success) {
        toast.success(`Variable ${isEditing ? 'updated' : 'created'} successfully`);
        setShowVariableModal(false);
        fetchPackageDetails(selectedPackage);
      } else {
        toast.error(response.error || 'Failed to save variable');
      }
    } catch (error) {
      toast.error('Error saving variable');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    if (!selectedPackage || saving) return;

    try {
      setSaving(true);
      // Sync price with price_monthly for compatibility
      const dataToSave = {
        ...packageForm,
        price: packageForm.price_monthly
      };
      const response = await updatePackage(selectedPackage.id, dataToSave);

      if (response.success) {
        toast.success('Package updated successfully');
        setShowPackageModal(false);
        fetchPackages(); // Refresh the list
        // Update local selected package
        setSelectedPackage({ ...selectedPackage, ...packageForm });
      } else {
        toast.error(response.error || 'Failed to update package');
      }
    } catch (error) {
      toast.error('Error updating package');
    } finally {
      setSaving(false);
    }
  };

  const openPackageModal = (pkg) => {
    setPackageForm({
      name: pkg.name || '',
      description: pkg.description || '',
      price_monthly: pkg.price_monthly || pkg.price || 0,
      credits_included: pkg.credits_included || 0,
      tier: pkg.tier || '',
      is_active: pkg.is_active ?? true
    });
    setShowPackageModal(true);
  };

  const handleDeleteFeature = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feature?') || saving) return;
    try {
      setSaving(true);
      const response = await deletePackageFeature(selectedPackage.id, id);
      if (response.success) {
        toast.success('Feature deleted');
        fetchPackageDetails(selectedPackage);
      }
    } catch (error) {
      toast.error('Error deleting feature');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariable = async (id) => {
    if (!window.confirm('Are you sure you want to delete this variable?') || saving) return;
    try {
      setSaving(true);
      const response = await deletePackageVariable(selectedPackage.id, id);
      if (response.success) {
        toast.success('Variable deleted');
        fetchPackageDetails(selectedPackage);
      }
    } catch (error) {
      toast.error('Error deleting variable');
    } finally {
      setSaving(false);
    }
  };

  const openFeatureModal = (feature = null) => {
    if (feature) {
      setFeatureForm({
        feature_name: feature.feature_name || '',
        feature_key: feature.feature_key || '',
        feature_label: feature.feature_label || '',
        feature_value: feature.feature_value || '',
        feature_template: feature.feature_template || '',
        is_enabled: feature.is_enabled ?? true,
        is_highlighted: feature.is_highlighted ?? false,
        display_order: feature.display_order || 0
      });
      setEditingItem(feature);
      setIsEditing(true);
    } else {
      setFeatureForm({
        feature_name: '',
        feature_key: '',
        feature_label: '',
        feature_value: '',
        feature_template: '',
        is_enabled: true,
        is_highlighted: false,
        display_order: 0
      });
      setIsEditing(false);
    }
    setShowFeatureModal(true);
  };

  const openVariableModal = (variable = null) => {
    if (variable) {
      setVariableForm({
        variable_name: variable.variable_name || '',
        variable_value: variable.variable_value || '',
        variable_type: variable.variable_type || 'text'
      });
      setEditingItem(variable);
      setIsEditing(true);
    } else {
      setVariableForm({
        variable_name: '',
        variable_value: '',
        variable_type: 'text'
      });
      setIsEditing(false);
    }
    setShowVariableModal(true);
  };

  return (
    <div style={{ display: 'flex', gap: '24px', minHeight: '600px' }}>
      {/* Packages List Sidebar */}
      <div style={{ 
        width: '300px', 
        borderRight: '1px solid #eee', 
        paddingRight: '20px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Packages</h4>
          <button 
            onClick={fetchPackages} 
            disabled={loading || saving}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: (loading || saving) ? 'not-allowed' : 'pointer', 
              color: '#666',
              opacity: (loading || saving) ? 0.5 : 1
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {packages.map(pkg => (
              <div 
                key={pkg.id}
                onClick={() => fetchPackageDetails(pkg)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedPackage?.id === pkg.id ? '#f0f7ff' : 'transparent',
                  border: `1px solid ${selectedPackage?.id === pkg.id ? '#007bff' : '#eee'}`,
                  transition: 'all 0.2s',
                  pointerEvents: (loading || saving || loadingDetails) ? 'none' : 'auto',
                  opacity: (loading || saving || loadingDetails) ? 0.8 : 1
                }}
              >
                <div style={{ fontWeight: '600', color: selectedPackage?.id === pkg.id ? '#007bff' : '#333' }}>
                  {pkg.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {pkg.tier || 'Free'} • {pkg.price_monthly ? `$${pkg.price_monthly}/mo` : 'Free'}
                  {pkg.credits_included !== undefined && ` • ${pkg.credits_included.toLocaleString()} Credits`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Package Details Area */}
      <div style={{ flex: 1 }}>
        {!selectedPackage ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#999'
          }}>
            <Settings size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>Select a package to manage its features and variables</p>
          </div>
        ) : (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid #eee'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>{selectedPackage.name}</h3>
                <p style={{ margin: '4px 0 0', color: '#666' }}>{selectedPackage.description}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => openPackageModal(selectedPackage)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'white',
                    color: '#74317e',
                    border: '1px solid #74317e',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={loading || saving || loadingDetails}
                >
                  <Edit2 size={14} /> Edit Plan
                </button>
                <div style={{ 
                  padding: '4px 12px', 
                  backgroundColor: '#f0fdf4', 
                  color: '#16a34a', 
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #bcf0da'
                }}>
                  {selectedPackage.credits_included?.toLocaleString() || 0} CREDITS
                </div>
                <span style={{ 
                  padding: '4px 12px', 
                  backgroundColor: '#e1f5fe', 
                  color: '#0288d1', 
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {(selectedPackage.tier || 'free').toUpperCase()}
                </span>
              </div>
            </div>

            {loadingDetails ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading details...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* Features Section */}
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={20} color="#74317e" />
                      <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Features</h5>
                    </div>
                    <button 
                      onClick={() => openFeatureModal()}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#74317e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer',
                        opacity: (loading || saving || loadingDetails) ? 0.5 : 1
                      }}
                      disabled={loading || saving || loadingDetails}
                    >
                      <Plus size={14} /> Add Feature
                    </button>
                  </div>

                  <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px' }}>Name / Label</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px' }}>Key</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>Enabled</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>Order</th>
                          <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {features.length === 0 ? (
                          <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No features added yet</td></tr>
                        ) : (
                          features.map(feat => (
                            <tr key={feat.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ fontWeight: '500' }}>{feat.feature_name}</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>{feat.feature_label}</div>
                              </td>
                              <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace' }}>{feat.feature_key}</td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                {feat.is_enabled ? <Check size={16} color="#28a745" /> : <X size={16} color="#dc3545" />}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>{feat.display_order}</td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>
                                <button 
                                  onClick={() => openFeatureModal(feat)} 
                                  disabled={loading || saving || loadingDetails}
                                  style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: '#007bff', 
                                    cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer', 
                                    marginRight: '8px',
                                    opacity: (loading || saving || loadingDetails) ? 0.5 : 1
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteFeature(feat.id)} 
                                  disabled={loading || saving || loadingDetails}
                                  style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: '#dc3545', 
                                    cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer',
                                    opacity: (loading || saving || loadingDetails) ? 0.5 : 1
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Variables Section */}
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Variable size={20} color="#17a2b8" />
                      <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Variables</h5>
                    </div>
                    <button 
                      onClick={() => openVariableModal()}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer',
                        opacity: (loading || saving || loadingDetails) ? 0.5 : 1
                      }}
                      disabled={loading || saving || loadingDetails}
                    >
                      <Plus size={14} /> Add Variable
                    </button>
                  </div>

                  <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px' }}>Name</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px' }}>Value</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>Type</th>
                          <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variables.length === 0 ? (
                          <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No variables added yet</td></tr>
                        ) : (
                          variables.map(v => (
                            <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '12px', fontWeight: '500' }}>{v.variable_name}</td>
                              <td style={{ padding: '12px', fontSize: '13px' }}>{v.variable_value}</td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>{v.variable_type}</span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>
                                <button 
                                  onClick={() => openVariableModal(v)} 
                                  disabled={loading || saving || loadingDetails}
                                  style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: '#007bff', 
                                    cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer', 
                                    marginRight: '8px',
                                    opacity: (loading || saving || loadingDetails) ? 0.5 : 1
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteVariable(v.id)} 
                                  disabled={loading || saving || loadingDetails}
                                  style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: '#dc3545', 
                                    cursor: (loading || saving || loadingDetails) ? 'not-allowed' : 'pointer',
                                    opacity: (loading || saving || loadingDetails) ? 0.5 : 1
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature Modal */}
      {showFeatureModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0 }}>{isEditing ? 'Edit Feature' : 'Add Feature'}</h4>
              <button onClick={() => setShowFeatureModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveFeature}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Name</label>
                  <input 
                    type="text" value={featureForm.feature_name} 
                    onChange={e => setFeatureForm({...featureForm, feature_name: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Key</label>
                  <input 
                    type="text" value={featureForm.feature_key} 
                    onChange={e => setFeatureForm({...featureForm, feature_key: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Label</label>
                <input 
                  type="text" value={featureForm.feature_label} 
                  onChange={e => setFeatureForm({...featureForm, feature_label: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Value</label>
                <input 
                  type="text" value={featureForm.feature_value} 
                  onChange={e => setFeatureForm({...featureForm, feature_value: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Template</label>
                <textarea 
                  value={featureForm.feature_template} 
                  onChange={e => setFeatureForm({...featureForm, feature_template: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', height: '60px' }}
                  placeholder="e.g. {{ai_agents}} AI Agents included"
                />
              </div>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={featureForm.is_enabled} onChange={e => setFeatureForm({...featureForm, is_enabled: e.target.checked})} />
                  Enabled
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={featureForm.is_highlighted} onChange={e => setFeatureForm({...featureForm, is_highlighted: e.target.checked})} />
                  Highlighted
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Order:</span>
                  <input 
                    type="number" value={featureForm.display_order} 
                    onChange={e => setFeatureForm({...featureForm, display_order: parseInt(e.target.value)})}
                    style={{ width: '50px', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowFeatureModal(false)} 
                  disabled={saving}
                  style={{ 
                    padding: '8px 16px', 
                    border: '1px solid #ddd', 
                    background: 'none', 
                    borderRadius: '6px', 
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#74317e', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  {isEditing ? 'Update Feature' : 'Save Feature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variable Modal */}
      {showVariableModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0 }}>{isEditing ? 'Edit Variable' : 'Add Variable'}</h4>
              <button onClick={() => setShowVariableModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveVariable}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Name (Key)</label>
                <input 
                  type="text" value={variableForm.variable_name} 
                  onChange={e => setVariableForm({...variableForm, variable_name: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  required
                  placeholder="e.g. ai_agents"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Value</label>
                <input 
                  type="text" value={variableForm.variable_value} 
                  onChange={e => setVariableForm({...variableForm, variable_value: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Type</label>
                <select 
                  value={variableForm.variable_type} 
                  onChange={e => setVariableForm({...variableForm, variable_type: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="currency">Currency</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowVariableModal(false)} 
                  disabled={saving}
                  style={{ 
                    padding: '8px 16px', 
                    border: '1px solid #ddd', 
                    background: 'none', 
                    borderRadius: '6px', 
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#17a2b8', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  {isEditing ? 'Update Variable' : 'Save Variable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Package Modal */}
      {showPackageModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0 }}>Edit Plan: {selectedPackage?.name}</h4>
              <button onClick={() => setShowPackageModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePackage}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Plan Name</label>
                <input 
                  type="text" value={packageForm.name} 
                  onChange={e => setPackageForm({...packageForm, name: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Description</label>
                <textarea 
                  value={packageForm.description} 
                  onChange={e => setPackageForm({...packageForm, description: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', height: '60px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Price (Monthly)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={packageForm.price_monthly} 
                    onChange={e => setPackageForm({...packageForm, price_monthly: parseFloat(e.target.value)})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Credits Included</label>
                  <input 
                    type="number" 
                    min="0"
                    value={packageForm.credits_included} 
                    onChange={e => setPackageForm({...packageForm, credits_included: parseInt(e.target.value)})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: '500' }}>Tier</label>
                  <input 
                    type="text" value={packageForm.tier} 
                    onChange={e => setPackageForm({...packageForm, tier: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="e.g. Starter, Growth, Elite"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input type="checkbox" checked={packageForm.is_active} onChange={e => setPackageForm({...packageForm, is_active: e.target.checked})} />
                    Active
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowPackageModal(false)} 
                  disabled={saving}
                  style={{ 
                    padding: '8px 16px', 
                    border: '1px solid #ddd', 
                    background: 'none', 
                    borderRadius: '6px', 
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#74317e', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  Save Plan Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboundSettings;
