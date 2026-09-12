import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const RoleBasedRoute = ({ component: Component, allowedRole, ...rest }) => {
  const { user, profile, loading } = useAuth();

  console.log('🔄 RoleBasedRoute: Rendering route for path:', rest.path);
  console.log('🔄 RoleBasedRoute: User:', user ? 'Authenticated' : 'Not authenticated');
  console.log('🔄 RoleBasedRoute: Profile role:', profile?.role);

  return (
    <Route
      {...rest}
      render={(props) => {
        // TEMPORARILY DISABLED FOR TESTING
        // If user is not authenticated, redirect to login
        // if (!user) {
        //   console.log('❌ RoleBasedRoute: No user, redirecting to /login');
        //   return <Redirect to="/login" />;
        // }

        // If user is authenticated but doesn't have a profile yet, wait
        // if (!profile) {
        //   console.log('⏳ RoleBasedRoute: Waiting for profile...');
        //   return null;
        // }

        // Check if user has the required role
        // if (profile.role !== allowedRole) {
        //   console.log('❌ RoleBasedRoute: Wrong role. Expected:', allowedRole, 'Got:', profile.role);
        //   // Redirect to their correct dashboard
        //   return <Redirect to={`/${profile.role}/dashboard`} />;
        // }

        console.log('✅ RoleBasedRoute: Rendering component (auth disabled)');
        return <Component {...props} />;
      }}
    />
  );
};

export default RoleBasedRoute;

