import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import '../App.css';

// Type assertion for lucide-react icons to fix TypeScript compatibility
const EyeIcon = Eye as any;
const EyeOffIcon = EyeOff as any;

// Types
type Page = 'signin' | 'signup' | 'forgot' | 'verify' | 'newpassword' | 'success';

const AuthApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '123@gmail.com',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    confirmPassword: '',
    otp: ['', '', '', '', '', '']
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateOTP = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...formData.otp];
      newOtp[index] = value;
      setFormData(prev => ({ ...prev, otp: newOtp }));
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  // Sign In Page
  const SignInPage = () => (
    <div className="auth-container">
      <div className="left-panel">
        <div className="content-wrapper">
          <h1 className="hero-title">Sign in to your creative HQ</h1>
          <div className="underline"></div>
          <p className="hero-description">
            Unlock the power of AI-driven social media intelligence. Create, analyze, and dominate your social presence with cutting-edge tools.
          </p>
        </div>
      </div>
      
      <div className="right-panel">
        <div className="form-container">
          <h2 className="form-title">Welcome back!</h2>
          <p className="form-subtitle">Good to see you again.</p>
          
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="123@gmail.com"
            />
          </div>
          
          <div className="form-group">
            <div className="label-row">
              <label>Password</label>
              <button 
                className="link-button"
                onClick={() => setCurrentPage('forgot')}
                type="button"
              >
                Forget Password?
              </button>
            </div>
            <div className="password-input">
              <input 
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Enter Your Password"
              />
              <button 
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
          </div>
          
          <div className="checkbox-group">
            <input type="checkbox" id="terms" />
            <label htmlFor="terms">I agree to the Terms & Privacy</label>
          </div>
          
          <button className="primary-button">Sign in</button>
          
          <p className="bottom-link">
            Don't have an account? <button onClick={() => setCurrentPage('signup')} type="button">Sign up</button>
          </p>
          
          <div className="divider">or</div>
          
          <div className="social-buttons">
            <button className="social-button" type="button">
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/%3E%3Cpath fill='%2334A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/%3E%3Cpath fill='%23FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/%3E%3Cpath fill='%23EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/%3E%3C/svg%3E" alt="Google" />
              Google
            </button>
            <button className="social-button" type="button">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="currentColor"/></svg>
              Apple
            </button>
            <button className="social-button" type="button">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Sign Up Page
  const SignUpPage = () => (
    <div className="auth-container">
      <div className="left-panel">
        <div className="content-wrapper">
          <h1 className="hero-title">Build your AI-powered social growth engine</h1>
          <div className="underline"></div>
          <p className="hero-description">
            Launch your personal AI agent to handle content, insights, and execution across platforms. Stop reacting. Start controlling your social media with data-driven automation.
          </p>
        </div>
      </div>
      
      <div className="right-panel">
        <div className="form-container">
          <h2 className="form-title">Create your account!</h2>
          <p className="form-subtitle">Tell us a bit about yourself to get started.</p>
          
          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input 
                type="text"
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="Enter your first name"
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input 
                type="text"
                value={formData.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Enter your last name"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Email Address *</label>
            <input 
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label>Phone Number *</label>
            <div className="phone-input">
              <select className="country-code">
                <option>+1</option>
                <option>+92</option>
                <option>+44</option>
              </select>
              <input 
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="0123456789"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Password *</label>
            <div className="password-input">
              <input 
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Enter Your Password"
              />
              <button 
                className="eye-button"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label>Confirm Password *</label>
            <div className="password-input">
              <input 
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                placeholder="Enter Your Confirm Password"
              />
              <button 
                className="eye-button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                type="button"
              >
                {showConfirmPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
          </div>
          
          <div className="checkbox-group">
            <input type="checkbox" id="terms-signup" />
            <label htmlFor="terms-signup">I agree to the Terms & Privacy</label>
          </div>
          
          <button className="primary-button">Sign up</button>
          
          <p className="bottom-link">
            Have an account? <button onClick={() => setCurrentPage('signin')} type="button">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );

  // Forgot Password Page
  const ForgotPasswordPage = () => (
    <div className="center-container">
      <div className="center-form">
        <h2 className="center-title">Reset Your Password</h2>
        <p className="center-subtitle">
          Enter your email address, and we'll send you an OTP to create a new password.
        </p>
        
        <div className="form-group">
          <label>Email Address</label>
          <input 
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="123@gmail.com"
          />
        </div>
        
        <button 
          className="primary-button"
          onClick={() => setCurrentPage('verify')}
        >
          Send reset link
        </button>
        
        <p className="bottom-link center-bottom">
          Back To <button onClick={() => setCurrentPage('signin')} type="button">Sign in</button>
        </p>
      </div>
    </div>
  );

  // Verify Email Page
  const VerifyEmailPage = () => (
    <div className="center-container">
      <div className="center-form">
        <h2 className="center-title">Verify Your Email</h2>
        <p className="center-subtitle">
          Please enter the code we just sent to email.
        </p>
        
        <div className="otp-container">
          {formData.otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => updateOTP(index, e.target.value)}
              className="otp-input"
            />
          ))}
        </div>
        
        <p className="resend-text">
          Didn't receive OTP? <button className="link-button" type="button">Resend Code</button>
        </p>
        
        <button 
          className="primary-button"
          onClick={() => setCurrentPage('newpassword')}
        >
          Done
        </button>
        
        <p className="bottom-link center-bottom">
          Back To <button onClick={() => setCurrentPage('signin')} type="button">Sign in</button>
        </p>
      </div>
    </div>
  );

  // New Password Page
  const NewPasswordPage = () => (
    <div className="center-container">
      <div className="center-form">
        <h2 className="center-title">Set a New Password</h2>
        <p className="center-subtitle">
          Create a new password to continue.
        </p>
        
        <div className="form-group">
          <label>Enter New Password</label>
          <div className="password-input">
            <input 
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="Enter Your New Password"
            />
            <button 
              className="eye-button"
              onClick={() => setShowPassword(!showPassword)}
              type="button"
            >
              {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label>Confirm Password</label>
          <div className="password-input">
            <input 
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              placeholder="Enter Your Confirm Password"
            />
            <button 
              className="eye-button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              type="button"
            >
              {showConfirmPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
            </button>
          </div>
        </div>
        
        <button 
          className="primary-button"
          onClick={() => setCurrentPage('success')}
        >
          Done
        </button>
      </div>
    </div>
  );

  // Success Page
  const SuccessPage = () => (
    <div className="center-container">
      <div className="center-form success-form">
        <div className="success-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="40" fill="#22C55E"/>
            <path d="M25 40L35 50L55 30" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h2 className="center-title">Password Updated!</h2>
        <p className="center-subtitle">
          Your password has been changed successfully. You can continue using your account with your new credentials.
        </p>
        
        <button 
          className="primary-button"
          onClick={() => setCurrentPage('signin')}
        >
          Go to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {currentPage === 'signin' && <SignInPage />}
      {currentPage === 'signup' && <SignUpPage />}
      {currentPage === 'forgot' && <ForgotPasswordPage />}
      {currentPage === 'verify' && <VerifyEmailPage />}
      {currentPage === 'newpassword' && <NewPasswordPage />}
      {currentPage === 'success' && <SuccessPage />}
    </div>
  );
};

export default AuthApp;
