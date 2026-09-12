import SupportDashboard from "views/SupportDashboard.js";
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
import ResellerStatistics from "views/ResellerStatistics.js";
import AdminSettings from "views/AdminSettings.js";
import Offers from "views/Offers.js";
import ProductDetail from "views/ProductDetail.js";
import Customers from "views/Customers.js";
import Permissions from "views/Permissions.js";
import Genie from "views/Genie.js";
import CallDetail from "views/CallDetail.js";
import LeadDetail from "views/LeadDetail.js";

const supportRoutes = [
  // Hidden routes (not shown in sidebar)
  // More specific routes must come first to prevent route conflicts
  {
    path: "/reseller/:id/earnings",
    component: ResellerEarningsBreakdown,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/reseller/:id",
    component: ResellerDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/users/:id",
    component: UserDetail,
    layout: "/support",
    invisible: true, // Hidden from sidebar
    requiredPermissions: ["users.view", "users.read"] // Required permission to access user details
  },
  {
    path: "/consumers/:id",
    component: ConsumerDetail,
    layout: "/support",
    invisible: true, // Hidden from sidebar
    requiredPermissions: ["consumers.view"] // Required permission to access consumer details
  },
  {
    path: "/account",
    component: Account,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/activity-logs/:id",
    component: ActivityLogDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/product/:id",
    component: ProductDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/logs/:id",
    component: ActivityLogDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/invoices/:invoiceId/payments",
    component: InvoicePaymentDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/invoices/:id",
    component: InvoicePaymentDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/genie/calls/:id",
    component: CallDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/genie/leads/:id",
    component: LeadDetail,
    layout: "/support",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/reseller-statistics",
    component: ResellerStatistics,
    layout: "/support",
    invisible: true // Hidden from sidebar - accessed from dashboard
  },
  // Sidebar routes with permission-based visibility
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: SupportDashboard,
    layout: "/support",
    requiredPermissions: ["dashboard.view"] // Required permission to show this route
  },
  {
    path: "/users",
    name: "Users",
    icon: "nc-icon nc-badge",
    component: Users,
    layout: "/support",
    requiredPermissions: ["users.view", "users.read"] // Show if user has users.view OR users.read
  },
  {
    path: "/consumers",
    name: "Consumers",
    icon: "nc-icon nc-circle-09",
    component: Consumers,
    layout: "/support",
    requiredPermissions: ["consumers.view"], // Show if user has consumers.view
    submenus: [
      {
        path: "/consumers?status=active",
        name: "Active",
        component: Consumers,
        layout: "/support"
      },
      {
        path: "/consumers?status=deactive",
        name: "Deactive",
        component: Consumers,
        layout: "/support"
      },
      {
        path: "/consumers?status=expired_subscription",
        name: "Expired Subscription",
        component: Consumers,
        layout: "/support"
      }
    ]
  },
  {
    path: "/resellers",
    name: "Resellers",
    icon: "nc-icon nc-bulb-63",
    component: Resellers,
    layout: "/support",
    requiredPermissions: ["resellers.view"] // Show if user has resellers.view
  },
  {
    path: "/products",
    name: "Products",
    icon: "nc-icon nc-notes",
    component: Products,
    layout: "/support",
    requiredPermissions: ["products.view"] // Show if user has products.view
  },
  {
    path: "/packages",
    name: "Packages",
    icon: "nc-icon nc-chart-bar-32",
    component: Packages,
    layout: "/support",
    requiredPermissions: ["packages.view"] // Show if user has packages.view
  },
  // {
  //   path: "/invoices",
  //   name: "Invoices",
  //   icon: "nc-icon nc-single-copy-04",
  //   component: Invoices,
  //   layout: "/support",
  //   requiredPermissions: ["invoices.view", "invoices.read"] // Show if user has invoices.view OR invoices.read
  // },
  {
    path: "/activity-logs",
    name: "Activity Logs",
    icon: "nc-icon nc-chart-bar-32",
    component: ActivityLogs,
    layout: "/support",
    requiredPermissions: ["activity_logs.view", "activity_logs.read"] // Show if user has activity_logs.view OR activity_logs.read
  },
  {
    path: "/customers",
    name: "Customer Support",
    icon: "nc-icon nc-support-17",
    component: Customers,
    layout: "/support",
    requiredPermissions: ["customer_support.view"] // Show if user has customer_support.view
  },
  {
    path: "/genie",
    name: "Genie",
    icon: "nc-icon nc-headphones-2",
    component: Genie,
    layout: "/support",
    requiredPermissions: ["genie.view"] // Show if user has genie.view
  }
];

export default supportRoutes;

