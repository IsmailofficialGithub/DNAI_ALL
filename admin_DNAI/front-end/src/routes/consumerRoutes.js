import Dashboard from "views/Dashboard.js";
import UserProfile from "views/UserProfile.js";
import Invoices from "views/Invoices.js";
import Payment from "views/Payment.js";
import Account from "views/Account.js";
import ActivityLogDetail from "views/ActivityLogDetail.js";

const consumerRoutes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: Dashboard,
    layout: "/consumer"
  },
  {
    path: "/invoices",
    name: "Invoices",
    icon: "nc-icon nc-single-copy-04",
    component: Invoices,
    layout: "/consumer"
  },
  {
    path: "/profile",
    name: "My Profile",
    icon: "nc-icon nc-circle-09",
    component: UserProfile,
    layout: "/consumer"
  },
  {
    path: "/payment",
    name: "Payment",
    component: Payment,
    layout: "/consumer",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/account",
    component: Account,
    layout: "/consumer",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/activity-logs/:id",
    component: ActivityLogDetail,
    layout: "/consumer",
    invisible: true // Hidden from sidebar
  },
  {
    path: "/logs/:id",
    component: ActivityLogDetail,
    layout: "/consumer",
    invisible: true // Hidden from sidebar
  }
];

export default consumerRoutes;

