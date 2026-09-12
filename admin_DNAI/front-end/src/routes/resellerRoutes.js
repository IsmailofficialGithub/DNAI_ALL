import ResellerDashboard from "views/ResellerDashboard.js";
import Account from "views/Account.js";
import Invoices from "views/Invoices.js";
import ResellerConsumers from "views/ResellerConsumers.js";
import ConsumerDetail from "views/ConsumerDetail.js";
import ActivityLogDetail from "views/ActivityLogDetail.js";
import Withdraw from "views/Withdraw.js";
import ResellerOffers from "views/ResellerOffers.js";
import EarningsBreakdown from "views/EarningsBreakdown.js";
import Resellers from "views/Resellers";
import ResellersReseller from "views/Reseller's-Reseller";
import ResellersResellerDetail from "views/Reseller'sResellerDetail.js";
// Import other reseller views here as needed

const resellerRoutes = [
  {
    path: "/account",
    component: Account,
    layout: "/reseller",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/consumers/:id",
    component: ConsumerDetail,
    layout: "/reseller",
    invisible: true // Hidden from sidebar
  },
  
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: ResellerDashboard,
    layout: "/reseller"
  },
  {
    path: "/consumers",
    name: "Consumers",
    icon: "nc-icon nc-circle-09",
    component: ResellerConsumers,
    layout: "/reseller"
  },
  {
    path: "/myreseller/:id",
    component: ResellersResellerDetail,
    layout: "/reseller",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/myreseller",
    name: "My Resellers",
    icon: "nc-icon nc-bulb-63",
    component: ResellersReseller,
    layout: "/reseller"
  },
  {
    path: "/invoices",
    name: "Invoices",
    icon: "nc-icon nc-single-copy-04",
    component: Invoices,
    layout: "/reseller"
  },
  {
    path: "/offers",
    name: "Offers",
    icon: "nc-icon nc-tag-content",
    component: ResellerOffers,
    layout: "/reseller"
  },
  {
    path: "/withdraw",
    name: "Withdraw",
    icon: "nc-icon nc-money-coins",
    component: Withdraw,
    layout: "/reseller"
  },
  {
    path: "/earnings",
    name: "Earnings Breakdown",
    icon: "nc-icon nc-money-coins",
    component: EarningsBreakdown,
    layout: "/reseller"
  },
  {
    path: "/activity-logs/:id",
    component: ActivityLogDetail,
    layout: "/reseller",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/logs/:id",
    component: ActivityLogDetail,
    layout: "/reseller",
    invisible: true // Hidden from sidebar
  }
];

export default resellerRoutes;
