import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import { validatePassword } from '../utils/passwordValidation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import LegalModal from './LegalModal';

// Import assets
import characterImage from '../assest/Gemini_Generated_Image_ppyqz2ppyqz2ppyq (1) 1.png';
import logoImage from '../assest/LOGO LIGHT MODE.png';
import logoImageDark from '../assest/LOGO DARK MODE.png';
import googleIcon from '../assest/google.svg';
import appleIcon from '../assest/Apple.svg';
import facebookIcon from '../assest/Symbol.png.png';
import viewOffIcon from '../assest/view-off.svg';
import vector10Icon from '../assest/Vector 10.svg';
import rectangle1281Image from '../assest/Rectangle 1281.png';
import verifyOptMascot from '../assest/signup.png';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useThemeMode();
  const { signUp, user, loading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [countryCode, setCountryCode] = useState<string>('+1');
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Legal Modal State
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');

  // Validation helpers
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    const savedSignupData = location.state?.signupData;
    if (!savedSignupData) return;

    if (savedSignupData.formData) {
      setFormData({
        firstName: savedSignupData.formData.firstName || '',
        lastName: savedSignupData.formData.lastName || '',
        email: savedSignupData.formData.email || '',
        phone: savedSignupData.formData.phone || '',
        password: savedSignupData.formData.password || '',
        confirmPassword: savedSignupData.formData.confirmPassword || '',
      });
    }

    if (savedSignupData.countryCode) {
      setCountryCode(savedSignupData.countryCode);
    }

    if (typeof savedSignupData.agreeTerms === 'boolean') {
      setAgreeTerms(savedSignupData.agreeTerms);
    }
  }, [location.state]);



  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof FieldErrors);

    // Real-time validation for email
    if (name === 'email' && value.length > 0 && !emailRegex.test(value)) {
      setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    }
    // Real-time validation: clear confirmPassword error if they now match
    if (name === 'confirmPassword' || name === 'password') {
      if (name === 'confirmPassword' && formData.password && value && value !== formData.password) {
        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Oops! Your passwords don’t match.' }));
      } else if (name === 'confirmPassword' && value === formData.password) {
        clearFieldError('confirmPassword');
      }
      if (name === 'password' && formData.confirmPassword && formData.confirmPassword !== value) {
        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Oops! Your passwords don’t match.' }));
      } else if (name === 'password' && formData.confirmPassword === value) {
        clearFieldError('confirmPassword');
      }
    }
  };


  const saveSignupProfileData = async (
    userId: string | null | undefined,
    email: string
  ) => {
    let resolvedUserId = userId || null;
    const fullPhone = formData.phone ? `${countryCode}${formData.phone}` : null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!resolvedUserId && attempt > 0) {
        const { data: availability } = await supabase
          .rpc('validate_signup_availability', {
            p_email: email,
            p_phone: fullPhone
          });

        if (availability?.user_id) {
          resolvedUserId = availability.user_id;
        }
      }

      const { data, error } = await supabase
        .rpc('save_signup_profile_data', {
          p_user_id: resolvedUserId,
          p_email: email,
          p_first_name: formData.firstName,
          p_last_name: formData.lastName,
          p_phone: fullPhone,
          p_country_code: countryCode
        });

      if (!error && data?.success) {
        return;
      }

      if (error) {
        console.error('Error saving signup profile data:', error);
        return;
      }

      await new Promise(resolve => window.setTimeout(resolve, 500));
    }

    console.error('Error saving signup profile data: signup user was not found after retries');
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Field-specific validation
    const errors: FieldErrors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (formData.phone.trim() && formData.phone.length < 7) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        errors.password = passwordValidation.errors.join('. ');
      }
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Oops! Your passwords don’t match.';
    }
    if (!agreeTerms) {
      errors.terms = 'Please agree to the Terms & Privacy';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      // 1. Pre-check for existing email or phone via detailed RPC
      try {
        const fullPhone = formData.phone ? `${countryCode}${formData.phone}` : null;
        const normalizedEmail = formData.email.trim().toLowerCase();
        const { data: availability, error: rpcError } = await supabase
          .rpc('validate_signup_availability', {
            p_email: normalizedEmail,
            p_phone: fullPhone
          });

        if (!rpcError && availability) {
          if (availability.status === 'VERIFIED') {
            setFieldErrors({ email: 'This email address is already registered.' });
            setLoading(false);
            return;
          } else if (availability.status === 'UNVERIFIED') {
            const existingUserId = availability.user_id;
            
            // Update their profile with the NEW data
            if (existingUserId) {
              await saveSignupProfileData(existingUserId, normalizedEmail);
            }

            // Store sent_at timestamp for timer sync
            localStorage.setItem(`otp_sent_at_${normalizedEmail}`, new Date().toISOString());

            // Send OTP again to be sure
            await (supabase.auth as any).resend({
              type: 'signup',
              email: normalizedEmail,
            });
            // Redirect to verify email page
            navigate('/verify-email', {
              state: {
                email: normalizedEmail,
                purpose: 'email_verification',
                signupData: {
                  formData,
                  countryCode,
                  agreeTerms,
                },
              },
            });
            setLoading(false);
            return;
          } else if (availability.status === 'PHONE_TAKEN') {
            setFieldErrors({ phone: 'This phone number is already registered with another account.' });
            setLoading(false);
            return;
          }
        }
      } catch (checkErr) {
        console.debug('Pre-check error:', checkErr);
      }

      // 2. Proceed with Sign Up if check passed or failed (fallback to Supabase logic)
      const normalizedEmail = formData.email.trim().toLowerCase();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: "https://genie.duhanashrah.ai/dashboard",
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name: `${formData.firstName} ${formData.lastName}`,
            role: ["consumer"],
            phone: formData.phone ? `${countryCode}${formData.phone}` : null,
            country_code: countryCode,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('already registered')) {
          setFieldErrors({ email: 'This email address is already registered.' });
        } else if (signUpError.message?.toLowerCase().includes('rate limit exceeded')) {
          setError('Too many attempts. Please wait before requesting another code.');
        } else {
          setError(signUpError.message || 'Failed to create account');
        }
        setLoading(false);
        return;
      }

      const createdUser = signUpData?.user || (signUpData?.id ? signUpData : null);

      // Supabase returns a user with an empty identities array when signup is
      // accepted but the email already belongs to an existing confirmed user.
      const identities = createdUser?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setFieldErrors({ email: 'This email address is already registered.' });
        setLoading(false);
        return;
      }

      // Save signup profile/access data immediately when Supabase returns the new user.
      // This uses a SECURITY DEFINER RPC because signup usually has no app
      // session until OTP verification is complete.
      await saveSignupProfileData(createdUser?.id, normalizedEmail);

      // Store sent_at timestamp for timer sync
      localStorage.setItem(`otp_sent_at_${normalizedEmail}`, new Date().toISOString());

      // Navigate to verify email page
      navigate('/verify-email', {
        state: {
          email: normalizedEmail,
          purpose: 'email_verification',
          signupData: {
            formData,
            countryCode,
            agreeTerms,
          },
        },
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="signin-container">
        <div className="signin-main-content">
          {/* Left Panel - Blue Section */}
          <section className="relative hidden lg:flex min-h-[680px] rounded-[34px] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_95%_88%,#95eee5_0%,#1ec6b2_38%,#13bda9_70%,#09b7a3_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(255,255,255,0.14),transparent_46%)]" />
            <div className="mt-30">
              <div className="absolute -left-[430px] -bottom-[614px] h-[920px] w-[920px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[418px] -bottom-[602px] h-[896px] w-[896px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[406px] -bottom-[590px] h-[872px] w-[872px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[394px] -bottom-[578px] h-[848px] w-[848px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[382px] -bottom-[566px] h-[824px] w-[824px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[370px] -bottom-[554px] h-[800px] w-[800px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[358px] -bottom-[542px] h-[776px] w-[776px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[346px] -bottom-[530px] h-[752px] w-[752px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[334px] -bottom-[518px] h-[728px] w-[728px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[322px] -bottom-[506px] h-[704px] w-[704px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[310px] -bottom-[494px] h-[680px] w-[680px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[298px] -bottom-[482px] h-[656px] w-[656px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[286px] -bottom-[470px] h-[632px] w-[632px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[274px] -bottom-[458px] h-[608px] w-[608px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[262px] -bottom-[446px] h-[584px] w-[584px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[250px] -bottom-[434px] h-[560px] w-[560px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[238px] -bottom-[422px] h-[536px] w-[536px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[226px] -bottom-[410px] h-[512px] w-[512px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[214px] -bottom-[398px] h-[488px] w-[488px] rounded-full border-[0.5px] border-white/80" />
            </div>

            <div className="relative z-10 flex h-full w-full flex-col p-10 text-white">
              <div className="space-y-5">
                <h1 className="max-w-[440px] text-[56px] leading-[1.08] font-semibold tracking-[-0.02em]">
                  Sign up to your creative HQ
                </h1>

                <svg width="250" height="24" viewBox="0 0 250 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 19C37 8 98 6 245 18" stroke="rgba(255,255,255,0.95)" strokeWidth="2" strokeLinecap="round" />
                </svg>

                <p className="max-w-[250px] text-[16px] leading-relaxed text-white/95">
                  Unlock the power of AI-driven social media intelligence. Create, analyze, and dominate your social presence with cutting-edge tools.
                </p>
              </div>
            </div>

            <div>
              <div className="pointer-events-none absolute bottom-[-10px] ml-5 left-1/2 w-full left-[0%] top-[300px]">
                <img src={verifyOptMascot} alt="Beeba mascot" className="block h-[460px] w-auto object-contain" />
              </div>
            </div>
          </section>

          {/* Right Side - Logo and Form */}
          <div className="signin-right-side">
            <div className="signin-logo">
              <img src={mode === 'dark' ? logoImageDark : logoImage} alt="DNAi - Duha Nashrah" />
            </div>

            <div className="signup-form-wrapper">
              <div className="signup-welcome">
                <h2 className="signin-welcome-title">Create your account!</h2>
                <p className="signin-welcome-subtitle">Tell us a bit about yourself to get started.</p>
              </div>

              <form onSubmit={handleSubmit} className="signin-form">
                <div className="signin-form-group">
                  <div className="signin-form-fields">
                    <div className="signin-form-field-row">
                      <div className="signin-form-field">
                        <div className="signin-label-row">
                          <Label htmlFor="firstName" className="signin-label">First Name *</Label>
                        </div>
                        <div className={`signin-input-wrapper ${fieldErrors.firstName ? 'signin-input-error' : ''}`}>
                          <Input
                            id="firstName"
                            type="text"
                            name="firstName"
                            placeholder="Enter your first name"
                            value={formData.firstName}
                            onChange={handleChange}
                            className="signin-input"
                          />
                        </div>
                        {fieldErrors.firstName && (
                          <span className="signin-field-error">{fieldErrors.firstName}</span>
                        )}
                      </div>

                      <div className="signin-form-field">
                        <div className="signin-label-row">
                          <Label htmlFor="lastName" className="signin-label">Last Name *</Label>
                        </div>
                        <div className={`signin-input-wrapper ${fieldErrors.lastName ? 'signin-input-error' : ''}`}>
                          <Input
                            id="lastName"
                            type="text"
                            name="lastName"
                            placeholder="Enter your last name"
                            value={formData.lastName}
                            onChange={handleChange}
                            className="signin-input"
                          />
                        </div>
                        {fieldErrors.lastName && (
                          <span className="signin-field-error">{fieldErrors.lastName}</span>
                        )}
                      </div>
                    </div>

                    <div className="signin-form-field">
                      <div className="signin-label-row">
                        <Label htmlFor="email" className="signin-label">Email Address *</Label>
                      </div>
                      <div className={`signin-input-wrapper ${fieldErrors.email ? 'signin-input-error' : ''}`}>
                        <Input
                          id="email"
                          type="email"
                          name="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={handleChange}
                          className="signin-input"
                        />
                      </div>
                      {fieldErrors.email && (
                        <span className="signin-field-error">{fieldErrors.email}</span>
                      )}
                    </div>

                    <div className="signin-form-field">
                      <div className="signin-label-row">
                        <Label htmlFor="phone" className="signin-label">Phone Number</Label>
                      </div>
                      <div className={`signin-phone-input-group ${fieldErrors.phone ? 'signin-phone-group-error' : ''}`}>
                        <div className="signin-country-code-wrapper">
                          <CountryCodeSelector
                            value={countryCode}
                            onChange={setCountryCode}
                          />
                        </div>
                        <div className={`signin-input-wrapper signin-phone-input ${fieldErrors.phone ? 'signin-input-error' : ''}`}>
                          <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            placeholder="0123456789"
                            value={formData.phone}
                            onChange={(e) => {
                              // Only allow digits, strip everything else including country code characters
                              const numericValue = e.target.value.replace(/\D/g, '').slice(0, 15);
                              setFormData(prev => ({ ...prev, phone: numericValue }));
                              clearFieldError('phone');
                            }}
                            onKeyDown={(e) => {
                              // Block +, -, (, ), space and other non-numeric keys (allow backspace, tab, arrows etc.)
                              const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
                              if (allowedKeys.includes(e.key)) return;
                              if (e.ctrlKey || e.metaKey) return; // Allow copy/paste shortcuts
                              if (!/^\d$/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            maxLength={15}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="signin-input"
                          />
                        </div>
                      </div>
                      {fieldErrors.phone && (
                        <span className="signin-field-error">{fieldErrors.phone}</span>
                      )}
                    </div>

                    <div className="signin-form-field">
                      <div className="signin-label-row">
                        <Label htmlFor="password" className="signin-label">Password *</Label>
                      </div>
                      <div className={`signin-password-input ${fieldErrors.password ? 'signin-input-error' : ''}`}>
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="Enter Your Password"
                          value={formData.password}
                          onChange={handleChange}
                          className="signin-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="signin-eye-button"
                          style={{ backgroundImage: `url(${viewOffIcon})` }}
                        ></button>
                      </div>
                      {fieldErrors.password && (
                        <span className="signin-field-error">{fieldErrors.password}</span>
                      )}
                    </div>

                    <div className="signin-form-field">
                      <div className="signin-label-row">
                        <Label htmlFor="confirmPassword" className="signin-label">Confirm Password *</Label>
                      </div>
                      <div className={`signin-password-input ${fieldErrors.confirmPassword ? 'signin-input-error' : ''}`}>
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          placeholder="Enter Your Confirm Password"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="signin-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="signin-eye-button"
                          style={{ backgroundImage: `url(${viewOffIcon})` }}
                        ></button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <span className="signin-field-error">{fieldErrors.confirmPassword}</span>
                      )}
                    </div>
                  </div>

                  <div className="signin-checkbox-group">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        if (e.target.checked) clearFieldError('terms');
                      }}
                      className={`signin-checkbox ${fieldErrors.terms ? 'signin-checkbox-error' : ''}`}
                    />
                    <Label htmlFor="terms" className="signin-checkbox-label">
                      I agree to the{' '}
                      <button
                        type="button"
                        className="signin-terms-link bg-transparent border-none p-0 cursor-pointer text-primary hover:underline h-auto font-normal inline"
                        onClick={() => {
                          setLegalModalType('terms');
                          setShowLegalModal(true);
                        }}
                      >
                        Terms
                      </button>
                      {' & '}
                      <Link
                        to="/privacy-policy"
                        target="_blank"
                        className="signin-terms-link bg-transparent border-none p-0 cursor-pointer text-primary hover:underline h-auto font-normal inline"
                      >
                        Privacy
                      </Link>
                    </Label>
                  </div>
                  {fieldErrors.terms && (
                    <span className="signin-field-error" style={{ marginTop: '-4px' }}>{fieldErrors.terms}</span>
                  )}
                </div>

                {error && (
                  <div className="signin-error">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="signin-submit-button"
                  disabled={loading}
                >
                  <span className="signin-submit-button-text">{loading ? 'Creating Account...' : 'Sign up'}</span>
                </Button>

                <div className="signin-form-bottom">
                  <div className="signin-signup-link">
                    <span className="signin-signup-text">Have an account? </span>
                    <Link to="/" className="signin-signup-link-text">Sign in</Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        type={legalModalType}
      />
    </>
  );
};

export default SignUp;
