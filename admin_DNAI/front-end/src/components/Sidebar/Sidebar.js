
import React, { useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { usePermissions } from "hooks/usePermissions";
import toast from "react-hot-toast";
import { hasRole } from "utils/roleUtils";

import { Nav } from "react-bootstrap";

function Sidebar({ color, image, routes }) {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);
  const { user, profile, signOut } = useAuth();
  
  // Use the cached permissions hook instead of direct API calls
  const { hasPermission, isLoading: permissionsLoading, isSystemAdmin } = usePermissions();

  // Handle navigation click - check account status
  const handleNavClick = (e) => {
    if (profile) {
      // Check if reseller account is deactivated
      if (hasRole(profile.role, 'reseller') && profile.account_status === 'deactive') {
        e.preventDefault();
        e.stopPropagation();
        toast.error('Your account has been deactivated. Please contact the administrator.');
        signOut();
        return false;
      }
      // Check if consumer account is deactivated
      if (hasRole(profile.role, 'consumer') && profile.account_status === 'deactive') {
        e.preventDefault();
        e.stopPropagation();
        toast.error('Your account has been deactivated. Please contact the administrator.');
        signOut();
        return false;
      }
    }
    return true;
  };

  const activeRoute = (routeName) => {
    return location.pathname.indexOf(routeName) > -1 ? "active" : "";
  };

  const isSubmenuActive = (submenuPath) => {
    // Extract status parameter from submenu path
    const pathParts = submenuPath.split('?');
    const submenuBasePath = pathParts[0];
    const submenuParams = new URLSearchParams(pathParts[1] || '');
    const submenuStatus = submenuParams.get('status');
    
    // Extract status parameter from current location
    const currentParams = new URLSearchParams(location.search);
    const currentStatus = currentParams.get('status');
    
    // Check if paths match
    const pathMatch = location.pathname === submenuBasePath || location.pathname.includes(submenuBasePath);
    
    // Check if status matches (both must have a status and they must be equal)
    const statusMatch = submenuStatus && currentStatus && submenuStatus === currentStatus;
    
    return pathMatch && statusMatch;
  };

  const toggleSubmenu = (key) => {
    setExpandedMenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  /**
   * Check if user has permission for a specific route
   * Uses the cached permissions from usePermissions hook
   * System admins always have access
   * Checks route.requiredPermissions if available, otherwise falls back to path-based mapping
   */
  const hasRoutePermission = (routePath, route) => {
    // System admins have all permissions
    if (isSystemAdmin || (profile && profile.is_systemadmin === true)) {
      return true;
    }

    // While loading, hide routes (safer)
    if (permissionsLoading) {
      return false;
    }

    // First, check if route has requiredPermissions defined (preferred method)
    if (route && route.requiredPermissions && Array.isArray(route.requiredPermissions)) {
      // Check if user has any of the required permissions
      return route.requiredPermissions.some(permission => hasPermission(permission));
    }

    // Fallback to path-based mapping for backward compatibility
    const routePermissions = {
      '/dashboard': ['dashboard.view'],
      '/users': ['users.view', 'users.read'], // Allow users.read as alternative
      '/consumers': ['consumers.view'],
      '/resellers': ['resellers.view'],
      '/products': ['products.view'],
      '/packages': ['packages.view'],
      '/activity-logs': ['activity_logs.view', 'activity_logs.read'], // Allow activity_logs.read as alternative
      '/offers': ['offers.view'],
      '/settings': ['settings.view'],
      '/customers': ['customer_support.view'],
      '/invoices': ['invoices.view', 'invoices.read'], // Allow invoices.read as alternative
      '/genie': ['genie.view'],
      '/n8n-errors': ['n8n_errors.view'],
    };

    const requiredPermissions = routePermissions[routePath];
    if (!requiredPermissions) {
      // If no permission mapping, allow access (for routes without permission requirements)
      return true;
    }

    // Check if user has any of the required permissions (primary or fallback)
    return requiredPermissions.some(permission => hasPermission(permission));
  };

  // Auto-expand menu if a submenu is active, close if no status
  React.useEffect(() => {
    const currentParams = new URLSearchParams(location.search);
    const currentStatus = currentParams.get('status');
    
    if (currentStatus) {
      // If there's a status, expand the menu with active submenu
      routes.forEach((route, key) => {
        if (route.submenus && route.submenus.length > 0) {
          const hasActiveSubmenu = route.submenus.some(submenu => isSubmenuActive(submenu.path));
          if (hasActiveSubmenu) {
            setExpandedMenus(prev => ({
              ...prev,
              [key]: true
            }));
          }
        }
      });
    } else {
      // If no status parameter, close all submenus
      setExpandedMenus({});
    }
  }, [location.search]);

  return (
    <div className="sidebar" data-image={image} data-color={color}>
      <div
        className="sidebar-background"
        style={{
          backgroundImage: "url(" + image + ")"
        }}
      />
      <div className="sidebar-wrapper" style={{ position: 'relative', paddingBottom: '80px' }}>
        <div className="logo d-flex align-items-center justify-content-start">
          {/* <a
            href="#"
            className="simple-text logo-mini mx-1"
          >
            <div className="logo-img">
            DuhaNashrah
            </div>
          </a> */}
          <a className="simple-text" href="#">
              <img src={require("assets/img/image.png")} alt="..." style={{ width: '100%', height: '100%' }}/>
          </a>
        </div>
        <Nav>
          {routes.map((prop, key) => {
            // Filter out systemAdminOnly routes if user is not systemadmin
            if (prop.systemAdminOnly && (!profile || profile.is_systemadmin !== true)) {
              return null;
            }
            
            // Check route permissions using cached permissions
            // Pass the route object to allow checking route.requiredPermissions
            if (!hasRoutePermission(prop.path, prop)) {
              return null;
            }
            
            if (!prop.redirect && prop.name && !prop.upgrade && !prop.invisible) {
              const hasSubmenus = prop.submenus && prop.submenus.length > 0;
              const isExpanded = expandedMenus[key];

              return (
                <React.Fragment key={key}>
                  <li
                    className={activeRoute(prop.layout + prop.path)}
                    style={{ position: 'relative' }}
                  >
                    {hasSubmenus ? (
                      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <NavLink
                          to={prop.layout + prop.path}
                          className="nav-link"
                          activeClassName="active"
                          style={{ flex: 1, paddingRight: '35px', position: 'relative', zIndex: 1 }}
                          onClick={(e) => {
                            // Check account status before navigation
                            if (!handleNavClick(e)) {
                              return;
                            }
                            // Close submenu if it's open
                            if (isExpanded) {
                              setExpandedMenus(prev => ({
                                ...prev,
                                [key]: false
                              }));
                            }
                          }}
                        >
                          <i className={prop.icon} />
                          <p>{prop.name}</p>
                        </NavLink>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSubmenu(key);
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                          }}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            cursor: 'pointer',
                            padding: '6px',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            pointerEvents: 'auto'
                          }}
                        >
                          <span
                            style={{ 
                              fontSize: '20px',
                              transition: 'all 0.3s ease',
                              color: '#FFD700',
                              fontWeight: 'bold',
                              lineHeight: '1',
                              textShadow: '0 0 2px rgba(0,0,0,0.5)',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              display: 'inline-block'
                            }}
                          >
                            ▼
                          </span>
                        </div>
                      </div>
                    ) : (
                      <NavLink
                        to={prop.layout + prop.path}
                        className="nav-link"
                        activeClassName="active"
                        onClick={handleNavClick}
                      >
                        <i className={prop.icon} />
                        <p>{prop.name}</p>
                      </NavLink>
                    )}
                  </li>
                  
                  {/* Render submenus */}
                  {hasSubmenus && isExpanded && (
                    <ul style={{ 
                      listStyle: 'none', 
                      paddingLeft: '15px',
                      paddingRight: '10px',
                      marginTop: '0',
                      marginBottom: '5px',
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      borderRadius: '4px',
                      paddingTop: '5px',
                      paddingBottom: '5px'
                    }}>
                      {prop.submenus.map((submenu, subKey) => {
                        // Build full path with layout prefix for comparison
                        const fullSubmenuPath = submenu.layout + submenu.path;
                        const isActive = isSubmenuActive(fullSubmenuPath);
                        const submenuId = `${key}-${subKey}`;
                        const isHovered = hoveredSubmenu === submenuId;
                        
                        return (
                          <li key={subKey}>
                            <NavLink
                              to={fullSubmenuPath}
                              className="nav-link"
                              onMouseEnter={() => setHoveredSubmenu(submenuId)}
                              onMouseLeave={() => setHoveredSubmenu(null)}
                              onClick={handleNavClick}
                              style={{
                                padding: '10px 12px 10px 35px',
                                fontSize: '13px',
                                minHeight: 'auto',
                                lineHeight: '1.4',
                                backgroundColor: isActive 
                                  ? 'rgba(255,215,0,0.2)' 
                                  : isHovered 
                                    ? 'rgba(255,255,255,0.08)' 
                                    : 'transparent',
                                borderLeft: isActive ? '4px solid #FFD700' : '4px solid transparent',
                                fontWeight: isActive ? '600' : 'normal',
                                color: isActive ? '#FFD700' : 'inherit',
                                transition: 'all 0.2s ease',
                                transform: isHovered && !isActive ? 'translateX(3px)' : 'translateX(0)',
                                borderRadius: '6px',
                                marginBottom: '2px'
                              }}
                            >
                              <p style={{ 
                                margin: 0, 
                                display: 'inline',
                                color: isActive ? '#FFD700' : 'inherit',
                                transition: 'color 0.2s ease'
                              }}>
                                {submenu.name}
                              </p>
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </React.Fragment>
              );
            }
            return null;
          })}
        </Nav>
        
        {/* Upgrade to PRO button at the bottom */}
        {routes.map((prop, key) => {
          if (prop.upgrade && prop.name) {
            return (
              <div 
                key={key}
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '0',
                  right: '0',
                  padding: '0 15px'
                }}
              >
                <NavLink
                  to={prop.layout + prop.path}
                  className="nav-link active-pro"
                  onClick={handleNavClick}
                  style={{
                    textAlign: 'center',
                    backgroundColor: '#51cbce',
                    borderRadius: '8px',
                    padding: '12px 10px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(81, 203, 206, 0.4)',
                    transition: 'all 0.3s ease',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#40b5b8';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(81, 203, 206, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#51cbce';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(81, 203, 206, 0.4)';
                  }}
                >
                  <i className={prop.icon} style={{ color: '#ffffff' }} />
                  <p style={{ margin: 0, display: 'inline', marginLeft: '8px', color: '#ffffff' }}>{prop.name}</p>
                </NavLink>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default Sidebar;
