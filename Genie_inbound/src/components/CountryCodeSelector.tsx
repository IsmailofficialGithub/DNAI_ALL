import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { countryCodes } from '../data/countryCodes';
import { cn } from '@/lib/utils';

interface CountryCodeSelectorProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({ value, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = countryCodes.find(c => c.code === value) || countryCodes[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredCountries = countryCodes.filter(
    country =>
      country.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.code.includes(searchTerm)
  );

  return (
    <div className="country-selector-root" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="country-selector-button"
        disabled={disabled}
      >
        <span className="country-selector-flag">{selectedCountry.flag}</span>
        <ChevronDown className={cn("country-selector-chevron", isOpen && "country-selector-chevron-open")} />
        {selectedCountry.code}
      </button>

      {isOpen && (
        <div className="country-selector-dropdown">
          <div className="country-selector-search-wrapper">
            <div className="country-selector-search-inner">
              <Search className="country-selector-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="country-selector-search-input"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="country-selector-list">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onChange(country.code);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={cn(
                  "country-selector-item",
                  value === country.code && "country-selector-item-selected"
                )}
              >
                <span className="country-selector-item-flag">{country.flag}</span>
                <span className="country-selector-item-code">{country.code}</span>
                <span className="country-selector-item-name">{country.country}</span>
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <div className="country-selector-empty">No countries found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountryCodeSelector;
