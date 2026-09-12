export enum AppModule {
  GENIE = 'genie',
  SOCIAL_MANAGEMENT = 'social_management'
}

export interface ModuleConfig {
  id: AppModule;
  name: string;
  routes: string[];
  productName: string; // Product name in database (e.g., "Beeba", "Genie")
}

export const MODULE_CONFIGS: Record<AppModule, ModuleConfig> = {
  [AppModule.GENIE]: {
    id: AppModule.GENIE,
    name: 'Genie',
    routes: ['/genie', '/genie/calls', '/genie/leads'],
    productName: 'Genie',
  },
  [AppModule.SOCIAL_MANAGEMENT]: {
    id: AppModule.SOCIAL_MANAGEMENT,
    name: 'Social Management',
    routes: ['/', '/calendar', '/posting', '/templates', '/history', '/analytics', '/reports', '/integrations'],
    productName: 'Beeba',
  },
};

// Helper to get module from route
export function getModuleFromRoute(path: string): AppModule | null {
  for (const [moduleId, config] of Object.entries(MODULE_CONFIGS)) {
    if (config.routes.some(route => path === route || path.startsWith(route + '/'))) {
      return moduleId as AppModule;
    }
  }
  return null;
}

// Helper to check if route belongs to a module
export function isRouteInModule(path: string, module: AppModule): boolean {
  const config = MODULE_CONFIGS[module];
  return config.routes.some(route => path === route || path.startsWith(route + '/'));
}

// Helper to get module from product name
export function getModuleFromProductName(productName: string): AppModule | null {
  for (const [moduleId, config] of Object.entries(MODULE_CONFIGS)) {
    if (config.productName.toLowerCase() === productName.toLowerCase()) {
      return moduleId as AppModule;
    }
  }
  return null;
}

