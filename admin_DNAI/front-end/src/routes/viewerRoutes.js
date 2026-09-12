import Dashboard from "views/Dashboard.js";
import TableList from "views/TableList.js";
import Notifications from "views/Notifications.js";

const viewerRoutes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: Dashboard,
    layout: "/viewer"
  },
  {
    path: "/reports",
    name: "Reports",
    icon: "nc-icon nc-notes",
    component: TableList,
    layout: "/viewer"
  },
  {
    path: "/notifications",
    name: "Notifications",
    icon: "nc-icon nc-bell-55",
    component: Notifications,
    layout: "/viewer"
  }
];

export default viewerRoutes;

