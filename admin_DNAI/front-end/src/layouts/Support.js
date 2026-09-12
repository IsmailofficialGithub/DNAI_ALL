import React from "react";
import { useLocation, Route, Switch, Redirect } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { usePermissions } from "hooks/usePermissions";
import toast from "react-hot-toast";
import { hasRole } from "utils/roleUtils";

import AdminNavbar from "components/Navbars/AdminNavbar";
import Footer from "components/Footer/Footer";
import Sidebar from "components/Sidebar/Sidebar";

import supportRoutes from "routes/supportRoutes.js";

import sidebarImage from "assets/img/sidebar-3.jpg";

function Support() {
  const [image, setImage] = React.useState(sidebarImage);
  const [color, setColor] = React.useState("black");
  const [hasImage, setHasImage] = React.useState(true);
  const location = useLocation();
  const mainPanel = React.useRef(null);
  const { profile, signOut } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  // Check account status on mount and route changes
  React.useEffect(() => {
    if (profile) {
      // Check if support account is deactivated
      if (hasRole(profile.role, 'support') && profile.account_status === 'deactive') {
        toast.error('Your account has been deactivated. Please contact the administrator.');
        signOut();
      }
    }
  }, [profile, location.pathname, signOut]);
  
  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.layout === "/support") {
        return (
          <Route
            path={prop.layout + prop.path}
            render={(props) => {
              // Check if route requires permissions
              if (prop.requiredPermissions && Array.isArray(prop.requiredPermissions) && prop.requiredPermissions.length > 0) {
                // System admins have all permissions
                const isSystemAdmin = profile && profile.is_systemadmin === true;
                
                // Wait for permissions to load
                if (permissionsLoading && !isSystemAdmin) {
                  return (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '100vh',
                      fontSize: '18px'
                    }}>
                      Loading permissions...
                    </div>
                  );
                }
                
                // Check if user has any of the required permissions
                const hasRequiredPermission = isSystemAdmin || 
                  prop.requiredPermissions.some(permission => hasPermission(permission));
                
                if (!hasRequiredPermission) {
                  console.log(`❌ Support Layout: Access denied to ${prop.path}. Required permissions:`, prop.requiredPermissions);
                  toast.error('Access denied. You do not have permission to view this page.');
                  // Redirect to dashboard or first accessible route
                  return <Redirect to="/support/dashboard" />;
                }
              }
              
              // All checks passed, render component
              return <prop.component {...props} />;
            }}
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
        <Sidebar color={color} image={hasImage ? image : ""} routes={supportRoutes} />
        <div className="main-panel" ref={mainPanel}>
          <AdminNavbar />
          <div className="content">
            <Switch>
              {getRoutes(supportRoutes)}
              {/* Default redirect: /support -> /support/dashboard */}
              <Redirect exact from="/support" to="/support/dashboard" />
            </Switch>
          </div>
          <Footer />
        </div>
      </div>
    </>
  );
}

export default Support;

