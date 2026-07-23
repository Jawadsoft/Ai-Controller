// Permission mapping for pages and features
export const PERMISSION_MAP = {
  // Core Pages
  DASHBOARD: [], // Basic access for all authenticated users
  PROFILE: [], // Basic access for all authenticated users
  
  // Vehicle Management
  VEHICLES: ['vehicle_import'],
  VEHICLE_DETAIL: ['vehicle_import'],
  VEHICLE_QR: ['qr_code_generation'],
  ETL: ['vehicle_import'],
  IMPORT: ['vehicle_import'],
  
  // Lead Management
  LEADS: ['lead_management'],
  LEAD_DETAIL: ['lead_management'],
  CONVERSATION_MONITOR: ['lead_management'],
  
  // Finance & Lease Management
  FINANCE: ['finance_management'],
  FINANCE_DEALS: ['finance_management'],
  FINANCE_PROGRAMS: ['finance_management'],
  CREDIT_APPLICATIONS: ['finance_management'],
  LENDERS: ['finance_management'],
  
  // Rebate Management
  REBATES: ['rebate_management'],
  
  // Analytics & Reporting
  DAIVE_ANALYTICS: ['analytics_dashboard'],
  
  // Administration
  SUPER_ADMIN: [], // Requires super_admin role (handled separately)
  USER_MANAGEMENT: [], // Requires super_admin role (handled separately)
  STAFF_MANAGEMENT: ['staff_management'],
  CREWAI_AGENTS: ['staff_management'],
  CUSTOMER_MANAGEMENT: ['customer_management'],
  
  // Daive & Follow-up Settings
  DAIVE_SETTINGS: ['daive_settings_management'],
  FOLLOWUP_SETTINGS: ['followup_settings_management'],
  
  // AI Bot Features
  AI_BOT: [], // Basic access for all authenticated users
  AIBOT_NAVIGATION: [], // Basic access for all authenticated users
  OPTIMIZED_AIBOT: [], // Basic access for all authenticated users
  AIBOT_COMPARISON: [], // Basic access for all authenticated users
  AIBOT_DEALER_QR: [], // Basic access for all authenticated users
  
  // Public/Unauthenticated
  INDEX: [], // Public access
  AUTH: [], // Public access
  EMAIL_VERIFICATION: [], // Public access
} as const;

// Role-based access levels
export const ROLE_ACCESS = {
  SUPER_ADMIN: {
    level: 4,
    description: 'Full platform access',
    canAccess: () => true, // Super admin can access everything
  },
  ADMIN: {
    level: 3,
    description: 'Dealership administrator',
    canAccess: (permissions: string[]) => {
      // Admin has access to most features except super admin functions
      return permissions.length > 0;
    },
  },
  SALES: {
    level: 2,
    description: 'Sales representative',
    canAccess: (permissions: string[]) => {
      return permissions.includes('lead_management') || 
             permissions.includes('vehicle_import') ||
             permissions.includes('qr_code_generation');
    },
  },
  FINANCE: {
    level: 2,
    description: 'Finance manager',
    canAccess: (permissions: string[]) => {
      return permissions.includes('finance_management') ||
             permissions.includes('lead_management') || 
             permissions.includes('analytics_dashboard');
    },
  },
  SERVICE: {
    level: 1,
    description: 'Service advisor',
    canAccess: (permissions: string[]) => {
      return permissions.includes('lead_management');
    },
  },
  INVENTORY: {
    level: 2,
    description: 'Inventory manager',
    canAccess: (permissions: string[]) => {
      return permissions.includes('vehicle_import') || 
             permissions.includes('qr_code_generation');
    },
  },
} as const;

// Feature descriptions for better UX
export const FEATURE_DESCRIPTIONS = {
  qr_code_generation: 'Generate QR codes for vehicles',
  lead_management: 'Manage customer leads and follow-ups',
  vehicle_import: 'Import and manage vehicle inventory',
  analytics_dashboard: 'Access analytics and reporting',
  bulk_actions: 'Perform bulk operations on data',
  staff_management: 'Manage dealership staff members',
  finance_management: 'Manage finance and lease programs, deals, and credit applications',
  rebate_management: 'Manage vehicle rebates and incentive programs',
  user_management: 'Manage user accounts and access',
  custom_branding: 'Customize dealership branding',
  api_access: 'Access to API endpoints',
  priority_support: 'Access to priority customer support',
  daive_settings_management: 'Configure Daive AI bot settings and behavior',
  followup_settings_management: 'Configure automatic follow-up rules and timing',
  customer_management: 'Manage customer records and information',
} as const;

export type PermissionKey = keyof typeof PERMISSION_MAP;
export type RoleKey = keyof typeof ROLE_ACCESS;
export type FeatureKey = keyof typeof FEATURE_DESCRIPTIONS;




