import React, { useState, useEffect, useRef } from 'react';
import { fetchLinkedInOrganizations, OrgDTO } from '../lib/linkedin-organizations';

interface OrganizationPickerProps {
  accessToken: string;
  urns: string[];
  onConfirm: (org: OrgDTO) => void;
  onCancel: () => void;
}

export function OrganizationPicker({ accessToken, urns, onConfirm, onCancel }: OrganizationPickerProps) {
  const [organizations, setOrganizations] = useState<OrgDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgDTO | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadOrganizations();
  }, [accessToken, urns]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const orgs = await fetchLinkedInOrganizations(accessToken, urns);
      setOrganizations(orgs);
      
      if (orgs.length === 0) {
        setError('No eligible Pages found. Make sure you are an Admin of the LinkedIn Page.');
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
      setError('Failed to load organizations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (loading || organizations.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, organizations.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedOrg) {
          onConfirm(selectedOrg);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
    }
  };

  const handleOrgClick = (org: OrgDTO) => {
    setSelectedOrg(org);
  };

  const handleConnect = () => {
    if (selectedOrg) {
      onConfirm(selectedOrg);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const truncateName = (name: string, maxLength: number = 30): string => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;
  };

  // Focus management
  useEffect(() => {
    if (itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading organizations...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organizations Found</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Select LinkedIn Organization</h2>
          <p className="text-sm text-gray-600 mt-1">Choose which organization you want to connect</p>
        </div>

        {/* Organization List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto px-6 py-4"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {organizations.map((org, index) => (
            <div
              key={org.orgId}
              ref={el => itemRefs.current[index] = el}
              className={`
                flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200
                ${selectedOrg?.orgId === org.orgId 
                  ? 'bg-blue-50 border-2 border-blue-500' 
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              `}
              onClick={() => handleOrgClick(org)}
              tabIndex={0}
              role="button"
              aria-selected={selectedOrg?.orgId === org.orgId}
              aria-label={`Select ${org.name}`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 mr-4">
                {org.logoUrl ? (
                  <img
                    src={org.logoUrl}
                    alt={`${org.name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-full h-full flex items-center justify-center text-white font-semibold text-sm ${
                    org.logoUrl ? 'hidden' : 'flex'
                  }`}
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  {getInitials(org.name)}
                </div>
              </div>

              {/* Organization Name */}
              <div className="flex-1 min-w-0">
                <h3 
                  className="font-semibold text-gray-900 truncate"
                  title={org.name}
                >
                  {truncateName(org.name)}
                </h3>
              </div>

              {/* Selection Indicator */}
              {selectedOrg?.orgId === org.orgId && (
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!selectedOrg}
            className={`
              px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500
              ${selectedOrg 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
