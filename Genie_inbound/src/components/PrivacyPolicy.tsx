import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Shield, Globe, Lock, Clock, Eye, Info, AlertCircle, Menu, X, Sun, Moon, FileText, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { useThemeMode } from '../contexts/ThemeContext';

import logoLight from '../assest/LOGO LIGHT MODE.png';
import logoDark from '../assest/LOGO DARK MODE.png';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const { mode, setMode } = useThemeMode();
  const [activeSection, setActiveSection] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string>('');
  const observer = useRef<IntersectionObserver | null>(null);

  const sections = [
    { id: 'definitions', title: '1. Key Definitions', icon: <Info className="w-5 h-5" /> },
    { id: 'scope', title: '2. Scope', icon: <Globe className="w-5 h-5" /> },
    { id: 'collection', title: '3. Information We Collect', icon: <Eye className="w-5 h-5" /> },
    { id: 'how-collect', title: '4. How We Collect', icon: <FileText className="w-5 h-5" /> },
    { id: 'use', title: '5. How We Use Information', icon: <CheckCircle2 className="w-5 h-5" /> },
    { id: 'legal', title: '6. Legal Bases', icon: <Scale className="w-5 h-5" /> },
    { id: 'sharing', title: '7. Data Sharing', icon: <Mail className="w-5 h-5" /> },
    { id: 'storage', title: '8. Storage & Security', icon: <Lock className="w-5 h-5" /> },
    { id: 'retention', title: '9. Data Retention', icon: <Clock className="w-5 h-5" /> },
    { id: 'cookies', title: '10. Cookies', icon: <Info className="w-5 h-5" /> },
    { id: 'third-party', title: '11. Third-Party Services', icon: <Globe className="w-5 h-5" /> },
    { id: 'compliance', title: '12. Compliance Notice', icon: <AlertTriangle className="w-5 h-5" /> },
    { id: 'ai-training', title: '13. AI Training', icon: <Shield className="w-5 h-5" /> },
    { id: 'transfers', title: '14. Data Transfers', icon: <Globe className="w-5 h-5" /> },
    { id: 'rights', title: '15. Your Rights', icon: <Shield className="w-5 h-5" /> },
    { id: 'children', title: '16. Children’s Privacy', icon: <Info className="w-5 h-5" /> },
    { id: 'acceptable-use', title: '17. Acceptable Use', icon: <AlertTriangle className="w-5 h-5" /> },
    { id: 'responsibility', title: '18. Account Responsibility', icon: <Shield className="w-5 h-5" /> },
    { id: 'updates', title: '19. Policy Updates', icon: <Clock className="w-5 h-5" /> },
    { id: 'contact', title: '20. Contact Information', icon: <Mail className="w-5 h-5" /> },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);

    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.current?.observe(el);
    });

    return () => observer.current?.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setIsMobileMenuOpen(false);
    setHighlightedSection(id);
    setTimeout(() => setHighlightedSection(''), 2000);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <style>{`
        @keyframes highlight-fade {
          0% { background-color: rgba(0, 193, 156, 0.15); }
          100% { background-color: transparent; }
        }
        .section-highlight {
          animation: highlight-fade 2s ease-out forwards;
          border-radius: 1rem;
          padding: 1.5rem;
          margin: -1.5rem;
        }
      `}</style>
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-[#1d212b]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-[1440px]">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              className="hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="h-10 flex items-center justify-center">
              <img src={mode === 'dark' ? logoDark : logoLight} alt="Logo" className="h-full w-auto object-contain" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden md:inline-block text-xs text-slate-500 dark:text-slate-500 font-medium">
              Effective Date: May 11, 2026
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-[#00c19c] dark:hover:text-[#00c19c]"
            >
              {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-[#0f1117] lg:hidden pt-20 px-6 overflow-y-auto">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 px-3">Table of Contents</p>
          <div className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-4 ${
                  activeSection === section.id 
                  ? 'bg-[#00c19c]/10 text-[#00c19c]' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={activeSection === section.id ? 'text-[#00c19c]' : 'text-slate-400'}>
                  {section.icon}
                </span>
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 lg:py-12 flex flex-col lg:flex-row gap-6 lg:gap-8 relative max-w-[1440px]">
        {/* Sidebar Navigation - STICKY */}
        <aside className="lg:w-64 shrink-0 hidden lg:block">
          <div className="sticky top-28 w-full space-y-0.5 h-[80vh] overflow-y-auto pr-2 scrollbar-thin">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-3">Table of Contents</p>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-3 group ${
                  activeSection === section.id 
                  ? 'bg-[#00c19c]/10 text-[#00c19c] ring-1 ring-[#00c19c]/20' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#00c19c]'
                }`}
              >
                <span className={`transition-colors ${activeSection === section.id ? 'text-[#00c19c]' : 'text-slate-400 group-hover:text-[#00c19c]'}`}>
                  {React.cloneElement(section.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
                </span>
                {section.title}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white dark:bg-[#1d212b] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 lg:p-16 transition-colors duration-300">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div className="mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00c19c]/10 text-[#00c19c] text-xs font-bold uppercase tracking-wider mb-4">
                Legal Documentation
              </div>
              <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-slate-900 dark:text-white leading-tight">
                Privacy Policy
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400 mb-8">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Effective Date: May 11, 2026</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Last Updated: May 11, 2026</span>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                This Privacy Policy explains how Duha Nashrah.AI (DNAI) (“DNAI,” “we,” “us,” “our”) collects, uses, shares, and protects information when you access or use the GENIE dashboard and services through genie.duhanashrah.ai and related services on duhanashrah.ai (together, the “Services”).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="bg-slate-50 dark:bg-[#0f1117] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-[#00c19c]"><Shield className="w-5 h-5" /> Operator Details</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="text-slate-400">Entity:</span> Niku Solutions PTE LTD, Singapore</p>
                  <p><span className="text-slate-400">Brand:</span> Duha Nashrah.AI (DNAI)</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f1117] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-[#00c19c]"><Mail className="w-5 h-5" /> Contact Channels</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="text-slate-400">Privacy:</span> info@duhanashrah.ai</p>
                  <p><span className="text-slate-400">Sales:</span> sales@duhanashrah.ai</p>
                </div>
              </div>
            </div>

            <div className="bg-[#00c19c]/10 border-l-4 border-[#00c19c] p-6 rounded-r-2xl mb-12 shadow-sm">
              <div className="flex gap-4">
                <AlertCircle className="w-6 h-6 text-[#00c19c] shrink-0 mt-0.5" />
                <p className="text-sm text-[#008068] dark:text-[#00c19c] font-semibold leading-relaxed">
                  If you are an End Caller, your information is typically processed on behalf of the Customer you are calling. Please contact that business for their call privacy practices.
                </p>
              </div>
            </div>

            <Separator className="my-12 opacity-50" />

            {/* 1. Key Definitions */}
            <section id="definitions" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'definitions' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">1</span>
                Key Definitions
              </h2>
              <ul className="space-y-4">
                <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00c19c] mt-2.5 shrink-0" />
                  <p><strong>“Customer”</strong> means an organization (business) that subscribes to or uses the Services.</p>
                </li>
                <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00c19c] mt-2.5 shrink-0" />
                  <p><strong>“User”</strong> means an individual who uses the Services (including Customer employees/contractors).</p>
                </li>
                <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00c19c] mt-2.5 shrink-0" />
                  <p><strong>“End Caller”</strong> means a person who calls a phone number connected to the Services (e.g., your customer/prospect).</p>
                </li>
                <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00c19c] mt-2.5 shrink-0" />
                  <p><strong>“Customer Data”</strong> means data submitted to or generated within the Services under a Customer account (including call logs, recordings, transcripts, lead data, scripts, and configurations).</p>
                </li>
                <li className="flex gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00c19c] mt-2.5 shrink-0" />
                  <p><strong>“Personal Data”</strong> means information that identifies or can reasonably identify a person (may include End Caller information).</p>
                </li>
              </ul>
            </section>

            {/* 2. Scope */}
            <section id="scope" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'scope' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">2</span>
                Scope: Who This Policy Applies To
              </h2>
              <p className="mb-4">This Policy applies to:</p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400 mb-6">
                <li>Visitors to duhanashrah.ai</li>
                <li>Users who sign in to and use genie.duhanashrah.ai</li>
                <li>Customers using inbound calling, call routing, recordings/transcripts (if enabled), analytics, and integrations</li>
              </ul>
              <div className="p-4 bg-slate-50 dark:bg-[#0f1117] rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm italic text-slate-500"><strong>Note:</strong> If you are an End Caller, your information is typically processed on behalf of the Customer you are calling. Please contact that business for their call privacy practices.</p>
              </div>
            </section>

            {/* 3. Information We Collect */}
            <section id="collection" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'collection' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">3</span>
                Information We Collect
              </h2>
              
              <div className="space-y-12">
                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-[#00c19c] pl-4">A) Account & Contact Information (Users/Customers)</h3>
                  <p className="mb-4">We may collect:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                    <li>Name, email address, phone number</li>
                    <li>Company name, role/title, department</li>
                    <li>Account credentials (login email + password, or SSO, if enabled)</li>
                    <li>Support messages and correspondence (including attachments you send)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-[#00c19c] pl-4">B) Calling & Conversation Data (Customer Data)</h3>
                  <p className="mb-4">Depending on the features you enable, the Services may process:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                    <li>Inbound phone number(s) and associated labels</li>
                    <li>Caller phone number and call routing outcomes</li>
                    <li>Call metadata (date/time, duration, call status, disposition/outcome, success rate)</li>
                    <li>Call recordings (if enabled by Customer)</li>
                    <li>Call transcripts (if enabled by Customer)</li>
                    <li>AI-generated call summaries, tags, lead qualification notes, appointment details</li>
                    <li>Agent configuration: prompts/scripts, knowledge base entries, business hours/schedules, fallback rules, routing/transfer settings, escalation instructions</li>
                    <li>CRM sync data (lead fields, call outcomes, notes) when integrations are enabled</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-[#00c19c] pl-4">C) Technical Data (Automatic)</h3>
                  <p className="mb-4">We may collect:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                    <li>IP address, approximate location (city/country), browser and device type</li>
                    <li>Operating system, language, time zone</li>
                    <li>Access logs, error logs, security events, crash reports</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-[#00c19c] pl-4">D) Usage & Analytics Data</h3>
                  <p className="mb-4">We may collect:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                    <li>Pages/sections viewed and actions taken in the dashboard</li>
                    <li>Feature usage (e.g., number import, call history filters, recording playback)</li>
                    <li>Performance metrics (peak hours, average call duration, response times)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-[#00c19c] pl-4">E) Billing Information (If Paid Plans Apply)</h3>
                  <p className="mb-4">We may process:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                    <li>Billing contact name/email</li>
                    <li>Invoice details, payment status, transaction references</li>
                  </ul>
                  <p className="mt-4 text-sm font-medium text-slate-500 italic">Payment card details are usually handled by a third-party payment processor and not stored directly by us.</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 border-l-4 border-[#00c19c] pl-4 text-rose-500 border-l-rose-500">F) Information We Don’t Intentionally Collect</h3>
                  <p className="mb-4">We do not intentionally request or want:</p>
                  <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400">
                    <li>Sensitive personal data (e.g., government IDs, bank credentials, health records)</li>
                    <li>Payment card numbers inside the dashboard</li>
                  </ul>
                  <p className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg text-sm text-rose-600 dark:text-rose-400 font-medium">Please do not upload sensitive data unless explicitly required and agreed in writing.</p>
                </div>
              </div>
            </section>

            {/* 4. How We Collect */}
            <section id="how-collect" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'how-collect' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">4</span>
                How We Collect Information
              </h2>
              <p className="mb-4">We collect information through:</p>
              <ul className="list-disc pl-6 space-y-3 text-slate-600 dark:text-slate-400">
                <li>Account creation, profile updates, and in-dashboard settings</li>
                <li>Use of the calling agent (call handling and outcomes generated by your workflows)</li>
                <li>Cookies and similar tracking technologies on the Website/Platform</li>
                <li>Integrations you connect (CRMs, calendars, messaging tools, telephony providers)</li>
                <li>Customer support communications and troubleshooting sessions</li>
              </ul>
            </section>

            {/* 5. How We Use */}
            <section id="use" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'use' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">5</span>
                How We Use Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold mb-3 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[#00c19c]" /> Provide and Operate</h4>
                  <ul className="text-sm space-y-2 text-slate-500 list-disc pl-4">
                    <li>Authenticate users, manage accounts</li>
                    <li>Enable inbound calling, routing, escalations</li>
                    <li>Generate summaries, transcripts, analytics</li>
                  </ul>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold mb-3 flex items-center gap-2"><Shield className="w-5 h-5 text-[#00c19c]" /> Quality & Safety</h4>
                  <ul className="text-sm space-y-2 text-slate-500 list-disc pl-4">
                    <li>Monitor performance and reliability</li>
                    <li>Debug issues and prevent abuse</li>
                    <li>Secure the Services (fraud detection)</li>
                  </ul>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold mb-3 flex items-center gap-2"><Mail className="w-5 h-5 text-[#00c19c]" /> Communications</h4>
                  <ul className="text-sm space-y-2 text-slate-500 list-disc pl-4">
                    <li>Send service notices and alerts</li>
                    <li>Respond to support requests</li>
                    <li>Onboarding guidance</li>
                  </ul>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold mb-3 flex items-center gap-2"><Scale className="w-5 h-5 text-[#00c19c]" /> Billing & Admin</h4>
                  <ul className="text-sm space-y-2 text-slate-500 list-disc pl-4">
                    <li>Process payments</li>
                    <li>Maintain records for compliance</li>
                    <li>Accounting and auditing</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 6. Legal Bases */}
            <section id="legal" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'legal' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">6</span>
                Legal Bases for Processing
              </h2>
              <p className="mb-6">Where laws like GDPR apply, we process Personal Data under one or more of the following bases:</p>
              <div className="space-y-4">
                <div className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="font-bold text-[#00c19c] shrink-0 min-w-[100px]">Contract</div>
                  <div className="text-sm text-slate-500">To provide Services you request as part of our agreement.</div>
                </div>
                <div className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="font-bold text-[#00c19c] shrink-0 min-w-[100px]">Interests</div>
                  <div className="text-sm text-slate-500">Security, service improvement, preventing fraud/abuse, and customer support.</div>
                </div>
                <div className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="font-bold text-[#00c19c] shrink-0 min-w-[100px]">Consent</div>
                  <div className="text-sm text-slate-500">Certain cookies, marketing, and recording/transcription notices where required.</div>
                </div>
                <div className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="font-bold text-[#00c19c] shrink-0 min-w-[100px]">Obligation</div>
                  <div className="text-sm text-slate-500">Compliance with lawful requests and regulatory duties.</div>
                </div>
              </div>
            </section>

            {/* 7. Data Sharing */}
            <section id="sharing" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'sharing' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">7</span>
                Data Sharing and Disclosure
              </h2>
              <p className="mb-8 font-bold text-slate-800 dark:text-slate-200">We do not sell your Personal Data. We may share information in these cases:</p>
              
              <div className="space-y-6">
                <div className="group">
                  <h4 className="font-bold mb-2 flex items-center gap-2 group-hover:text-[#00c19c] transition-colors">A) Service Providers (Processors)</h4>
                  <p className="text-slate-500 text-sm">We use vendors for hosting, monitoring, analytics, communications, customer support tooling, and payment processing. They may process data only to provide services to us and under contractual protections.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold mb-2 flex items-center gap-2 group-hover:text-[#00c19c] transition-colors">B) Telephony, Voice, and Number Providers</h4>
                  <p className="text-slate-500 text-sm">If you connect telephony providers (e.g., SIP trunking / phone number providers), call delivery and call metadata may pass through those providers based on your configuration.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold mb-2 flex items-center gap-2 group-hover:text-[#00c19c] transition-colors">C) Integrations You Enable</h4>
                  <p className="text-slate-500 text-sm">If you connect a CRM or calendar, we will share only the data necessary to perform the integration (e.g., lead fields, appointment data, call summaries).</p>
                </div>
                <div className="group">
                  <h4 className="font-bold mb-2 flex items-center gap-2 group-hover:text-[#00c19c] transition-colors">D) Affiliates / Business Transfers</h4>
                  <p className="text-slate-500 text-sm">If our business structure changes (merger, acquisition, reorganization), information may be transferred as part of that transaction, subject to confidentiality protections.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold mb-2 flex items-center gap-2 group-hover:text-[#00c19c] transition-colors text-rose-500">E) Legal and Safety</h4>
                  <p className="text-slate-500 text-sm">We may disclose information if required to comply with law, enforce our agreements, protect rights/safety, investigate fraud, or respond to lawful requests.</p>
                </div>
              </div>
            </section>

            {/* 8. Storage & Security */}
            <section id="storage" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'storage' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">8</span>
                Data Storage, Security, and Confidentiality
              </h2>
              <p className="mb-6">We use reasonable administrative, technical, and organizational security measures, such as:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#0f1117] rounded-xl border border-slate-200 dark:border-slate-800">
                  <Lock className="w-5 h-5 text-[#00c19c]" />
                  <span className="text-sm font-medium">Encrypted HTTPS/TLS</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#0f1117] rounded-xl border border-slate-200 dark:border-slate-800">
                  <Shield className="w-5 h-5 text-[#00c19c]" />
                  <span className="text-sm font-medium">Access Controls</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#0f1117] rounded-xl border border-slate-200 dark:border-slate-800">
                  <Globe className="w-5 h-5 text-[#00c19c]" />
                  <span className="text-sm font-medium">Role-based permissions</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-[#0f1117] rounded-xl border border-slate-200 dark:border-slate-800">
                  <Eye className="w-5 h-5 text-[#00c19c]" />
                  <span className="text-sm font-medium">Activity Monitoring</span>
                </div>
              </div>
              <p className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400 italic font-medium leading-relaxed">
                No online service can guarantee absolute security. You are responsible for using strong passwords, enabling available security features, and controlling access for your team.
              </p>
            </section>

            {/* 9. Data Retention */}
            <section id="retention" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'retention' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">9</span>
                Data Retention
              </h2>
              <p className="mb-8">We retain data only for as long as necessary to provide the Services, meet legal obligations, resolve disputes, and enforce agreements.</p>
              
              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Account data</span>
                  <span className="text-slate-500 text-sm italic">Active period + limited buffer</span>
                </div>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Call logs / analytics</span>
                  <span className="text-slate-500 text-sm italic">Reporting period</span>
                </div>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Recordings / transcripts</span>
                  <span className="text-slate-500 text-sm italic">Per plan settings</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0f1117] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[#00c19c]" /> Deletion Requests</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Upon verified request, we will delete or anonymize eligible Personal Data within up to 30 days, unless retention is required by law or necessary for legitimate business purposes (e.g., security logs, fraud prevention, legal claims).
                </p>
              </div>
            </section>

            {/* 10. Cookies */}
            <section id="cookies" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'cookies' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">10</span>
                Cookies & Tracking Technologies
              </h2>
              <p className="mb-6">We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-400 mb-8">
                <li>Maintain sessions and logins (necessary cookies)</li>
                <li>Remember preferences</li>
                <li>Understand how the Platform is used (analytics cookies)</li>
                <li>Provide marketing measurement where permitted (marketing cookies)</li>
              </ul>
              <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm font-bold mb-3 uppercase tracking-wider text-slate-400">Manage Cookies Through:</p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm">Browser Settings</span>
                  <span className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 shadow-sm">Preference Tools (if implemented)</span>
                </div>
              </div>
            </section>

            {/* 11. Third-Party Services */}
            <section id="third-party" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'third-party' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">11</span>
                Third-Party Services
              </h2>
              <p className="mb-6">The Services may rely on or integrate with third-party services such as:</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 mb-8">
                <li className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#0f1117] rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                  <Globe className="w-4 h-4 text-[#00c19c]" /> Telephony providers
                </li>
                <li className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#0f1117] rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                  <FileText className="w-4 h-4 text-[#00c19c]" /> CRM/calendar platforms
                </li>
                <li className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#0f1117] rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                  <Shield className="w-4 h-4 text-[#00c19c]" /> Hosting & Monitoring
                </li>
                <li className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#0f1117] rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                  <Scale className="w-4 h-4 text-[#00c19c]" /> Payment processors
                </li>
              </ul>
              <p className="text-sm text-slate-500 italic leading-relaxed">These third parties have their own privacy policies. We recommend reviewing them before enabling integrations.</p>
            </section>

            {/* 12. Call Recording Compliance */}
            <section id="compliance" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'compliance' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-amber-600 dark:text-amber-500">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 text-sm">12</span>
                Call Recording, Transcription, and Compliance
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4 p-5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900 shadow-sm">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-4 text-sm text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                    <p>You (the Customer) are responsible for ensuring lawful notice and consent to End Callers, where required.</p>
                    <p>You are responsible for compliance with local telecom, privacy, and sector-specific regulations.</p>
                    <p className="text-amber-600 font-bold uppercase tracking-tight">We provide tools and configuration controls, but we do not provide legal advice.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 13. AI Training */}
            <section id="ai-training" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'ai-training' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">13</span>
                Data Ownership and AI Training
              </h2>
              <div className="space-y-4 text-slate-600 dark:text-slate-400">
                <p>Customer Data remains owned/controlled by the Customer.</p>
                <div className="p-5 bg-[#00c19c]/5 rounded-2xl border border-[#00c19c]/20">
                  <p className="font-bold text-slate-800 dark:text-white mb-2">Our Commitment:</p>
                  <p className="text-sm">We do not use Customer Data (including recordings, transcripts, CRM fields, and configurations) to train generalized AI models without explicit written permission.</p>
                </div>
              </div>
            </section>

            {/* 14. International Transfers */}
            <section id="transfers" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'transfers' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">14</span>
                International Data Transfers
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Because we may use global infrastructure and service providers, your data may be processed in countries other than your own. Where required, we apply appropriate safeguards (e.g., contractual protections) to support lawful international transfers.
              </p>
            </section>

            {/* 15. Your Rights */}
            <section id="rights" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'rights' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">15</span>
                Your Rights and Choices
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  'Access your Personal Data',
                  'Correct inaccurate information',
                  'Request deletion',
                  'Restrict or object to processing',
                  'Data portability',
                  'Withdraw consent',
                  'Lodge a complaint'
                ].map((right, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#0f1117] rounded-xl border border-slate-200 dark:border-slate-800 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#00c19c]" />
                    {right}
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 dark:bg-[#0f1117] p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-lg font-bold mb-4 flex items-center gap-2"><Mail className="w-5 h-5 text-[#00c19c]" /> How to exercise your rights</h4>
                <p className="text-slate-500 mb-6">Email <code className="text-[#00c19c]">info@duhanashrah.ai</code> with subject: <span className="font-bold">“Privacy Request – GENIE”</span></p>
                <p className="text-xs text-slate-400 italic">We may verify your identity before fulfilling requests.</p>
              </div>
            </section>

            {/* 16. Children's Privacy */}
            <section id="children" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'children' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">16</span>
                Children’s Privacy
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                The Services are not intended for children under 16 (or the minimum age required in your jurisdiction). We do not knowingly collect Personal Data from children.
              </p>
            </section>

            <Separator className="my-16" />

            {/* 17. Acceptable Use */}
            <section id="acceptable-use" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'acceptable-use' ? 'section-highlight' : ''}`}>
              <h2 className="text-3xl font-black mb-8 flex items-center gap-4 text-rose-500">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-500 text-lg">17</span>
                Acceptable Use
              </h2>
              
              <div className="space-y-8">
                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full group-hover:bg-rose-500/10 transition-colors" />
                  <h4 className="font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-3"><Scale className="w-5 h-5 text-rose-500" /> 1. Lawful Use</h4>
                  <ul className="text-sm space-y-3 text-slate-500 list-disc pl-4">
                    <li>No violation of privacy, telecom, or consumer protection laws</li>
                    <li>No recording/transcribing without required notices/consents</li>
                  </ul>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full group-hover:bg-rose-500/10 transition-colors" />
                  <h4 className="font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-rose-500" /> 2. Misuse Prohibition</h4>
                  <ul className="text-sm space-y-3 text-slate-500 list-disc pl-4">
                    <li>No harassment, threats, fraud, or unlawful solicitation</li>
                    <li>No impersonation or misrepresentation of identity</li>
                  </ul>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full group-hover:bg-rose-500/10 transition-colors" />
                  <h4 className="font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-3"><Lock className="w-5 h-5 text-rose-500" /> 3. Data Integrity</h4>
                  <ul className="text-sm space-y-3 text-slate-500 list-disc pl-4">
                    <li>No uploading sensitive data (IDs, bank details) unless authorized</li>
                    <li>No infringement of intellectual property or unlawful materials</li>
                  </ul>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full group-hover:bg-rose-500/10 transition-colors" />
                  <h4 className="font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-3"><Shield className="w-5 h-5 text-rose-500" /> 4. Security Integrity</h4>
                  <ul className="text-sm space-y-3 text-slate-500 list-disc pl-4">
                    <li>No unauthorized access attempts or vulnerability testing</li>
                    <li>No malware, spam, or automated abuse</li>
                  </ul>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full group-hover:bg-rose-500/10 transition-colors" />
                  <h4 className="font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-3"><Globe className="w-5 h-5 text-rose-500" /> 5. Telephony Abuse</h4>
                  <ul className="text-sm space-y-3 text-slate-500 list-disc pl-4">
                    <li>No spam calls, robocalls, or non-compliant outreach</li>
                    <li>No bypassing rate limits or usage controls</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 p-6 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900">
                <p className="text-sm text-rose-700 dark:text-rose-400 font-bold leading-relaxed">
                  We may suspend or terminate access if we reasonably believe your use violates these Acceptable Use rules or creates risk to the Platform, Users, End Callers, or third parties.
                </p>
              </div>
            </section>

            {/* 18. Account Responsibility */}
            <section id="responsibility" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'responsibility' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">18</span>
                Account Responsibility
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-[#00c19c]" /> 1. Access Control</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Keep passwords secure, restrict access to authorized personnel, and remove access for former staff promptly.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-[#00c19c]" /> 2. User Permissions</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Assign appropriate roles and regularly review access to recordings, transcripts, and integrations.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00c19c]" /> 3. Call Compliance</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Ensure required notices for recording/transcription and validate that workflows comply with local laws.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2"><Globe className="w-4 h-4 text-[#00c19c]" /> 4. Data Accuracy</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Ensure uploaded data (caller lists, KB content) is accurate and lawfully collected with necessary permissions.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#00c19c]" /> 5. Configuration</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Validate routing rules to prevent misdirection and test all monitoring/schedules before going live.</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold flex items-center gap-2"><Mail className="w-4 h-4 text-[#00c19c]" /> 6. Incident Reporting</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Notify us promptly at <code className="text-[#00c19c]">info@duhanashrah.ai</code> if you suspect unauthorized access or a security incident.</p>
                </div>
              </div>
            </section>

            {/* 19. Policy Updates */}
            <section id="updates" className={`mb-16 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'updates' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">19</span>
                Policy Updates
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">We may update this Privacy Policy from time to time. If changes are material, we will provide notice via the Platform and/or email.</p>
              <div className="p-5 bg-slate-50 dark:bg-[#0f1117] rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Latest versions posted at:</p>
                <div className="space-y-2 text-sm text-[#00c19c] font-medium">
                  <p>genie.duhanashrah.ai/privacy-policy</p>
                  <p>duhanashrah.ai/privacy-policy</p>
                </div>
              </div>
            </section>

            {/* 20. Contact Information */}
            <section id="contact" className={`mb-8 scroll-mt-28 transition-all duration-500 ${highlightedSection === 'contact' ? 'section-highlight' : ''}`}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-[#00c19c]">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00c19c]/10 text-[#00c19c] text-sm">20</span>
                Contact Information
              </h2>
              <div className="bg-slate-900 dark:bg-[#1d212b] p-10 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#00c19c]/10 rounded-bl-full -mr-20 -mt-20" />
                <h3 className="text-2xl font-black mb-8 relative z-10">Duha Nashrah.AI (DNAI)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
                  <div className="space-y-4">
                    <p className="flex items-center gap-3 text-slate-300">
                      <Shield className="w-5 h-5 text-[#00c19c]" />
                      Operated by Niku Solutions PTE LTD (Singapore)
                    </p>
                    <p className="flex items-center gap-3 text-slate-300">
                      <Mail className="w-5 h-5 text-[#00c19c]" />
                      info@duhanashrah.ai
                    </p>
                  </div>
                  <div className="space-y-4">
                    <p className="flex items-center gap-3 text-slate-300">
                      <Globe className="w-5 h-5 text-[#00c19c]" />
                      duhanashrah.ai
                    </p>
                    <p className="flex items-center gap-3 text-slate-300">
                      <Globe className="w-5 h-5 text-[#00c19c]" />
                      genie.duhanashrah.ai
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-[#0f1117] py-12 mt-12 border-t border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 text-center max-w-[1440px]">
          <p className="text-sm text-slate-500 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Niku Solutions PTE LTD. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
