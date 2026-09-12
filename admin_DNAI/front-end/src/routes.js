
import Dashboard from "views/Dashboard.js";
import Users from "views/Users.js";
import Consumers from "views/Consumers.js";
import Resellers from "views/Resellers.js";
import ResellerDetail from "views/ResellerDetail.js";
import ResellerEarningsBreakdown from "views/ResellerEarningsBreakdown.js";
import UserDetail from "views/UserDetail.js";
import ConsumerDetail from "views/ConsumerDetail.js";
import Account from "views/Account.js";
import Products from "views/Products.js";
import Packages from "views/Packages.js";
import Invoices from "views/Invoices.js";
import InvoicePaymentDetail from "views/InvoicePaymentDetail.js";
import ActivityLogs from "views/ActivityLogs.js";
import ActivityLogDetail from "views/ActivityLogDetail.js";
import ApiLogs from "views/ApiLogs.js";
import ErrorLogs from "views/ErrorLogs.js";
import N8nErrors from "views/N8nErrors.js";
import ResellerStatistics from "views/ResellerStatistics.js";
import AdminSettings from "views/AdminSettings.js";
import Offers from "views/Offers.js";
import ProductDetail from "views/ProductDetail.js";
import Customers from "views/Customers.js";
import Permissions from "views/Permissions.js";
import Genie from "views/Genie.js";
import CallDetail from "views/CallDetail.js";
import LeadDetail from "views/LeadDetail.js";
import ApiKeys from "views/ApiKeys.js";
import InboundGenie from "views/InboundGenie.js";


const dashboardRoutes = [
  // Hidden routes (not shown in sidebar)
  // More specific routes must come first to prevent route conflicts
  {
    path: "/reseller/:id/earnings",
    component: ResellerEarningsBreakdown,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/reseller/:id",
    component: ResellerDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/users/:id",
    component: UserDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/consumers/:id",
    component: ConsumerDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/account",
    component: Account,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/activity-logs/:id",
    component: ActivityLogDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/product/:id",
    component: ProductDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/logs/:id",
    component: ActivityLogDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/invoices/:invoiceId/payments",
    component: InvoicePaymentDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/genie/calls/:id",
    component: CallDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/genie/leads/:id",
    component: LeadDetail,
    layout: "/admin",
    invisible: true // This prevents it from showing in sidebar
  },
  {
    path: "/reseller-statistics",
    component: ResellerStatistics,
    layout: "/admin",
    invisible: true // Hidden from sidebar - accessed from dashboard
  },
  // Sidebar routes
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: Dashboard,
    layout: "/admin"
  },
  {
    path: "/users",
    name: "Users",
    icon: "nc-icon nc-badge",
    component: Users,
    layout: "/admin"
  },
  {
    path: "/consumers",
    name: "Consumers",
    icon: "nc-icon nc-circle-09",
    component: Consumers,
    layout: "/admin",
    submenus: [
      {
        path: "/consumers?status=active",
        name: "Active",
        component: Consumers,
        layout: "/admin"
      },
      {
        path: "/consumers?status=deactive",
        name: "Deactive",
        component: Consumers,
        layout: "/admin"
      },
      {
        path: "/consumers?status=expired_subscription",
        name: "Expired Subscription",
        component: Consumers,
        layout: "/admin"
      }
    ]
  },
  {
    path: "/resellers",
    name: "Resellers",
    icon: "nc-icon nc-bulb-63",
    component: Resellers,
    layout: "/admin"
  },
  {
    path: "/products",
    name: "Products",
    icon: "nc-icon nc-notes",
    component: Products,
    layout: "/admin"
  },
  {
    path: "/packages",
    name: "Packages",
    icon: "nc-icon nc-chart-bar-32",
    component: Packages,
    layout: "/admin"
  },
  {
    path: "/invoices",
    name: "Invoices",
    icon: "nc-icon nc-single-copy-04",
    component: Invoices,
    layout: "/admin"
  },
  {
    path: "/offers",
    name: "Offers",
    icon: "nc-icon nc-tag-content",
    component: Offers,
    layout: "/admin"
  },
  
  {
    path: "/customers",
    name: "Customer Support",
    icon: "nc-icon nc-support-17",
    component: Customers,
    layout: "/admin"
  },
  {
    path: "/genie",
    name: "Genie",
    icon: "nc-icon nc-headphones-2",
    component: Genie,
    layout: "/admin",
    permission: "genie.view",
    submenus: [
      {
        path: "/genie",
        layout: "/admin",
        name: "Outbound Genie"
      },
      {
        path: "/inbound",
        layout: "/admin",
        name: "Inbound Genie"
      }
    ]
  },
  {
    path: "/inbound",
    name: "Genie Inbound",
    icon: "nc-icon nc-mobile",
    component: InboundGenie,
    layout: "/admin",
    invisible: true // Hide from main sidebar list since it's a submenu
  },


  {
    path: "/activity-logs",
    name: "Activity Logs",
    icon: "nc-icon nc-chart-bar-32",
    component: ActivityLogs,
    layout: "/admin"
  },
  {
    path: "/api-logs",
    name: "API Logs",
    icon: "nc-icon nc-chart-bar-32",
    component: ApiLogs,
    layout: "/admin",
    systemAdminOnly: true // Only show for systemadmin
  },
  {
    path: "/error-logs",
    name: "Error Logs",
    icon: "nc-icon nc-notification-70",
    component: ErrorLogs,
    layout: "/admin",
    systemAdminOnly: true // Only show for systemadmin
  },
  {
    path: "/n8n-errors",
    name: "N8N Errors",
    icon: "nc-icon nc-settings-tool-66",
    component: N8nErrors,
    layout: "/admin",
    requiredPermissions: ['n8n_errors.view'] // Permission-based access
  },
  {
    path: "/settings",
    name: "Settings",
    icon: "nc-icon nc-settings-gear-64",
    component: AdminSettings,
    layout: "/admin"
  },
  {
    path: "/permissions",
    name: "Permissions",
    icon: "nc-icon nc-settings-90",
    component: Permissions,
    layout: "/admin",
    systemAdminOnly: true // Only show for systemadmin
  },
  {
    path: "/api-keys",
    name: "API Keys",
    icon: "nc-icon nc-key-25",
    component: ApiKeys,
    layout: "/admin",
    systemAdminOnly: true // Only show for systemadmin
  },
];

export default dashboardRoutes;
