/**
 * Backend API - Central Export
 * Import all API functions from here
 */

export {
  getAdminUsers,
  getUserById,
  createUser,
  updateUserRole,
  deleteUser,
  resetUserPassword,
  updateUserAccountStatus
} from './users';

export {
  getConsumers,
  getConsumerById,
  createConsumer,
  updateConsumer,
  deleteConsumer,
  resetConsumerPassword,
  updateConsumerAccountStatus,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  reassignConsumerToReseller,
  getConsumerProductSettings,
  updateConsumerProductSettings
} from './consumers';

export {
  getResellers,
  getResellerById,
  createReseller,
  updateReseller,
  deleteReseller,
  resetResellerPassword,
  updateResellerAccountStatus,
  getMyResellers,
  createMyReseller,
  inviteReseller,
  updateMyReseller,
  deleteMyReseller
} from './resellers';

export {
  getAllProducts as getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from './products';

export {
  getAllPackages,
  getPackageById,
  getPackagesByProduct,
  createPackage,
  updatePackage,
  deletePackage
} from './packages';

export {
  getAllInvoices,
  getMyInvoices,
  getConsumerProductsForInvoice,
  getConsumerPackagesForInvoice,
  createInvoice
} from './invoices';

export {
  getDashboardStats,
  getResellerStats
} from './dashboard';

export {
  getActivityLogs,
  getActivityLogById
} from './activityLogs';

export {
  getErrorLogs,
  getErrorLogById,
  createErrorLog
} from './errorLogs';

export {
  createTicket,
  getTickets,
  getTicket,
  addMessage,
  updateTicketStatus,
  getTicketStats,
  generateAiResponse,
  exportTickets
} from './customerSupport';

export {
  getDefaultCommission,
  updateDefaultCommission,
  getMyCommission,
  getResellerCommission,
  setResellerCommission,
  resetResellerCommission,
  getResellerSettings,
  updateResellerSettings
} from './settings';

export {
  getAllPermissions,
  getPermissionById,
  getMyPermissions,
  getUserPermissions,
  getRolePermissions,
  checkUserPermission,
  assignPermissionsToRole,
  removePermissionsFromRole,
  assignPermissionsToUser,
  removePermissionsFromUser,
  setSystemAdmin
} from './permissions';

export {
  impersonateUser
} from './auth';

export {
  getApiKeys,
  getApiKeyById,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  regenerateApiSecret
} from './apiKeys';

// Re-export API client for direct access if needed
export { default as apiClient } from '../../services/apiClient';

