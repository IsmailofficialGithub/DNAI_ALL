
import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/animate.min.css";
import "./assets/scss/light-bootstrap-dashboard-react.scss?v=2.0.0";
import "./assets/css/demo.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import AdminLayout from "layouts/Admin.js";
import ResellerLayout from "layouts/Reseller.js";
import SupportLayout from "layouts/Support.js";
import ConsumerLayout from "layouts/Consumer.js";
import Login from "views/Login.js";
import Payment from "views/Payment.js";
import Calls from "views/Calls.js";
import ProtectedRoute from "auth/ProtectedRoute.js";
import { AuthProvider } from "contexts/AuthContext";
import toast, { Toaster } from "react-hot-toast";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4caf50',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#f44336',
              secondary: '#fff',
            },
          },
        }}
      />
      <Switch>
        <Route path="/login" component={Login} />
        <Route exact path="/payment" component={Payment} />
        <Route exact path="/calls" component={Calls} />
        <ProtectedRoute path="/admin" component={AdminLayout} allowedRoles={['admin', 'support']} />
        <ProtectedRoute path="/reseller" component={ResellerLayout} allowedRoles={['reseller']} />
        <ProtectedRoute path="/support" component={SupportLayout} allowedRoles={['support']} />
        {/* Consumer routes - redirect resellers to /reseller, consumer-only to external site */}
        <Route path="/consumer" render={() => {
          // This route is handled by ProtectedRoute, but as a fallback:
          // If user has reseller role, redirect to reseller dashboard
          // If user is ONLY consumer, redirect to external site
          toast.error('You are not authorized to access this page. Redirecting...');
          setTimeout(() => {
            // Check localStorage for role info (if available)
            const profile = JSON.parse(localStorage.getItem('profile') || '{}');
            if (profile?.role && Array.isArray(profile.role) && profile.role.includes('reseller')) {
              window.location.href = '/reseller';
            } else {
            window.location.href = 'https://social.duhanashrah.ai/';
            }
          }, 3000);
          return null;
        }} />
        <Redirect from="/" to="/login" />
      </Switch>
    </AuthProvider>
  </BrowserRouter>
);
