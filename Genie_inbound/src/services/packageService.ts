import { supabase } from '../lib/supabase';

export interface Package {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: 'free' | 'pro' | 'premium' | 'enterprise';
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  credits_included: number | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  metadata: Record<string, any>;
}

export interface PackageFeature {
  id: string;
  package_id: string;
  feature_key: string | null;
  feature_label: string | null;
  feature_template: string | null;
  feature_name?: string | null;
  feature_value?: string | null;
  display_order: number;
  is_highlighted: boolean;
  is_enabled?: boolean;
}

export interface PackageVariable {
  id: string;
  package_id: string;
  variable_key?: string;
  variable_name?: string;
  variable_value: string;
  variable_type: 'text' | 'number' | 'boolean' | 'currency';
}

export interface PackageWithDetails extends Package {
  features: PackageFeature[];
  variables: PackageVariable[];
}

/**
 * Render a feature template with variables
 */
export function renderFeatureTemplate(
  feature: PackageFeature,
  variables: PackageVariable[]
): string {
  // 1. Determine the source text
  const templateStr = (feature.feature_template || '').trim();
  const labelStr = (feature.feature_label || '').trim();
  const nameStr = (feature.feature_name || '').trim();
  const valueStr = (feature.feature_value || feature.feature_key || '').trim();
  
  const hasTemplate = !!templateStr;
  const hasLabel = !!labelStr;
  
  let rendered = templateStr || labelStr || nameStr || '';

  if (!rendered && valueStr) {
    return valueStr;
  }

  // 2. Handle the "Simple Name + Value" case (no template or label provided)
  // If we only have a name and a value, and no explicit template/label was given, 
  // we should show "Name: Value"
  if (!hasTemplate && !hasLabel && nameStr && valueStr) {
    // Check if the value is already in the name to avoid "Credits: 100 credits"
    if (!nameStr.toLowerCase().includes(valueStr.toLowerCase())) {
      rendered = `${nameStr}: ${valueStr}`;
    }
  }

  // 3. Support {{feature_value}}, {{feature_name}}, {{feature_key}} placeholders
  if (valueStr) {
    rendered = rendered.replace(/\{\{feature_value\}\}/g, valueStr);
    rendered = rendered.replace(/\{\{feature_key\}\}/g, valueStr);
  }
  if (nameStr) {
    rendered = rendered.replace(/\{\{feature_name\}\}/g, nameStr);
  }

  // 4. Replace custom variables
  variables.forEach((variable) => {
    const key = variable.variable_name || variable.variable_key;
    if (key) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, variable.variable_value);
    }
  });

  return rendered;
}

/**
 * Fetch all active packages with features and variables
 */
export async function fetchPackages(): Promise<PackageWithDetails[]> {
  const { data: packages, error: packagesError } = await supabase
    .from('packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (packagesError) {
    throw packagesError;
  }

  if (!packages || packages.length === 0) {
    return [];
  }

  const packageIds = packages.map((p: Package) => p.id);

  // Fetch features
  const { data: features, error: featuresError } = await supabase
    .from('package_features')
    .select('*')
    .in('package_id', packageIds)
    .eq('is_enabled', true)
    .order('display_order', { ascending: true });

  if (featuresError) {
    throw featuresError;
  }

  // Fetch variables
  const { data: variables, error: variablesError } = await supabase
    .from('package_variables')
    .select('*')
    .in('package_id', packageIds);

  if (variablesError) {
    throw variablesError;
  }

  // Combine packages with their features and variables
  const packagesWithDetails: PackageWithDetails[] = packages.map((pkg: Package) => ({
    ...pkg,
    features: (features || []).filter((f: PackageFeature) => f.package_id === pkg.id),
    variables: (variables || []).filter((v: PackageVariable) => v.package_id === pkg.id),
  }));

  return packagesWithDetails;
}

/**
 * Fetch a single package by ID with features and variables
 */
export async function fetchPackageById(packageId: string): Promise<PackageWithDetails | null> {
  const { data: packageData, error: packageError } = await supabase
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .single();

  if (packageError) {
    throw packageError;
  }

  if (!packageData) {
    return null;
  }

  // Fetch features
  const { data: features, error: featuresError } = await supabase
    .from('package_features')
    .select('*')
    .eq('package_id', packageId)
    .eq('is_enabled', true)
    .order('display_order', { ascending: true });

  if (featuresError) {
    throw featuresError;
  }

  // Fetch variables
  const { data: variables, error: variablesError } = await supabase
    .from('package_variables')
    .select('*')
    .eq('package_id', packageId);

  if (variablesError) {
    throw variablesError;
  }

  return {
    ...packageData,
    features: features || [],
    variables: variables || [],
  };
}
