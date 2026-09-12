import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  const isTerms = type === 'terms';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {isTerms ? 'Terms of Service' : 'Privacy Policy'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Please read our {isTerms ? 'terms of service' : 'privacy policy'} carefully.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 text-sm leading-relaxed">
          {isTerms ? (
            <div className="space-y-6">
              <div>
                <p><strong>Effective Date:</strong> [DD Month YYYY]</p>
                <p><strong>Last Updated:</strong> [DD Month YYYY]</p>
                <p className="mt-2">
                  These Terms & Conditions (“Terms”) govern your access to and use of the GENIE Inbound Calling Agent dashboard and related services provided by Duha Nashrah.AI (DNAI) (“DNAI,” “we,” “us,” “our”). The Platform is accessible at genie.duhanashrah.ai and may be referenced from duhanashrah.ai (together, the “Services”).
                </p>
                <p><strong>Operator / Legal Entity:</strong> Niku Solutions PTE LTD, Singapore (“Company”).</p>
                <p className="mt-2">By creating an account, accessing, or using the Services, you agree to these Terms. If you do not agree, do not use the Services.</p>
              </div>

              <section>
                <h3 className="text-lg font-semibold mb-2">1) Definitions</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>“Customer”:</strong> the organization subscribing to or using the Services.</li>
                  <li><strong>“User”:</strong> any person who uses the Services, including Customer employees/contractors.</li>
                  <li><strong>“End Caller”:</strong> any person who calls a phone number connected to the Services.</li>
                  <li><strong>“Customer Data”:</strong> data submitted to, stored in, or generated through the Services under a Customer account (e.g., call logs, recordings, transcripts, leads, agent scripts, configurations).</li>
                  <li><strong>“Third-Party Services”:</strong> external products/services integrated with the Services (e.g., telephony providers, CRMs, calendars).</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">2) Eligibility & Account Responsibilities</h3>
                <h4 className="font-semibold mt-2">2.1 Eligibility</h4>
                <p>You must be at least 18 years old (or the age of majority in your jurisdiction) and able to form a legally binding contract to use the Services. If you use the Services on behalf of an organization, you represent that you have authority to bind that organization to these Terms.</p>
                <h4 className="font-semibold mt-4">2.2 Account Registration</h4>
                <p>You agree to provide accurate, complete information and keep it updated. We may suspend or terminate accounts that contain false or misleading information.</p>
                <h4 className="font-semibold mt-4">2.3 Security & Access Control</h4>
                <p>You are responsible for:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>keeping login credentials confidential,</li>
                  <li>restricting access to authorized Users only,</li>
                  <li>promptly revoking access for former staff/contractors,</li>
                  <li>notifying us of suspected unauthorized access at support@duhanashrah.ai.</li>
                </ul>
                <p className="mt-2">You are responsible for all activity under your account unless caused by our breach of these Terms.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">3) Acceptable Use & Prohibited Use</h3>
                <p>You agree to use the Services lawfully and responsibly.</p>
                <h4 className="font-semibold mt-2">3.1 Acceptable Use</h4>
                <p>You may use the Services to configure and operate inbound calling workflows, such as answering calls, routing/escalation, appointment handling, lead qualification, and reporting—consistent with these Terms and applicable laws.</p>
                <h4 className="font-semibold mt-4">3.2 Prohibited Use</h4>
                <p>You must not (and must not allow others to):</p>
                <ul className="list-disc pl-5 space-y-3 mt-2">
                  <li><strong>Violate laws or rights:</strong> break privacy, telecom, consumer protection, or other laws; infringe intellectual property or privacy rights; record or transcribe calls without required notice/consent.</li>
                  <li><strong>Misuse telephony features:</strong> spam, illegal robocalling, harassment, deceptive practices, or unlawful solicitation; bypass call restrictions, usage limits, or provider rules.</li>
                  <li><strong>Upload or process prohibited data:</strong> store highly sensitive data (e.g., bank credentials, government IDs, medical records) unless explicitly required and agreed in writing; upload malware, harmful code, or unlawful content.</li>
                  <li><strong>Compromise security:</strong> attempt unauthorized access to systems, recordings, transcripts, or accounts; reverse engineer, probe, scan, or exploit vulnerabilities without written permission.</li>
                  <li><strong>Interfere with service operations:</strong> disrupt, overload, or degrade platform performance; attempt to circumvent technical protections.</li>
                </ul>
                <p className="mt-2">We may suspend or terminate your access if we reasonably believe your use violates these rules or creates risk.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">4) Service Description, Availability & Limitations</h3>
                <h4 className="font-semibold mt-2">4.1 Service Nature</h4>
                <p>GENIE is a software platform that supports inbound call handling and related automation. Outputs such as call summaries, transcripts, classifications, or recommendations may be generated automatically and may not be error-free.</p>
                <h4 className="font-semibold mt-4">4.2 No Guarantee of Outcomes</h4>
                <p>We do not guarantee specific results (e.g., bookings, qualification rate, revenue). Performance depends on configuration, call flows, training data/knowledge bases, network conditions, and third-party services.</p>
                <h4 className="font-semibold mt-4">4.3 Availability</h4>
                <p>We aim to keep the Services available, but the Services may be interrupted due to: maintenance, upgrades, or emergency changes; outages or issues with Third-Party Services (telephony, hosting, integrations); network conditions and carrier routing.</p>
                <h4 className="font-semibold mt-4">4.4 Usage Limits</h4>
                <p>Your plan may include usage limits (e.g., call minutes, credits, seats, storage). If limits are reached, functionality may be restricted or paused until usage resets or additional capacity is purchased.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">5) Compliance: Call Recording, Consent & Legal Obligations</h3>
                <p>If you enable call recording and/or transcription, you (Customer) are responsible for:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>providing legally required notices and obtaining consent where required,</li>
                  <li>complying with telecom and privacy regulations,</li>
                  <li>configuring disclosures/prompts as needed for your jurisdiction and industry.</li>
                </ul>
                <p className="mt-2">We provide tools and configuration options, but we do not provide legal advice.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">6) Intellectual Property Rights</h3>
                <h4 className="font-semibold mt-2">6.1 Ownership of Services</h4>
                <p>The Services, including software, UI, design, templates, workflows, documentation, and branding, are owned by us (or our licensors) and protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable, revocable license to use the Services during your subscription term, solely for your internal business operations.</p>
                <h4 className="font-semibold mt-4">6.2 Customer Intellectual Property</h4>
                <p>You retain ownership of Customer Data and your pre-existing intellectual property (e.g., scripts, prompts, brand assets, knowledge base content you provide).</p>
                <h4 className="font-semibold mt-4">6.3 Feedback</h4>
                <p>If you provide feedback or suggestions, you grant us the right to use them without restriction or compensation, provided we do not disclose your confidential Customer Data.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">7) User-Generated Content (Customer Data) & Responsibilities</h3>
                <p>You are responsible for all Customer Data you submit or configure, including: ensuring you have rights/permissions to use it, ensuring it is accurate and lawful, and ensuring it does not violate third-party rights. We may remove or restrict content that violates these Terms or applicable law.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">8) Third-Party Integrations & Services</h3>
                <h4 className="font-semibold mt-2">8.1 Integrations</h4>
                <p>The Services may integrate with Third-Party Services (e.g., telephony providers, CRMs, calendars). You are responsible for: maintaining your third-party accounts, accepting and complying with third-party terms, and configuring integrations correctly.</p>
                <h4 className="font-semibold mt-4">8.2 Third-Party Responsibility</h4>
                <p>We are not responsible for Third-Party Services, including their downtime, data handling, pricing changes, or service performance. Your use of Third-Party Services is at your own risk and subject to their terms/policies.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">9) Payments, Subscriptions & Refunds</h3>
                <h4 className="font-semibold mt-2">9.1 Subscription Plans</h4>
                <p>If you subscribe to a paid plan, you agree to pay all applicable fees per the plan details shown on genie.duhanashrah.ai or in your Service Agreement/order form.</p>
                <h4 className="font-semibold mt-4">9.2 Billing</h4>
                <p>Fees may be billed monthly/annually or as otherwise specified. Taxes may apply and are your responsibility unless stated otherwise. We may use third-party payment processors.</p>
                <h4 className="font-semibold mt-4">9.3 Usage-Based Charges</h4>
                <p>Some features may incur additional charges (e.g., call minutes, telephony provider costs, message fees, add-ons). These may be billed separately or via third parties based on your configuration.</p>
                <h4 className="font-semibold mt-4">9.4 Renewals</h4>
                <p>Subscriptions may renew automatically unless cancelled before the renewal date.</p>
                <h4 className="font-semibold mt-4">9.5 Refunds</h4>
                <p>Refunds are handled according to your plan terms and/or Service Agreement. If not specified, fees are generally non-refundable once the billing cycle begins.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">10) Confidentiality</h3>
                <p>If you access non-public information about DNAI or the Services, you must keep it confidential and use it only to operate the Services. We will treat Customer Data as confidential and use it to provide the Services, subject to our Privacy Policy and any applicable agreements.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">11) Privacy & Data Protection</h3>
                <p>Our Privacy Policy explains how we collect and use Personal Data. If you are a business Customer, you may be required to sign additional data processing terms if applicable to your jurisdiction and use case.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">12) Suspension & Termination</h3>
                <h4 className="font-semibold mt-2">12.1 Termination by You</h4>
                <p>You may stop using the Services at any time. If you have a paid subscription, cancellation and end-of-term access are governed by your plan or order form.</p>
                <h4 className="font-semibold mt-4">12.2 Termination or Suspension by Us</h4>
                <p>We may suspend or terminate access immediately if you violate these Terms or applicable laws, your use creates security/legal/reputational risk, required payments are overdue, or we are required to do so by law. Where reasonable, we may provide notice and an opportunity to cure.</p>
                <h4 className="font-semibold mt-4">12.3 Effect of Termination</h4>
                <p>Upon termination, your license to use the Services ends, access may be disabled, and data retention/deletion will follow our Privacy Policy and any applicable agreement.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">13) Disclaimers</h3>
                <p className="uppercase font-semibold">The Services are provided "AS IS" and "AS AVAILABLE." To the maximum extent permitted by law, we disclaim all warranties, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
                <p className="mt-2">We do not warrant that the Services will be uninterrupted or error-free, or that AI outputs will be accurate, complete, or suitable for every business scenario. You are responsible for reviewing outcomes and configuring safeguards appropriate for your business.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">14) Limitation of Liability</h3>
                <p>To the maximum extent permitted by law: We will not be liable for indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, business, goodwill, or data. We are providing a platform for the services and we are not liable for any business loss.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">15) Indemnification</h3>
                <p>You agree to indemnify and hold harmless DNAI and the Company (including officers, employees, and partners) from claims, damages, liabilities, and expenses arising from your use of the Services in violation of these Terms, your Customer Data (including unlawful recordings/transcriptions or lack of consent), your breach of laws or third-party rights, or your integrations and third-party configurations.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">16) Governing Law & Dispute Resolution</h3>
                <p><strong>Governing Law:</strong> Singapore</p>
                <p><strong>Courts/Jurisdiction:</strong> [Insert court jurisdiction consistent with the governing law].</p>
                <p className="mt-2">Before filing a claim, both parties agree to attempt to resolve disputes in good faith by contacting: disputes@duhanashrah.ai.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">17) Updates to These Terms</h3>
                <p>We may update these Terms from time to time. If changes are material, we will notify you via the Platform and/or email. Continued use after the effective date of the updated Terms constitutes acceptance.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">18) Common SaaS Clauses</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>18.1 Force Majeure:</strong> We are not responsible for failure or delay caused by events beyond our reasonable control (e.g., internet outages, carrier failures, natural disasters, government actions).</li>
                  <li><strong>18.2 Assignment:</strong> You may not assign these Terms without our written consent. We may assign these Terms as part of a merger, acquisition, or business transfer.</li>
                  <li><strong>18.3 Severability:</strong> If any part of these Terms is found unenforceable, the remaining sections remain in effect.</li>
                  <li><strong>18.4 No Waiver:</strong> Failure to enforce a provision is not a waiver of the right to enforce it later.</li>
                  <li><strong>18.5 Entire Agreement:</strong> These Terms, together with the Privacy Policy and any order form/Service Agreement, constitute the entire agreement regarding the Services.</li>
                  <li><strong>18.6 Contact:</strong> For questions about these Terms: info@duhanashrah.ai. For sales inquiries: sales@duhanashrah.ai.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">19) Notices</h3>
                <p>We may send notices to the email associated with your account or through the Platform. You are responsible for maintaining current contact details.</p>
              </section>
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-lg font-semibold mb-2">1. Data Collection</h3>
                <p>We collect information you provide directly to us when you create an account, such as your name, email address, and phone number.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-2">2. Use of Data</h3>
                <p>We use the information we collect to provide, maintain, and improve our services, and to communicate with you about updates and security alerts.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-2">3. Data Sharing</h3>
                <p>We do not share your personal information with companies, organizations, or individuals outside of our service except with your consent or for legal reasons.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-2">4. Data Security</h3>
                <p>We work hard to protect you and our service from unauthorized access, alteration, disclosure, or destruction of information we hold.</p>
              </section>
            </>
          )}
          <p className="text-xs text-muted-foreground mt-8">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LegalModal;
