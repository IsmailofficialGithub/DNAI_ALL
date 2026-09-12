import React from 'react';
import { Route, Redirect, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasRole, hasAnyRole, isRoleEmpty, normalizeRole } from '../utils/roleUtils';

const ProtectedRoute = ({ component: Component, allowedRoles = [], ...rest }) => {
  const { user, profile, loading, getDashboardPath, signOut } = useAuth();
  const location = useLocation();

  return (
    <Route
      {...rest}
      render={(props) => {
        // Show loading while checking authentication
        if (loading) {
          // Add spinner animation
          const styleTag = document.createElement('style');
          styleTag.innerHTML = `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `;
          if (!document.head.querySelector('style[data-spinner]')) {
            styleTag.setAttribute('data-spinner', 'true');
            document.head.appendChild(styleTag);
          }

          return (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '18px',
              fontFamily: 'Arial, sans-serif'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  border: '5px solid rgba(255,255,255,0.3)',
                  borderTop: '5px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px'
                }}></div>
                <p>Loading...</p>
              </div>
            </div>
          );
        }

        // If not authenticated, redirect to login
        if (!user) {
          console.log('❌ ProtectedRoute: Not authenticated. Redirecting to login.');
          return <Redirect to="/login" />;
        }

        // If no profile yet, wait
        if (!profile || isRoleEmpty(profile.role)) {
          console.log('⏳ ProtectedRoute: Waiting for profile...');
          return null;
        }
        
        // Check if user has admin role - redirect to admin dashboard ONLY if not already on an admin route
        // IMPORTANT: Admin takes priority over reseller
        if (hasRole(profile.role, 'admin')) {
          const currentPath = location.pathname;
          const isAdminRoute = currentPath.startsWith('/admin');
          
          if (!isAdminRoute) {
            console.log('🔄 ProtectedRoute: Admin role detected. Redirecting to /admin/dashboard.');
            return <Redirect to="/admin/dashboard" />;
          }
          // If already on admin route, allow access (don't redirect)
          console.log('✅ ProtectedRoute: Admin on admin route, allowing access.');
        }
        // Check if user has reseller role - redirect to reseller dashboard ONLY if not already on a reseller route
        else if (hasRole(profile.role, 'reseller')) {
          // Only redirect if user is NOT already on a reseller route
          const currentPath = location.pathname;
          const isResellerRoute = currentPath.startsWith('/reseller');
          
          if (!isResellerRoute) {
            console.log('🔄 ProtectedRoute: Reseller role detected. Redirecting to /reseller/dashboard.');
            return <Redirect to="/reseller/dashboard" />;
          }
          // If already on reseller route, allow access (don't redirect)
          console.log('✅ ProtectedRoute: Reseller on reseller route, allowing access.');
        }
        // Check if user has support role - redirect to support dashboard ONLY if not already on a support route
        else if (hasRole(profile.role, 'support')) {
          // Only redirect if user is NOT already on a support route
          const currentPath = location.pathname;
          const isSupportRoute = currentPath.startsWith('/support');
          
          if (!isSupportRoute) {
            console.log('🔄 ProtectedRoute: Support role detected. Redirecting to /support/dashboard.');
            return <Redirect to="/support/dashboard" />;
          }
          // If already on support route, allow access (don't redirect)
          console.log('✅ ProtectedRoute: Support on support route, allowing access.');
        }
        
        // If user is ONLY consumer or user (has consumer/user but no reseller, admin, or support), redirect to external site
        const userRoles = normalizeRole(profile.role);
        const isOnlyConsumer = userRoles.length === 1 && (userRoles.includes('consumer') || userRoles.includes('user'));
        if (isOnlyConsumer) {
          console.log('❌ ProtectedRoute: Consumer/User-only role detected. Redirecting to external site.');
          signOut();
          // Redirect to external site after a brief delay
          setTimeout(() => {
            window.location.href = 'https://social.duhanashrah.ai/';
          }, 100);
          return null;
        }

        // Check if user's role is allowed
        if (allowedRoles.length > 0 && !hasAnyRole(profile.role, allowedRoles)) {
          console.log('❌ ProtectedRoute: Role not allowed. Redirecting to correct dashboard.');
          const dashboardPath = getDashboardPath();
          return <Redirect to={dashboardPath} />;
        }

        // Check if account is deactivated (for reseller)
        if (hasRole(profile.role, 'reseller') && profile.account_status === 'deactive') {
          console.log('❌ ProtectedRoute: Account is deactivated. Signing out and redirecting.');
          signOut();
          return <Redirect to="/login" />;
        }

        // All checks passed, render component
        console.log('✅ ProtectedRoute: Access granted.');
        return <Component {...props} />;
      }}
    />
  );
};

export default ProtectedRoute;
