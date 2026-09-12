import React from "react";
import { useLocation, Route, Switch, Redirect } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import toast from "react-hot-toast";
import { hasRole } from "utils/roleUtils";

import AdminNavbar from "components/Navbars/AdminNavbar";
import Footer from "components/Footer/Footer";
import Sidebar from "components/Sidebar/Sidebar";

import resellerRoutes from "routes/resellerRoutes.js";

import sidebarImage from "assets/img/sidebar-3.jpg";

function Reseller() {
  const [image, setImage] = React.useState(sidebarImage);
  const [color, setColor] = React.useState("black");
  const [hasImage, setHasImage] = React.useState(true);
  const location = useLocation();
  const mainPanel = React.useRef(null);
  const { profile, signOut } = useAuth();

  // Check account status on mount and route changes
  React.useEffect(() => {
    if (profile) {
      // Check if reseller account is deactivated
      if (hasRole(profile.role, 'reseller') && profile.account_status === 'deactive') {
        toast.error('Your account has been deactivated. Please contact the administrator.');
        signOut();
      }
    }
  }, [profile, location.pathname, signOut]);
  
  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.layout === "/reseller") {
        return (
          <Route
            path={prop.layout + prop.path}
            render={(props) => <prop.component {...props} />}
            key={key}
          />
        );
      } else {
        return null;
      }
    });
  };
  
  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    mainPanel.current.scrollTop = 0;
    if (
      window.innerWidth < 993 &&
      document.documentElement.className.indexOf("nav-open") !== -1
    ) {
      document.documentElement.classList.toggle("nav-open");
      var element = document.getElementById("bodyClick");
      element.parentNode.removeChild(element);
    }
  }, [location]);
  
  return (
    <>
      <div className="wrapper">
        <Sidebar color={color} image={hasImage ? image : ""} routes={resellerRoutes} />
        <div className="main-panel" ref={mainPanel}>
          <AdminNavbar />
          <div className="content">
            <Switch>
              {getRoutes(resellerRoutes)}
              {/* Default redirect: /reseller -> /reseller/dashboard */}
              <Redirect exact from="/reseller" to="/reseller/dashboard" />
            </Switch>
          </div>
          <Footer />
        </div>
      </div>
    </>
  );
}

export default Reseller;

