import { supabase, supabaseAdmin, billingSupabaseAdmin } from '../../config/database.js';
import { sendInvoiceCreatedEmail } from '../../services/emailService.js';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeString,
  isValidUUID,
  validatePagination,
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  validateAndSanitizeSearch,
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole, hasAnyRole } from '../../utils/roleUtils.js';
import PDFDocument from 'pdfkit';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  ALL_INVOICES: (search, status, page, limit) => `invoices:v4:list:${search || 'all'}:${status || 'all'}_page${page}_limit${limit}`,
  MY_INVOICES: (userId, page, limit) => `invoices:v4:my:${userId}_page${page}_limit${limit}`,
  CONSUMER_INVOICES: (consumerId, page, limit) => `invoices:v4:consumer:${consumerId}_page${page}_limit${limit}`,
  CONSUMER_PRODUCTS: (consumerId) => `invoices:consumer-products:${consumerId}`,
  CONSUMER_PACKAGES: (consumerId) => `invoices:v4:consumer-packages:${consumerId}`,
  INVOICE_BY_ID: (id) => `invoices:id:${id}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('invoices', 100);

const fetchBillingPackageMaps = async (invoices = []) => {
  const items = invoices.flatMap(invoice => invoice.invoice_items || []);
  const packageIds = Array.from(new Set(items.map(item => item.package_id).filter(Boolean)));
  const packagePrices = Array.from(new Set(
    items
      .map(item => parseFloat(item.unit_price))
      .filter(price => Number.isFinite(price) && price >= 0)
  ));

  let packageMap = new Map();
  let priceMap = new Map();
  let productMap = new Map();
  const packageSource = 'public.packages view -> billing.packages';

  console.log('[invoice-package-debug] resolver input', {
    invoiceCount: invoices.length,
    itemCount: items.length,
    packageIds,
    packagePrices,
    packageSource,
    sampleItems: items.slice(0, 10).map(item => ({
      invoice_item_id: item.id,
      package_id: item.package_id,
      product_id: item.product_id,
      unit_price: item.unit_price,
      joined_package_name: item.packages?.name || null,
      joined_product_name: item.products?.name || item.packages?.products?.name || null
    }))
  });

  if (packageIds.length > 0) {
    const packagesPromise = billingSupabaseAdmin
      .from('packages')
      .select('id, name, price, product_id, product_type')
      .in('id', packageIds);

    const { data: billingPackages, error: packagesError } = await executeWithTimeout(packagesPromise, 5000);

    if (packagesError) {
      console.warn('[invoice-package-debug] failed billing package lookup by id', {
        message: packagesError.message,
        code: packagesError.code,
        details: packagesError.details,
        hint: packagesError.hint
      });
    } else {
      console.log('[invoice-package-debug] billing packages by id result', {
        requestedIds: packageIds,
        foundCount: billingPackages?.length || 0,
        found: (billingPackages || []).map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          price: pkg.price,
          product_id: pkg.product_id,
          product_type: pkg.product_type
        })),
        missingIds: packageIds.filter(id => !(billingPackages || []).some(pkg => pkg.id === id))
      });
      packageMap = new Map((billingPackages || []).map(pkg => [pkg.id, pkg]));
    }
  }

  if (packagePrices.length > 0) {
    const packagesByPricePromise = billingSupabaseAdmin
      .from('packages')
      .select('id, name, price, product_id, product_type')
      .in('price', packagePrices);

    const { data: packagesByPrice, error: packagesByPriceError } = await executeWithTimeout(packagesByPricePromise, 5000);

    if (packagesByPriceError) {
      console.warn('[invoice-package-debug] failed billing package lookup by price', {
        message: packagesByPriceError.message,
        code: packagesByPriceError.code,
        details: packagesByPriceError.details,
        hint: packagesByPriceError.hint
      });
    } else {
      console.log('[invoice-package-debug] billing packages by price result', {
        requestedPrices: packagePrices,
        foundCount: packagesByPrice?.length || 0,
        found: (packagesByPrice || []).map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          price: pkg.price,
          product_id: pkg.product_id,
          product_type: pkg.product_type
        }))
      });

      const packagesByPriceGroups = (packagesByPrice || []).reduce((groups, pkg) => {
        const key = parseFloat(pkg.price || 0).toFixed(2);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(pkg);
        return groups;
      }, new Map());

      priceMap = new Map(
        Array.from(packagesByPriceGroups.entries())
          .filter(([, matches]) => matches.length === 1)
          .map(([price, matches]) => [price, matches[0]])
      );

      console.log('[invoice-package-debug] unique price fallback map', {
        entries: Array.from(priceMap.entries()).map(([price, pkg]) => ({
          price,
          id: pkg.id,
          name: pkg.name,
          product_id: pkg.product_id,
          product_type: pkg.product_type
        })),
        ambiguousPrices: Array.from(packagesByPriceGroups.entries())
          .filter(([, matches]) => matches.length > 1)
          .map(([price, matches]) => ({
            price,
            matches: matches.map(pkg => ({ id: pkg.id, name: pkg.name, product_type: pkg.product_type }))
          }))
      });
    }
  }

  const productIds = Array.from(new Set([
    ...items.map(item => item.product_id).filter(Boolean),
    ...Array.from(packageMap.values()).map(pkg => pkg.product_id).filter(Boolean),
    ...Array.from(priceMap.values()).map(pkg => pkg.product_id).filter(Boolean)
  ]));

  if (productIds.length > 0) {
    const productsPromise = supabaseAdmin
      .from('products')
      .select('id, name, price')
      .in('id', productIds);

    const { data: products, error: productsError } = await executeWithTimeout(productsPromise, 3000);

    if (productsError) {
      console.warn('[invoice-package-debug] failed product lookup', {
        message: productsError.message,
        code: productsError.code,
        details: productsError.details,
        hint: productsError.hint
      });
    } else {
      console.log('[invoice-package-debug] products lookup result', {
        requestedIds: productIds,
        foundCount: products?.length || 0,
        found: (products || []).map(product => ({ id: product.id, name: product.name }))
      });
      productMap = new Map((products || []).map(product => [product.id, product]));
    }
  }

  return { packageMap, priceMap, productMap };
};

const getProductTypeLabel = (productType) => {
  if (!productType) return null;
  return productType
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const setNoStoreHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
};

const formatInvoicePackages = (invoice, packageMap = new Map(), productMap = new Map(), priceMap = new Map()) => (
  invoice.invoice_items?.map(item => {
    const itemPriceKey = parseFloat(item.unit_price || 0).toFixed(2);
    const billingPackage = (item.package_id ? packageMap.get(item.package_id) : null) || priceMap.get(itemPriceKey) || null;
    const packageName = billingPackage?.name || item.packages?.name || item.products?.name || 'Unknown Package';
    const productId = billingPackage?.product_id || item.product_id || item.packages?.product_id || item.products?.id || null;
    const product = productId ? productMap.get(productId) : null;
    const productName = product?.name || item.packages?.products?.name || getProductTypeLabel(billingPackage?.product_type);
    const displayName = productName ? `${productName} - ${packageName}` : packageName;

    if (packageName === 'Unknown Package' && (item.package_id || item.product_id)) {
      console.warn('[invoice-package-debug] unresolved invoice item', {
        invoice_id: invoice.id,
        invoice_created_at: invoice.created_at,
        invoice_notes: invoice.notes,
        invoice_status: invoice.status,
        invoice_item_id: item.id,
        package_id: item.package_id,
        product_id: item.product_id,
        unit_price: item.unit_price,
        total_price: item.total_price,
        itemPriceKey,
        packageMapHasId: item.package_id ? packageMap.has(item.package_id) : false,
        priceMapHasPrice: priceMap.has(itemPriceKey),
        joined_package: item.packages || null,
        joined_product: item.products || null
      });
    }

    return {
      package_id: item.package_id || billingPackage?.id || null,
      product_id: productId,
      name: displayName,
      product_name: productName,
      package_name: packageName,
      quantity: item.quantity,
      price: parseFloat(item.unit_price || 0).toFixed(2),
      total: parseFloat(item.total_price || 0).toFixed(2)
    };
  }) || []
);

const attachInvoiceItems = async (invoices = []) => {
  const invoiceIds = Array.from(new Set((invoices || []).map(invoice => invoice.id).filter(Boolean)));

  if (invoiceIds.length === 0) {
    return invoices || [];
  }

  const itemsPromise = billingSupabaseAdmin
    .from('invoice_items')
    .select('id, invoice_id, package_id, product_id, quantity, unit_price, tax_rate, total_price')
    .in('invoice_id', invoiceIds);

  const { data: items, error } = await executeWithTimeout(itemsPromise, 5000);

  if (error) {
    console.error('[invoice-package-debug] failed invoice_items lookup', {
      invoiceIds,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }

  const itemsByInvoiceId = (items || []).reduce((groups, item) => {
    if (!groups.has(item.invoice_id)) groups.set(item.invoice_id, []);
    groups.get(item.invoice_id).push(item);
    return groups;
  }, new Map());

  return (invoices || []).map(invoice => {
    const invoiceItems = itemsByInvoiceId.get(invoice.id) || [];
    const fallbackItem = invoiceItems.length === 0 && invoice.package_id
      ? [{
          id: `${invoice.id}-package`,
          invoice_id: invoice.id,
          package_id: invoice.package_id,
          product_id: null,
          quantity: 1,
          unit_price: invoice.subtotal || invoice.total_amount || 0,
          tax_rate: invoice.tax_rate || 0,
          total_price: invoice.total_amount || invoice.subtotal || 0
        }]
      : [];

    return {
      ...invoice,
      invoice_items: invoiceItems.length > 0 ? invoiceItems : fallbackItem
    };
  });
};

/**
 * Invoices Controller
 * Handles invoice-related operations
 */

/**
 * Get consumer's accessed products with prices for invoice creation
 * @route   GET /api/invoices/consumer/:consumerId/products
 * @access  Private (Admin or Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Redis caching (Performance)
 */
export const getConsumerProductsForInvoice = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { consumerId } = req.params;
    
    if (!consumerId || !isValidUUID(consumerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid consumer ID format'
      });
    }

    console.log('🔍 getConsumerProductsForInvoice called with consumerId:', consumerId);
    
    const senderId = req.user.id; // Admin or Reseller creating the invoice
    const senderRole = req.userProfile?.role;
    
    console.log('🔍 Sender ID:', senderId, 'Role:', senderRole);

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.CONSUMER_PRODUCTS(consumerId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for consumer products ${consumerId}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for consumer products ${consumerId} - fetching from database`);

    // ========================================
    // 3. VERIFY CONSUMER (with timeout)
    // ========================================
    const consumerPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by')
      .eq('user_id', consumerId)
      .contains('role', ['consumer'])
      .single();

    const { data: consumer, error: consumerError } = await executeWithTimeout(consumerPromise);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (consumerError || !consumer) {
      console.error('❌ Consumer not found:', consumerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // If reseller, verify this consumer is referred by them
    if (senderRole === 'reseller') {
      if (!consumer.referred_by || consumer.referred_by !== senderId) {
        console.error('❌ Reseller permission denied');
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only create invoices for your referred consumers'
        });
      }
    }

    // ========================================
    // 5. GET PRODUCT ACCESS (with timeout)
    // ========================================
    const productAccessPromise = supabaseAdmin
      .from('user_product_access')
      .select('product_id, granted_at')
      .eq('user_id', consumerId);

    const { data: productAccess, error: accessError } = await executeWithTimeout(productAccessPromise, 5000);

    if (accessError) {
      console.error('❌ Error fetching product access:', accessError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch product access'
      });
    }

    if (!productAccess || productAccess.length === 0) {
      const response = {
        success: true,
        data: {
          consumer: {
            user_id: consumer.user_id,
            full_name: consumer.full_name,
            email: consumer.email
          },
          products: []
        }
      };
      await cacheService.set(cacheKey, response, CACHE_TTL);
      return res.json(response);
    }

    // ========================================
    // 6. GET PRODUCT DETAILS (with timeout)
    // ========================================
    const productIds = productAccess.map(pa => pa.product_id);
    const productsPromise = supabaseAdmin
      .from('products')
      .select('id, name, price, description')
      .in('id', productIds);

    const { data: products, error: productsError } = await executeWithTimeout(productsPromise, 5000);

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch products'
      });
    }

    // ========================================
    // 7. COMBINE DATA & SANITIZE
    // ========================================
    const productsWithAccess = (products || []).map(product => {
      const access = productAccess.find(pa => pa.product_id === product.id);
      return {
        product_id: product.id,
        product_name: product.name,
        price: parseFloat(product.price || 0),
        description: product.description,
        granted_at: access?.granted_at
      };
    });

    const response = {
      success: true,
      data: {
        consumer: {
          user_id: consumer.user_id,
          full_name: consumer.full_name,
          email: consumer.email
        },
        products: sanitizeArray(productsWithAccess)
      }
    };

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    return res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching consumer products.');
  }
};

/**
 * Get consumer's accessed packages with prices for invoice creation
 * @route   GET /api/invoices/consumer/:consumerId/packages
 * @access  Private (Admin or Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Redis caching (Performance)
 */
export const getConsumerPackagesForInvoice = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { consumerId } = req.params;
    
    if (!consumerId || !isValidUUID(consumerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid consumer ID format'
      });
    }

    console.log('🔍 getConsumerPackagesForInvoice called with consumerId:', consumerId);
    
    const senderId = req.user.id; // Admin or Reseller creating the invoice
    const senderRole = req.userProfile?.role;
    
    console.log('🔍 Sender ID:', senderId, 'Role:', senderRole);

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.CONSUMER_PACKAGES(consumerId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for consumer packages ${consumerId}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for consumer packages ${consumerId} - fetching from database`);

    // ========================================
    // 3. VERIFY CONSUMER (with timeout)
    // ========================================
    const consumerPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by')
      .eq('user_id', consumerId)
      .contains('role', ['consumer'])
      .single();

    const { data: consumer, error: consumerError } = await executeWithTimeout(consumerPromise);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (consumerError || !consumer) {
      console.error('❌ Consumer not found:', consumerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // If reseller, verify this consumer is referred by them
    if (senderRole === 'reseller') {
      if (!consumer.referred_by || consumer.referred_by !== senderId) {
        console.error('❌ Reseller permission denied');
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only create invoices for your referred consumers'
        });
      }
    }

    // ========================================
    // 5. GET PACKAGE ACCESS (with timeout)
    // ========================================
    const packageAccessPromise = supabaseAdmin
      .from('user_package_access')
      .select('package_id, granted_at')
      .eq('user_id', consumerId);

    const { data: packageAccess, error: accessError } = await executeWithTimeout(packageAccessPromise, 5000);

    if (accessError) {
      console.error('❌ Error fetching package access:', accessError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch package access'
      });
    }

    if (!packageAccess || packageAccess.length === 0) {
      const response = {
        success: true,
        data: {
          consumer: {
            user_id: consumer.user_id,
            full_name: consumer.full_name,
            email: consumer.email
          },
          packages: []
        }
      };
      await cacheService.set(cacheKey, response, CACHE_TTL);
      return res.json(response);
    }

    // ========================================
    // 6. GET PACKAGE DETAILS (with timeout)
    // ========================================
    const packageIds = packageAccess.map(pa => pa.package_id);
    const packagesPromise = billingSupabaseAdmin
      .from('packages')
      .select('id, name, price, description, product_id, product_type')
      .in('id', packageIds);

    const { data: packages, error: packagesError } = await executeWithTimeout(packagesPromise, 5000);

    if (packagesError) {
      console.error('❌ Error fetching packages:', packagesError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch packages'
      });
    }

    const productIds = Array.from(new Set((packages || []).map(pkg => pkg.product_id).filter(Boolean)));
    let productMap = new Map();

    if (productIds.length > 0) {
      const productsPromise = supabaseAdmin
        .from('products')
        .select('id, name')
        .in('id', productIds);

      const { data: products, error: productsError } = await executeWithTimeout(productsPromise, 3000);

      if (productsError) {
        console.warn('Failed to fetch products for consumer packages:', productsError.message);
      } else {
        productMap = new Map((products || []).map(product => [product.id, product]));
      }
    }

    // ========================================
    // 7. COMBINE DATA & SANITIZE
    // ========================================
    const packagesWithAccess = (packages || []).map(pkg => {
      const access = packageAccess.find(pa => pa.package_id === pkg.id);
      return {
        package_id: pkg.id,
        package_name: pkg.name,
        product_id: pkg.product_id,
        product_name: productMap.get(pkg.product_id)?.name || getProductTypeLabel(pkg.product_type),
        price: parseFloat(pkg.price || 0),
        description: pkg.description,
        granted_at: access?.granted_at
      };
    });

    const response = {
      success: true,
      data: {
        consumer: {
          user_id: consumer.user_id,
          full_name: consumer.full_name,
          email: consumer.email
        },
        packages: sanitizeArray(packagesWithAccess)
      }
    };

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    return res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching consumer packages.');
  }
};

/**
 * Get all invoices with pagination (admin only)
 * @route   GET /api/invoices?search=john&status=paid&page=1&limit=50
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Pagination support (Performance)
 * 3. Query timeout (Performance)
 * 4. Better error handling (Security)
 * 5. Data sanitization (Security)
 * 6. Redis caching (Performance)
 */
export const getAllInvoices = async (req, res) => {
  try {
    setNoStoreHeaders(res);

    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { search, status, page, limit } = req.query;
    const senderRole = req.userProfile?.role;

    // Only admin or support can see all invoices
    if (!hasRole(senderRole, 'admin') && !hasRole(senderRole, 'support')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin or Support access required'
      });
    }

    // Validate and sanitize search input
    const searchTerm = validateAndSanitizeSearch(search, 100);
    if (search && !searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid search term. Only alphanumeric characters, spaces, @, ., _, and - are allowed.'
      });
    }

    // Validate status
    const validStatuses = ['paid', 'unpaid', 'under_review', 'all'];
    const statusFilter = status && validStatuses.includes(status) ? status : 'all';
    const billingStatusFilterMap = {
      unpaid: ['unpaid', 'pending', 'draft', 'sent', 'overdue'],
      under_review: ['under_review', 'processing'],
      paid: ['paid']
    };
    const billingStatuses = billingStatusFilterMap[statusFilter] || null;

    // Validate pagination parameters
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ALL_INVOICES(searchTerm || '', statusFilter, pageNum, limitNum);
    console.log('[invoice-package-debug] getAllInvoices request', {
      query: req.query,
      statusFilter,
      billingStatuses,
      pageNum,
      limitNum,
      cacheKey,
      userId: req.user?.id
    });

    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('[invoice-package-debug] Cache HIT for invoices list', {
        cacheKey,
        invoiceCount: cachedData?.data?.length || 0,
        firstInvoicePackages: cachedData?.data?.[0]?.packages || []
      });
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for invoices list - fetching from database');

    // ========================================
    // 3. OPTIMIZED DATABASE QUERY
    // ========================================
    let query = billingSupabaseAdmin
      .from('invoices')
      .select(`
        id,
        sender_id,
        receiver_id,
        user_id,
        issue_date,
        due_date,
        total_amount,
        tax_total,
        status,
        notes,
        created_at,
        updated_at,
        reseller_commission_percentage,
        applied_offer_id,
        commission_calculated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Billing invoices use draft/sent/overdue for records the admin UI groups as unpaid.
    if (billingStatuses) {
      query = query.in('status', billingStatuses);
    }

    // Note: Search filtering done in application layer after fetching
    // Pagination applied after search filtering

    const { data: rawInvoices, error, count } = await executeWithTimeout(query);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (error) {
      console.error('❌ Error fetching invoices:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch invoices. Please try again.'
      });
    }

    console.log('[invoice-package-debug] raw invoice query result', {
      count: rawInvoices?.length || 0,
      dbCount: count,
      sampleInvoices: (rawInvoices || []).slice(0, 5).map(invoice => ({
        id: invoice.id,
        status: invoice.status,
        notes: invoice.notes,
        created_at: invoice.created_at
      }))
    });

    const invoices = await attachInvoiceItems(rawInvoices || []);

    // ========================================
    // 5. ENRICH WITH EMAIL (with timeout)
    // ========================================
    const receiverIds = Array.from(new Set((invoices || []).map(inv => inv.receiver_id || inv.user_id).filter(Boolean)));
    const senderIds = Array.from(new Set((invoices || []).map(inv => inv.sender_id).filter(Boolean)));

    const receiverProfilesPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('user_id, email, full_name, role, referred_by')
      .in('user_id', receiverIds.length ? receiverIds : ['00000000-0000-0000-0000-000000000000']);

    const senderProfilesPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('user_id, email, full_name, role')
      .in('user_id', senderIds.length ? senderIds : ['00000000-0000-0000-0000-000000000000']);

    const [
      { data: receiverProfiles },
      { data: senderProfiles }
    ] = await Promise.all([
      executeWithTimeout(receiverProfilesPromise, 5000),
      executeWithTimeout(senderProfilesPromise, 5000)
    ]);

    const receiverIdToEmail = new Map((receiverProfiles || []).map(p => [p.user_id, p.email]));
    const receiverIdToProfile = new Map((receiverProfiles || []).map(p => [p.user_id, p]));
    const senderIdToProfile = new Map((senderProfiles || []).map(p => [p.user_id, { email: p.email, full_name: p.full_name, role: p.role }]));

    const { packageMap, priceMap, productMap } = await fetchBillingPackageMaps(invoices || []);

    // Format invoices for frontend
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number || `INV-${invoice.created_at?.split('T')[0]?.replace(/-/g, '')}-${invoice.id.substring(0, 8).toUpperCase()}`,
      consumer_id: invoice.receiver_id || invoice.user_id,
      consumer_name: receiverIdToProfile.get(invoice.receiver_id || invoice.user_id)?.full_name || 'Unknown',
      consumer_email: receiverIdToEmail.get(invoice.receiver_id || invoice.user_id) || '',
      referred_by: receiverIdToProfile.get(invoice.receiver_id || invoice.user_id)?.referred_by || null,
      reseller_id: invoice.sender_id,
      reseller_name: hasRole(senderIdToProfile.get(invoice.sender_id)?.role, 'reseller')
        ? (senderIdToProfile.get(invoice.sender_id)?.full_name || 'Unknown Reseller')
        : null,
      invoice_date: invoice.issue_date || invoice.invoice_date,
      due_date: invoice.due_date,
      amount: parseFloat(invoice.subtotal ?? ((invoice.total_amount || 0) - (invoice.tax_total || invoice.tax_amount || 0))).toFixed(2),
      tax: parseFloat(invoice.tax_total || invoice.tax_amount || 0).toFixed(2),
      total: parseFloat(invoice.total_amount || 0).toFixed(2),
      status: invoice.status || 'unpaid',
      payment_date: invoice.status === 'paid' ? invoice.updated_at : null,
      packages: formatInvoicePackages(invoice, packageMap, productMap, priceMap),
      notes: invoice.notes,
      created_at: invoice.created_at
    }));

    console.log('[invoice-package-debug] formatted invoice sample', {
      sampleInvoices: formattedInvoices.slice(0, 5).map(invoice => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        notes: invoice.notes,
        packages: invoice.packages
      }))
    });

    // ========================================
    // 6. APPLY SEARCH FILTER
    // ========================================
    let filteredInvoices = formattedInvoices;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredInvoices = formattedInvoices.filter(inv => 
        inv.invoice_number?.toLowerCase().includes(searchLower) ||
        inv.consumer_name?.toLowerCase().includes(searchLower) ||
        inv.consumer_email?.toLowerCase().includes(searchLower) ||
        inv.reseller_name?.toLowerCase().includes(searchLower)
      );
    }

    // ========================================
    // 7. PAGINATION
    // ========================================
    const totalCount = filteredInvoices.length;
    const startIndex = offset;
    const endIndex = startIndex + limitNum;
    const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

    // ========================================
    // 8. DATA SANITIZATION (Security)
    // ========================================
    const sanitizedInvoices = sanitizeArray(paginatedInvoices);

    // ========================================
    // 9. RESPONSE STRUCTURE
    // ========================================
    const response = {
      success: true,
      data: sanitizedInvoices,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: endIndex < totalCount
      },
      filters: {
        search: searchTerm || '',
        status: statusFilter
      }
    };

    // ========================================
    // 10. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    return res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching invoices.');
  }
};

/**
 * Get invoices for reseller's referred consumers
 * @route   GET /api/invoices/my-invoices
 * @access  Private (Reseller)
 */
/**
 * Get my invoices (reseller only)
 * @route   GET /api/invoices/my?search=&status=&page=1&limit=50
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Pagination support (Performance)
 * 3. Query timeout (Performance)
 * 4. Redis caching (Performance)
 * 5. Secure error handling (Security)
 */
export const getMyInvoices = async (req, res) => {
  try {
    setNoStoreHeaders(res);

    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const senderId = req.user.id;
    const senderRole = req.userProfile?.role;
    let { search, status, page, limit } = req.query;

    // Only resellers can access this endpoint (check if role array contains 'reseller')
    if (!hasRole(senderRole, 'reseller')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Reseller access required'
      });
    }

    // Validate pagination
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Sanitize search
    search = search ? validateAndSanitizeSearch(search) : null;

    // Validate status
    const validStatuses = ['all', 'paid', 'unpaid', 'under_review', 'pending'];
    const statusFilter = status && validStatuses.includes(status) ? status : null;

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.MY_INVOICES(senderId, pageNum, limitNum);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData && !search && !statusFilter) {
      console.log(`✅ Cache HIT for my invoices ${senderId}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for my invoices ${senderId} - fetching from database`);

    // ========================================
    // 3. BUILD QUERY
    // ========================================
    let query = billingSupabaseAdmin
      .from('invoices')
      .select(`
        id,
        sender_id,
        receiver_id,
        issue_date,
        due_date,
        total_amount,
        tax_total,
        status,
        notes,
        created_at,
        updated_at,
        reseller_commission_percentage,
        applied_offer_id,
        commission_calculated_at,
        commission_calculated_at
      `, { count: 'exact' })
      .eq('sender_id', senderId)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // ========================================
    // 4. EXECUTE QUERY WITH TIMEOUT
    // ========================================
    const { data: rawInvoices, error, count } = await executeWithTimeout(query.range(offset, offset + limitNum - 1));

    if (error) {
      console.error('❌ Error fetching reseller invoices:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch invoices. Please try again.'
      });
    }

    // ========================================
    // 5. ENRICH WITH EMAIL (with timeout)
    // ========================================
    const invoices = await attachInvoiceItems(rawInvoices || []);

    const receiverIds = Array.from(new Set((invoices || []).map(inv => inv.receiver_id).filter(Boolean)));
    let receiverIdToEmail = new Map();
    let receiverIdToProfile = new Map();
    
    if (receiverIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, email, full_name, role, referred_by')
        .in('user_id', receiverIds);

      const { data: receiverProfiles } = await executeWithTimeout(profilesPromise, 3000);
      receiverIdToEmail = new Map((receiverProfiles || []).map(p => [p.user_id, p.email]));
      receiverIdToProfile = new Map((receiverProfiles || []).map(p => [p.user_id, p]));
    }

    // ========================================
    // 6. FETCH OFFER DETAILS (with timeout)
    // ========================================
    const offerIds = Array.from(new Set((invoices || []).map(inv => inv.applied_offer_id).filter(Boolean)));
    let offerMap = new Map();
    
    if (offerIds.length > 0) {
      const offersPromise = supabaseAdmin
        .from('offers')
        .select('id, name, commission_percentage')
        .in('id', offerIds);

      const { data: offers } = await executeWithTimeout(offersPromise, 3000);
      if (offers) {
        offers.forEach(offer => {
          offerMap.set(offer.id, offer);
        });
      }
    }

    const { packageMap, priceMap, productMap } = await fetchBillingPackageMaps(invoices || []);

    // Format invoices for frontend
    const formattedInvoices = invoices.map(invoice => {
      const offer = invoice.applied_offer_id ? offerMap.get(invoice.applied_offer_id) : null;
      
      return {
        id: invoice.id,
        invoice_number: `INV-${invoice.created_at?.split('T')[0]?.replace(/-/g, '')}-${invoice.id.substring(0, 8).toUpperCase()}`,
        consumer_id: invoice.receiver_id,
        consumer_name: receiverIdToProfile.get(invoice.receiver_id)?.full_name || 'Unknown',
        consumer_email: receiverIdToEmail.get(invoice.receiver_id) || '',
        referred_by: receiverIdToProfile.get(invoice.receiver_id)?.referred_by || null,
        reseller_id: senderId,
        reseller_name: null, // Not needed for reseller view
        invoice_date: invoice.issue_date,
        due_date: invoice.due_date,
        amount: parseFloat((invoice.total_amount || 0) - (invoice.tax_total || 0)).toFixed(2),
        tax: parseFloat(invoice.tax_total || 0).toFixed(2),
        total: parseFloat(invoice.total_amount || 0).toFixed(2),
        total_amount: parseFloat(invoice.total_amount || 0), // Keep as number for calculations
        status: invoice.status || 'unpaid',
        payment_date: invoice.status === 'paid' ? invoice.updated_at : null,
        reseller_commission_percentage: invoice.reseller_commission_percentage ? parseFloat(invoice.reseller_commission_percentage) : null,
        applied_offer_id: invoice.applied_offer_id || null,
        commission_calculated_at: invoice.commission_calculated_at || null,
        applied_offer: offer ? {
          id: offer.id,
          name: offer.name,
          commission_percentage: parseFloat(offer.commission_percentage)
        } : null,
        packages: formatInvoicePackages(invoice, packageMap, productMap, priceMap),
        notes: invoice.notes,
        created_at: invoice.created_at
      };
    });

    // ========================================
    // 7. APPLY SEARCH FILTER
    // ========================================
    let filteredInvoices = formattedInvoices;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredInvoices = formattedInvoices.filter(inv => 
        inv.invoice_number?.toLowerCase().includes(searchLower) ||
        inv.consumer_name?.toLowerCase().includes(searchLower) ||
        inv.consumer_email?.toLowerCase().includes(searchLower)
      );
    }

    // ========================================
    // 8. DATA SANITIZATION
    // ========================================
    const sanitizedInvoices = sanitizeArray(filteredInvoices);

    // ========================================
    // 9. RESPONSE STRUCTURE
    // ========================================
    const response = createPaginatedResponse(sanitizedInvoices, count || filteredInvoices.length, pageNum, limitNum);

    // ========================================
    // 10. CACHE THE RESPONSE (only if no search/filter)
    // ========================================
    if (!search && !statusFilter) {
      await cacheService.set(cacheKey, response, CACHE_TTL);
    }

    return res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching invoices.');
  }
};

/**
 * Get invoices for a specific consumer
 * @route   GET /api/invoices/consumer/:consumerId?page=1&limit=10
 * @access  Private (Admin or Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, pagination)
 * 2. Redis caching (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getConsumerInvoices = async (req, res) => {
  try {
    setNoStoreHeaders(res);

    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { consumerId } = req.params;
    const { page, limit } = req.query;
    const senderId = req.user.id;
    const senderRole = req.userProfile?.role;

    if (!consumerId || !isValidUUID(consumerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid consumer ID format'
      });
    }

    // Validate pagination
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.CONSUMER_INVOICES(consumerId, pageNum, limitNum);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for consumer invoices ${consumerId}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for consumer invoices ${consumerId} - fetching from database`);

    // ========================================
    // 3. VERIFY CONSUMER EXISTS (with timeout)
    // ========================================
    const consumerPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by')
      .eq('user_id', consumerId)
      .contains('role', ['consumer'])
      .single();

    const { data: consumer, error: consumerError } = await executeWithTimeout(consumerPromise);

    if (consumerError || !consumer) {
      console.error('❌ Error fetching consumer:', consumerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // If reseller, verify this consumer is referred by them
    if (senderRole === 'reseller') {
      if (!consumer.referred_by || consumer.referred_by !== senderId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view invoices for your referred consumers'
        });
      }
    }

    // ========================================
    // 4. BUILD COUNT QUERY (with timeout)
    // ========================================
    let countQuery = billingSupabaseAdmin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', consumerId);

    // For resellers, only show invoices they created
    if (senderRole === 'reseller') {
      countQuery = countQuery.eq('sender_id', senderId);
    }

    const { count: totalCount, error: countError } = await executeWithTimeout(countQuery);

    if (countError) {
      console.error('❌ Error counting consumer invoices:', countError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to count invoices. Please try again.'
      });
    }

    // ========================================
    // 5. BUILD INVOICES QUERY (with timeout)
    // ========================================
    let query = billingSupabaseAdmin
      .from('invoices')
      .select(`
        id,
        sender_id,
        receiver_id,
        issue_date,
        due_date,
        total_amount,
        tax_total,
        status,
        notes,
        created_at,
        updated_at,
        reseller_commission_percentage,
        applied_offer_id,
        commission_calculated_at
      `)
      .eq('receiver_id', consumerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // For resellers, only show invoices they created
    if (senderRole === 'reseller') {
      query = query.eq('sender_id', senderId);
    }

    const { data: rawInvoices, error } = await executeWithTimeout(query);

    if (error) {
      console.error('❌ Error fetching consumer invoices:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch invoices. Please try again.'
      });
    }

    // ========================================
    // 6. GET SENDER PROFILES (with timeout)
    // ========================================
    const invoices = await attachInvoiceItems(rawInvoices || []);

    const senderIds = Array.from(new Set((invoices || []).map(inv => inv.sender_id).filter(Boolean)));
    let senderIdToProfile = new Map();
    
    if (senderIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, email, full_name, role')
        .in('user_id', senderIds);

      const { data: senderProfiles } = await executeWithTimeout(profilesPromise, 3000);
      senderIdToProfile = new Map((senderProfiles || []).map(p => [p.user_id, { email: p.email, full_name: p.full_name, role: p.role }]));
    }

    // ========================================
    // 7. FETCH OFFER DETAILS (with timeout)
    // ========================================
    const offerIds = Array.from(new Set((invoices || []).map(inv => inv.applied_offer_id).filter(Boolean)));
    let offerMap = new Map();
    
    if (offerIds.length > 0) {
      const offersPromise = supabaseAdmin
        .from('offers')
        .select('id, name, commission_percentage')
        .in('id', offerIds);

      const { data: offers } = await executeWithTimeout(offersPromise, 3000);
      if (offers) {
        offers.forEach(offer => {
          offerMap.set(offer.id, offer);
        });
      }
    }

    const { packageMap, priceMap, productMap } = await fetchBillingPackageMaps(invoices || []);

    // Format invoices for frontend
    const formattedInvoices = invoices.map(invoice => {
      const offer = invoice.applied_offer_id ? offerMap.get(invoice.applied_offer_id) : null;
      
      return {
        id: invoice.id,
        invoice_number: `INV-${invoice.created_at?.split('T')[0]?.replace(/-/g, '')}-${invoice.id.substring(0, 8).toUpperCase()}`,
        consumer_id: consumerId,
        consumer_name: consumer.full_name || 'Unknown',
        consumer_email: consumer.email || '',
        reseller_id: invoice.sender_id,
        reseller_name: senderIdToProfile.get(invoice.sender_id)?.full_name || 'Unknown',
        invoice_date: invoice.issue_date,
        due_date: invoice.due_date,
        amount: parseFloat((invoice.total_amount || 0) - (invoice.tax_total || 0)).toFixed(2),
        tax: parseFloat(invoice.tax_total || 0).toFixed(2),
        total: parseFloat(invoice.total_amount || 0).toFixed(2),
        total_amount: parseFloat(invoice.total_amount || 0), // Keep as number for calculations
        status: invoice.status || 'unpaid',
        payment_date: invoice.status === 'paid' ? invoice.updated_at : null,
        reseller_commission_percentage: invoice.reseller_commission_percentage ? parseFloat(invoice.reseller_commission_percentage) : null,
        applied_offer_id: invoice.applied_offer_id || null,
        commission_calculated_at: invoice.commission_calculated_at || null,
        applied_offer: offer ? {
          id: offer.id,
          name: offer.name,
          commission_percentage: parseFloat(offer.commission_percentage)
        } : null,
        packages: formatInvoicePackages(invoice, packageMap, productMap, priceMap),
        notes: invoice.notes,
        created_at: invoice.created_at
      };
    });

    // ========================================
    // 8. DATA SANITIZATION
    // ========================================
    const sanitizedInvoices = sanitizeArray(formattedInvoices);

    // ========================================
    // 9. RESPONSE STRUCTURE
    // ========================================
    const response = createPaginatedResponse(sanitizedInvoices, totalCount || 0, pageNum, limitNum);

    // ========================================
    // 10. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching consumer invoices.');
  }
};

/**
 * Get a single invoice by ID
 * @route   GET /api/invoices/:id
 * @access  Private (Admin, Support, Reseller, Consumer)
 */
export const getInvoiceById = async (req, res) => {
  try {
    setNoStoreHeaders(res);

    const { id: invoiceId } = req.params;
    const userId = req.user.id;
    const userRole = req.userProfile?.role;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const isAdmin = isSystemAdmin || hasRole(userRole, 'admin') || hasRole(userRole, 'support');
    const isConsumer = hasRole(userRole, 'consumer');
    const isReseller = hasRole(userRole, 'reseller');

    if (!invoiceId || !isValidUUID(invoiceId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid invoice ID format'
      });
    }

    const invoicePromise = billingSupabaseAdmin
      .from('invoices')
      .select(`
        id,
        sender_id,
        receiver_id,
        user_id,
        issue_date,
        due_date,
        total_amount,
        tax_total,
        status,
        notes,
        created_at,
        updated_at,
        reseller_commission_percentage,
        applied_offer_id,
        commission_calculated_at
      `)
      .eq('id', invoiceId)
      .single();

    const { data: rawInvoice, error: invoiceError } = await executeWithTimeout(invoicePromise, 5000);

    if (invoiceError || !rawInvoice) {
      console.error('❌ Error fetching invoice by id:', invoiceError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    const invoiceOwnerId = rawInvoice.receiver_id || rawInvoice.user_id;

    if (!isAdmin) {
      if (isConsumer && invoiceOwnerId !== userId) {
        return res.status(403).json({ success: false, error: 'Forbidden', message: 'Access denied' });
      }

      if (isReseller && rawInvoice.sender_id !== userId) {
        return res.status(403).json({ success: false, error: 'Forbidden', message: 'Access denied' });
      }

      if (!isConsumer && !isReseller) {
        return res.status(403).json({ success: false, error: 'Forbidden', message: 'Access denied' });
      }
    }

    const [invoiceWithItems] = await attachInvoiceItems([rawInvoice]);
    const profileIds = Array.from(new Set([invoiceWithItems.sender_id, invoiceOwnerId].filter(Boolean)));
    let profileMap = new Map();

    if (profileIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, email, full_name, role, referred_by')
        .in('user_id', profileIds);

      const { data: profiles } = await executeWithTimeout(profilesPromise, 3000);
      profileMap = new Map((profiles || []).map(profile => [profile.user_id, profile]));
    }

    const { packageMap, priceMap, productMap } = await fetchBillingPackageMaps([invoiceWithItems]);
    const consumerProfile = profileMap.get(invoiceOwnerId);
    const senderProfile = profileMap.get(invoiceWithItems.sender_id);

    const formattedInvoice = {
      id: invoiceWithItems.id,
      invoice_number: `INV-${invoiceWithItems.created_at?.split('T')[0]?.replace(/-/g, '')}-${invoiceWithItems.id.substring(0, 8).toUpperCase()}`,
      consumer_id: invoiceOwnerId,
      consumer_name: consumerProfile?.full_name || 'Unknown',
      consumer_email: consumerProfile?.email || '',
      referred_by: consumerProfile?.referred_by || null,
      reseller_id: invoiceWithItems.sender_id,
      reseller_name: hasRole(senderProfile?.role, 'reseller') ? (senderProfile?.full_name || 'Unknown Reseller') : null,
      invoice_date: invoiceWithItems.issue_date,
      due_date: invoiceWithItems.due_date,
      amount: parseFloat((invoiceWithItems.total_amount || 0) - (invoiceWithItems.tax_total || 0)).toFixed(2),
      tax: parseFloat(invoiceWithItems.tax_total || 0).toFixed(2),
      total: parseFloat(invoiceWithItems.total_amount || 0).toFixed(2),
      total_amount: parseFloat(invoiceWithItems.total_amount || 0),
      status: invoiceWithItems.status || 'unpaid',
      payment_date: invoiceWithItems.status === 'paid' ? invoiceWithItems.updated_at : null,
      reseller_commission_percentage: invoiceWithItems.reseller_commission_percentage ? parseFloat(invoiceWithItems.reseller_commission_percentage) : null,
      applied_offer_id: invoiceWithItems.applied_offer_id || null,
      commission_calculated_at: invoiceWithItems.commission_calculated_at || null,
      packages: formatInvoicePackages(invoiceWithItems, packageMap, productMap, priceMap),
      notes: invoiceWithItems.notes,
      created_at: invoiceWithItems.created_at
    };

    return res.json({
      success: true,
      data: sanitizeObject(formattedInvoice)
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the invoice.');
  }
};

/**
 * Create invoice with invoice items
 * @route   POST /api/invoices
 * @access  Private (Admin or Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const createInvoice = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const senderId = req.user.id;
    const senderRole = req.userProfile?.role;
    let {
      receiver_id,
      issue_date,
      due_date,
      tax_rate,
      notes,
      items
    } = req.body;

    // Validate required fields
    if (!receiver_id || !issue_date || !due_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required fields: receiver_id, issue_date, due_date, and items are required'
      });
    }

    // Validate UUID format
    if (!isValidUUID(receiver_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid receiver ID format'
      });
    }

    // Sanitize notes
    notes = notes ? sanitizeString(notes, 1000) : null;

    // Validate items array
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'At least one item is required'
      });
    }

    // ========================================
    // 2. VERIFY CONSUMER EXISTS (with timeout)
    // ========================================
    const consumerPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by')
      .eq('user_id', receiver_id)
      .single();

    const { data: consumer, error: consumerError } = await executeWithTimeout(consumerPromise);

    if (consumerError || !consumer) {
      console.error('❌ Error fetching consumer:', consumerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // Verify consumer role
    if (!hasRole(consumer.role, 'consumer')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Receiver must be a consumer'
      });
    }

    // If reseller, verify this consumer is referred by them
    if (senderRole === 'reseller') {
      if (!consumer.referred_by || consumer.referred_by !== senderId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only create invoices for your referred consumers'
        });
      }
    }

    // ========================================
    // 3. VALIDATE ITEMS
    // ========================================
    for (const item of items) {
      if (!item.package_id || !isValidUUID(item.package_id)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Each item must have a valid package_id'
        });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Each item must have quantity > 0'
        });
      }
      if (item.unit_price === undefined || item.unit_price === null || item.unit_price < 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Each item must have unit_price >= 0'
        });
      }
    }

    // ========================================
    // 4. BATCH VERIFY PACKAGES (with timeout)
    // ========================================
    const packageIds = items.map(item => item.package_id);
    const packagesPromise = billingSupabaseAdmin
      .from('packages')
      .select('id, name, price, product_id, product_type')
      .in('id', packageIds);

    const { data: packages, error: packagesError } = await executeWithTimeout(packagesPromise);

    if (packagesError || !packages || packages.length !== packageIds.length) {
      const foundIds = packages?.map(p => p.id) || [];
      const missingIds = packageIds.filter(id => !foundIds.includes(id));
      console.error('❌ Error fetching packages:', packagesError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Packages not found: ${missingIds.join(', ')}`
      });
    }

    // Create packages map for quick lookup
    const packagesMap = new Map(packages.map(p => [p.id, p]));

    // Check if resellers can override package prices (only for resellers)
    const { getResellerSettings } = await import('../../utils/resellerSettings.js');
    const resellerSettings = await getResellerSettings();
    const allowPriceOverride = resellerSettings.allowResellerPriceOverride !== false; // Default to true

    // Validate and calculate totals
    let totalAmount = 0;
    let taxTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!packagesMap.has(item.package_id)) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Package with id ${item.package_id} not found`
        });
      }

      const pkg = packagesMap.get(item.package_id);
      const originalPrice = parseFloat(pkg.price || 0);
      const requestedPrice = parseFloat(item.unit_price || 0);

      // If reseller is creating invoice and price override is not allowed, use original price
      if (senderRole === 'reseller' && !allowPriceOverride) {
        // Use original package price if override is not allowed
        item.unit_price = originalPrice;
      } else if (senderRole === 'reseller' && allowPriceOverride) {
        // If override is allowed, ensure price is >= original price
        if (requestedPrice < originalPrice) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Price override not allowed. Package "${pkg.name}" has a minimum price of $${originalPrice.toFixed(2)}. You cannot set a price lower than the original.`
          });
        }
      }

      const itemTaxRate = item.tax_rate || tax_rate || 0;
      const finalUnitPrice = parseFloat(item.unit_price);
      const itemTotal = finalUnitPrice * item.quantity;
      const itemTax = itemTotal * (itemTaxRate / 100);
      const itemTotalWithTax = itemTotal + itemTax;

      validatedItems.push({
        package_id: item.package_id,
        quantity: parseInt(item.quantity),
        unit_price: finalUnitPrice,
        tax_rate: parseFloat(itemTaxRate),
        total_price: parseFloat(itemTotalWithTax)
      });

      totalAmount += itemTotal;
      taxTotal += itemTax;
    }

    const finalTotalAmount = totalAmount + taxTotal;

    // ========================================
    // 5. CHECK MINIMUM INVOICE AMOUNT
    // ========================================
    if (resellerSettings.minInvoiceAmount !== null && resellerSettings.minInvoiceAmount > 0) {
      if (finalTotalAmount < resellerSettings.minInvoiceAmount) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Invoice amount ($${finalTotalAmount.toFixed(2)}) is below the minimum allowed amount of $${resellerSettings.minInvoiceAmount.toFixed(2)}`
        });
      }
    }

    // ========================================
    // 6. CHECK FOR ACTIVE OFFER (with timeout)
    // ========================================
    let activeOffer = null;
    let resellerCommissionPercentage = null;
    const invoiceDate = issue_date || new Date().toISOString();
    
    try {
      const offersPromise = supabaseAdmin
        .from('offers')
        .select('id, commission_percentage')
        .eq('is_active', true)
        .lte('start_date', invoiceDate)
        .gte('end_date', invoiceDate)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: offers, error: offerError } = await executeWithTimeout(offersPromise, 3000);

      if (!offerError && offers && offers.length > 0) {
        activeOffer = offers[0];
        resellerCommissionPercentage = parseFloat(activeOffer.commission_percentage);
        console.log(`✅ Active offer found for invoice: ${activeOffer.id} with ${resellerCommissionPercentage}% commission`);
      } else {
        // No active offer found - use reseller's default commission
        // If reseller is creating invoice, use their commission
        if (senderRole === 'reseller') {
          // Get reseller's effective commission (custom or default) from profiles table
          const { data: resellerProfile } = await supabaseAdmin
            .from('profiles')
            .select('commission_rate')
            .eq('user_id', senderId)
            .contains('role', ['reseller'])
            .single();

          if (resellerProfile?.commission_rate !== null && resellerProfile?.commission_rate !== undefined) {
            resellerCommissionPercentage = parseFloat(resellerProfile.commission_rate);
            console.log(`✅ Using reseller's custom commission: ${resellerCommissionPercentage}%`);
          } else {
            // Get default commission from app_settings
            const { data: defaultSetting } = await supabaseAdmin
              .from('app_settings')
              .select('setting_value')
              .eq('setting_key', 'default_reseller_commission')
              .single();

            if (defaultSetting?.setting_value) {
              resellerCommissionPercentage = parseFloat(defaultSetting.setting_value);
              console.log(`✅ Using default reseller commission: ${resellerCommissionPercentage}%`);
            } else {
              // Fallback to 10.00 if no default is set
              resellerCommissionPercentage = 10.00;
              console.log(`⚠️ No default commission found, using fallback: ${resellerCommissionPercentage}%`);
            }
          }
        } else if (hasRole(senderRole, 'admin')) {
          // For admin-created invoices, get the reseller's commission (consumer's reseller)
          if (consumer.referred_by) {
            const { data: resellerProfile } = await supabaseAdmin
              .from('profiles')
              .select('commission_rate')
              .eq('user_id', consumer.referred_by)
              .contains('role', ['reseller'])
              .single();

            if (resellerProfile?.commission_rate !== null && resellerProfile?.commission_rate !== undefined) {
              resellerCommissionPercentage = parseFloat(resellerProfile.commission_rate);
              console.log(`✅ Using consumer's reseller custom commission: ${resellerCommissionPercentage}%`);
            } else {
              const { data: defaultSetting } = await supabaseAdmin
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', 'default_reseller_commission')
                .single();

              if (defaultSetting?.setting_value) {
                resellerCommissionPercentage = parseFloat(defaultSetting.setting_value);
                console.log(`✅ Using default reseller commission: ${resellerCommissionPercentage}%`);
              } else {
                // Fallback to 10.00 if no default is set
                resellerCommissionPercentage = 10.00;
                console.log(`⚠️ No default commission found, using fallback: ${resellerCommissionPercentage}%`);
              }
            }
          }
        }
      }
    } catch (offerCheckError) {
      console.error('Error checking for active offer:', offerCheckError);
      // If offer check fails, still try to get reseller's default commission
      if (senderRole === 'reseller' && resellerCommissionPercentage === null) {
        try {
          const { data: resellerProfile } = await supabaseAdmin
            .from('profiles')
            .select('commission_rate')
            .eq('user_id', senderId)
            .contains('role', ['reseller'])
            .single();

          if (resellerProfile?.commission_rate !== null && resellerProfile?.commission_rate !== undefined) {
            resellerCommissionPercentage = parseFloat(resellerProfile.commission_rate);
            console.log(`✅ Fallback: Using reseller's custom commission: ${resellerCommissionPercentage}%`);
          } else {
            const { data: defaultSetting } = await supabaseAdmin
              .from('app_settings')
              .select('setting_value')
              .eq('setting_key', 'default_reseller_commission')
              .single();

            if (defaultSetting?.setting_value) {
              resellerCommissionPercentage = parseFloat(defaultSetting.setting_value);
              console.log(`✅ Fallback: Using default reseller commission: ${resellerCommissionPercentage}%`);
            } else {
              resellerCommissionPercentage = 10.00;
              console.log(`⚠️ Fallback: No default commission found, using fallback: ${resellerCommissionPercentage}%`);
            }
          }
        } catch (fallbackError) {
          console.error('Error getting fallback commission:', fallbackError);
        }
      }
    }

    // Create invoice using transaction (Supabase doesn't support transactions directly, so we'll use a workaround)
    // First, insert the invoice
    const invoiceData = {
      sender_id: senderId,
      receiver_id: receiver_id,
      issue_date: issue_date,
      due_date: due_date,
      total_amount: finalTotalAmount,
      tax_total: taxTotal,
      status: 'unpaid',
      notes: notes || null
    };

    // Always store commission percentage and offer info if available
    // This ensures we track the commission rate used at invoice creation time
    if (resellerCommissionPercentage !== null) {
      invoiceData.reseller_commission_percentage = resellerCommissionPercentage;
      invoiceData.commission_calculated_at = new Date().toISOString();
      
      if (activeOffer) {
        invoiceData.applied_offer_id = activeOffer.id;
        console.log(`✅ Invoice will use offer commission: ${resellerCommissionPercentage}% from offer ${activeOffer.id}`);
      } else {
        console.log(`✅ Invoice will use default reseller commission: ${resellerCommissionPercentage}%`);
      }
    }

    // ========================================
    // 7. CREATE INVOICE (with timeout)
    // ========================================
    const invoicePromise = billingSupabaseAdmin
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    const { data: invoice, error: invoiceError } = await executeWithTimeout(invoicePromise);

    if (invoiceError || !invoice) {
      console.error('❌ Error creating invoice:', invoiceError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create invoice. Please try again.'
      });
    }

    // ========================================
    // 8. INSERT INVOICE ITEMS (with timeout)
    // ========================================
    const invoiceItems = validatedItems.map(item => ({
      invoice_id: invoice.id,
      package_id: item.package_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate
      // total_price is auto-calculated by the database
    }));

    const itemsPromise = billingSupabaseAdmin
      .from('invoice_items')
      .insert(invoiceItems)
      .select();

    const { data: insertedItems, error: itemsError } = await executeWithTimeout(itemsPromise);

    if (itemsError || !insertedItems) {
      console.error('❌ Error creating invoice items:', itemsError);
      // Try to delete the invoice if items insertion failed
      try {
        await executeWithTimeout(
          billingSupabaseAdmin.from('invoices').delete().eq('id', invoice.id),
          3000
        );
      } catch (deleteError) {
        console.error('Error deleting failed invoice:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create invoice items. Please try again.'
      });
    }

    // Build response with invoice data (we already have consumer data)
    const invoiceNumber = `INV-${(invoice.created_at || new Date().toISOString()).split('T')[0].replace(/-/g, '')}-${String(invoice.id).substring(0,8).toUpperCase()}`;
    
    // Build items for response using packages map
    const invoiceItemsWithPackages = insertedItems.map(item => {
      const pkg = packagesMap.get(item.package_id);
      return {
        ...item,
        packages: pkg ? { id: pkg.id, name: pkg.name, price: pkg.price } : null
      };
    });

    const completeInvoice = {
      ...invoice,
      invoice_items: invoiceItemsWithPackages
    };

    // Send invoice created email in background (non-blocking)
    // Use consumer data we already have instead of fetching again
    const emailItems = validatedItems.map((item, idx) => {
      const pkg = packagesMap.get(item.package_id);
      const packageName = pkg?.name || 'Package';
      const productName = pkg?.products?.name || null;
      const displayName = productName ? `${productName} - ${packageName}` : packageName;
      return {
        name: displayName,
        quantity: item.quantity,
        price: item.unit_price,
        total: item.total_price
      };
    });

    // Send email asynchronously in background (don't wait for it)
    if (consumer.email) {
      const senderProfile = req.userProfile || { full_name: 'Admin', role: senderRole || 'admin' };
      // Don't await - let it run in background
      sendInvoiceCreatedEmail({
        email: consumer.email,
        full_name: consumer.full_name || 'Customer',
        invoice_number: invoiceNumber,
        invoice_id: invoice.id,
        user_id: receiver_id,
        issue_date: issue_date || invoice.issue_date,
        due_date: due_date || invoice.due_date || '',
        subtotal: totalAmount,
        tax_total: taxTotal,
        total: finalTotalAmount,
        items: emailItems,
        created_by_name: senderProfile.full_name || 'Admin',
        created_by_role: senderProfile.role || 'admin'
      }).catch(e => {
        console.warn('⚠️ Failed to send invoice created email:', e?.message);
      });
    }

    // ========================================
    // 9. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('invoices:*');
    await cacheService.del(CACHE_KEYS.CONSUMER_INVOICES(receiver_id, 1, 10));
    await cacheService.del(CACHE_KEYS.MY_INVOICES(senderId, 1, 50));
    console.log('✅ Cache invalidated for invoice creation');

    // ========================================
    // 10. DATA SANITIZATION
    // ========================================
    const sanitizedInvoice = sanitizeObject(completeInvoice);

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: sanitizedInvoice
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the invoice.');
  }
};

/**
 * Resend invoice email
 * @route   POST /api/invoices/:id/resend
 * @access  Private (Admin or Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const resendInvoice = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const senderId = req.user.id;
    const senderRole = req.userProfile?.role;
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid invoice ID format'
      });
    }

    // Admin and reseller can resend invoices
    // Resellers can only resend invoices they created
    if (!hasAnyRole(senderRole, ['admin', 'reseller'])) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin or Reseller access required'
      });
    }

    // ========================================
    // 2. FETCH INVOICE (with timeout)
    // ========================================
    const invoicePromise = billingSupabaseAdmin
      .from('invoices')
      .select(`
        id,
        sender_id,
        receiver_id,
        issue_date,
        due_date,
        total_amount,
        tax_total,
        status,
        notes,
        created_at
      `)
      .eq('id', id)
      .single();

    const { data: rawInvoice, error: invoiceError } = await executeWithTimeout(invoicePromise);

    if (invoiceError) {
      console.error('❌ Error fetching invoice:', invoiceError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    if (!rawInvoice) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    const [invoice] = await attachInvoiceItems([rawInvoice]);

    // If reseller, check that they created this invoice
    if (senderRole === 'reseller' && invoice.sender_id !== senderId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only resend invoices you created'
      });
    }

    // ========================================
    // 3. VALIDATE RECEIVER DATA
    // ========================================
    const receiverPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role')
      .eq('user_id', invoice.receiver_id)
      .maybeSingle();

    const { data: receiver } = await executeWithTimeout(receiverPromise, 3000);

    if (!receiver || !receiver.email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Receiver email not found'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${(invoice.created_at || new Date().toISOString()).split('T')[0].replace(/-/g, '')}-${String(invoice.id).substring(0,8).toUpperCase()}`;

    const { packageMap, priceMap, productMap } = await fetchBillingPackageMaps([invoice]);

    // Build items for email
    const emailItems = (invoice.invoice_items || []).map((it) => {
      const priceKey = parseFloat(it.unit_price || 0).toFixed(2);
      const billingPackage = (it.package_id ? packageMap.get(it.package_id) : null) || priceMap.get(priceKey) || null;
      const packageName = billingPackage?.name || it.packages?.name || it.products?.name || 'Package';
      const productId = billingPackage?.product_id || it.product_id || it.packages?.product_id || it.products?.id || null;
      const productName = productMap.get(productId)?.name || it.packages?.products?.name || getProductTypeLabel(billingPackage?.product_type);
      const displayName = productName ? `${productName} - ${packageName}` : packageName;
      return {
        name: displayName,
      quantity: it.quantity,
      price: it.unit_price,
      total: it.total_price || (Number(it.unit_price) * Number(it.quantity))
      };
    });

    // Use sender profile from req.userProfile (already available from middleware)
    const senderProfile = req.userProfile || { full_name: 'Admin', role: ['admin'] }; // Array for TEXT[]

    // Send invoice email in background (non-blocking)
    sendInvoiceCreatedEmail({
      email: receiver.email,
      full_name: receiver.full_name || 'Customer',
      invoice_number: invoiceNumber,
      invoice_id: invoice.id,
      user_id: invoice.receiver_id,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date || '',
      subtotal: invoice.total_amount - (invoice.tax_total || 0),
      tax_total: invoice.tax_total || 0,
      total: invoice.total_amount,
      items: emailItems,
      created_by_name: senderProfile.full_name || 'Admin',
      created_by_role: senderProfile.role || 'admin'
    }).catch(emailError => {
      console.warn('⚠️ Failed to resend invoice email:', emailError?.message);
    });

    return res.json({
      success: true,
      message: 'Invoice email resent successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while resending the invoice email.');
  }
};

/**
 * Download invoice as PDF
 * @route   GET /api/invoices/:id/download-pdf
 * @access  Private (Admin, Reseller, Consumer)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const downloadInvoicePDF = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // Note: Permission checks are handled by checkInvoiceAccess middleware in routes
    // ========================================
    const { id: invoiceId } = req.params;

    if (!invoiceId || !isValidUUID(invoiceId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid invoice ID format'
      });
    }

    // ========================================
    // 2. FETCH INVOICE (with timeout)
    // ========================================
    const invoicePromise = billingSupabaseAdmin
      .from('invoices')
      .select(`
        id,
        sender_id,
        receiver_id,
        issue_date,
        due_date,
        total_amount,
        tax_total,
        status,
        notes,
        created_at
      `)
      .eq('id', invoiceId)
      .single();

    const { data: rawInvoice, error: invoiceError } = await executeWithTimeout(invoicePromise);

    // ========================================
    // 3. ERROR HANDLING (Security)
    // ========================================
    if (invoiceError || !rawInvoice) {
      console.error('❌ Error fetching invoice:', invoiceError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    const [invoiceWithItems] = await attachInvoiceItems([rawInvoice]);
    const profileIds = [invoiceWithItems.sender_id, invoiceWithItems.receiver_id].filter(Boolean);
    let profileMap = new Map();

    if (profileIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, full_name, email, role')
        .in('user_id', profileIds);

      const { data: profiles } = await executeWithTimeout(profilesPromise, 3000);
      profileMap = new Map((profiles || []).map(profile => [profile.user_id, profile]));
    }

    const invoice = {
      ...invoiceWithItems,
      sender: profileMap.get(invoiceWithItems.sender_id) || null,
      receiver: profileMap.get(invoiceWithItems.receiver_id) || null
    };

    const { packageMap, priceMap, productMap } = await fetchBillingPackageMaps([invoice]);

    // ========================================
    // 4. GENERATE PDF
    // Note: Permission checks are handled by middleware in routes
    // ========================================
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    
    // Set response headers
    const invoiceNumber = `INV-${invoice.created_at?.split('T')[0]?.replace(/-/g, '')}-${invoice.id.substring(0, 8).toUpperCase()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceNumber}.pdf`);
    res.setHeader('Cache-Control', 'no-cache');

    // Pipe PDF to response
    doc.pipe(res);

    // Invoice Header
    doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, 50);
    
    // Invoice Number and Date
    const invoiceDate = invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    
    doc.fontSize(10).font('Helvetica').text(`Invoice #: ${invoiceNumber}`, 400, 50, { align: 'right' });
    doc.text(`Date: ${invoiceDate}`, 400, 70, { align: 'right' });
    doc.text(`Due Date: ${dueDate}`, 400, 85, { align: 'right' });
    
    // Bill From (Sender)
    let yPos = 130;
    doc.fontSize(12).font('Helvetica-Bold').text('Bill From:', 50, yPos);
    doc.fontSize(10).font('Helvetica');
    doc.text(invoice.sender?.full_name || 'N/A', 50, yPos + 20);
    if (invoice.sender?.email) {
      doc.text(invoice.sender.email, 50, yPos + 35);
    }
    
    // Bill To (Receiver)
    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 300, yPos);
    doc.fontSize(10).font('Helvetica');
    doc.text(invoice.receiver?.full_name || 'N/A', 300, yPos + 20);
    if (invoice.receiver?.email) {
      doc.text(invoice.receiver.email, 300, yPos + 35);
    }
    
    // Items Table Header
    yPos = 220;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, yPos, { width: 250 });
    doc.text('Quantity', 310, yPos);
    doc.text('Unit Price', 370, yPos, { align: 'right', width: 70 });
    doc.text('Tax Rate', 450, yPos, { align: 'right', width: 50 });
    doc.text('Total', 510, yPos, { align: 'right', width: 90 });
    
    // Draw line
    doc.moveTo(50, yPos + 15).lineTo(600, yPos + 15).stroke();
    
    // Invoice Items
    yPos += 30;
    doc.fontSize(10).font('Helvetica');
    const invoiceItems = invoice.invoice_items || [];
    invoiceItems.forEach((item) => {
      const priceKey = parseFloat(item.unit_price || 0).toFixed(2);
      const billingPackage = (item.package_id ? packageMap.get(item.package_id) : null) || priceMap.get(priceKey) || null;
      const packageName = billingPackage?.name || item.packages?.name || item.products?.name || 'Unknown Package';
      const productId = billingPackage?.product_id || item.product_id || item.packages?.product_id || item.products?.id || null;
      const productName = productMap.get(productId)?.name || item.packages?.products?.name || getProductTypeLabel(billingPackage?.product_type);
      const itemName = productName ? `${productName} - ${packageName}` : packageName;
      const quantity = item.quantity || 0;
      const unitPrice = parseFloat(item.unit_price || 0).toFixed(2);
      const taxRate = parseFloat(item.tax_rate || 0).toFixed(2);
      const total = parseFloat(item.total_price || 0).toFixed(2);
      
      doc.text(itemName, 50, yPos, { width: 250 });
      doc.text(quantity.toString(), 310, yPos);
      doc.text(`$${unitPrice}`, 370, yPos, { align: 'right', width: 70 });
      doc.text(`${taxRate}%`, 450, yPos, { align: 'right', width: 50 });
      doc.text(`$${total}`, 510, yPos, { align: 'right', width: 90 });
      
      yPos += 20;
      
      // Check if we need a new page
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
    });
    
    // Totals
    yPos += 20;
    const subtotal = parseFloat((invoice.total_amount || 0) - (invoice.tax_total || 0)).toFixed(2);
    const taxTotal = parseFloat(invoice.tax_total || 0).toFixed(2);
    const grandTotal = parseFloat(invoice.total_amount || 0).toFixed(2);
    
    doc.fontSize(10).font('Helvetica');
    doc.text('Subtotal:', 450, yPos, { align: 'right', width: 80 });
    doc.text(`$${subtotal}`, 540, yPos, { align: 'right', width: 60 });
    
    yPos += 20;
    doc.text('Tax:', 450, yPos, { align: 'right', width: 80 });
    doc.text(`$${taxTotal}`, 540, yPos, { align: 'right', width: 60 });
    
    yPos += 25;
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Total:', 450, yPos, { align: 'right', width: 80 });
    doc.text(`$${grandTotal}`, 540, yPos, { align: 'right', width: 60 });
    
    // Status
    yPos += 40;
    doc.fontSize(10).font('Helvetica');
    const status = invoice.status || 'unpaid';
    doc.text(`Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`, 50, yPos);
    
    // Notes
    if (invoice.notes) {
      yPos += 30;
      doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50, yPos);
      doc.fontSize(10).font('Helvetica').text(invoice.notes, 50, yPos + 15, { width: 500 });
    }
    
    // Footer
    doc.fontSize(8).font('Helvetica').text(
      'Thank you for your business!',
      50,
      doc.page.height - 50,
      { align: 'center', width: doc.page.width - 100 }
    );
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('❌ Error generating invoice PDF:', error);
    return handleApiError(error, res, 'An error occurred while generating the invoice PDF.');
  }
};

