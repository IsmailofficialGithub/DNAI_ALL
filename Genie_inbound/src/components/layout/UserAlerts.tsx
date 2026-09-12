import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCreditBalance, getDynamicCreditRates } from '@/services/creditService';
import { Link, useNavigate } from 'react-router-dom';
import { X, AlertCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const UserAlerts: React.FC = () => {
  const { user, hasLifetimeAccess } = useAuth();
  const navigate = useNavigate();
  
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [showTrialWarning, setShowTrialWarning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Local state to hide until next login/refresh
  const [hideCreditBanner, setHideCreditBanner] = useState(false);
  const [hideTrialBanner, setHideTrialBanner] = useState(false);
  const [hideCreditModal, setHideCreditModal] = useState(false);
  const [hideTrialModal, setHideTrialModal] = useState(false);

  const checkAlerts = async () => {
    if (!user) return;
    try {
      // 1. Check Credits
      const balance = await getCreditBalance(user.id);
      const rates = await getDynamicCreditRates();

      if (balance && rates) {
        if (balance.balance < rates.agent_creation) {
          setShowCreditWarning(true);
        }
      }

      // 2. Check Trial
      if (!hasLifetimeAccess) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('trial_expiry, account_status')
          .eq('user_id', user.id)
          .single();

        if (profile && profile.account_status === 'active' && profile.trial_expiry) {
          const now = new Date();
          const trialExpiryDate = new Date(profile.trial_expiry);
          const diffMs = trialExpiryDate.getTime() - now.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          // If trial has 1 day or less left (and not yet fully expired)
          if (diffDays > 0 && diffDays <= 1) {
            setShowTrialWarning(true);
          }
        }
      }
    } catch (error) {
      console.error("Error checking user alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 60 * 60 * 1000); // Re-check every hour
    return () => clearInterval(interval);
  }, [user, hasLifetimeAccess]);

  if (!user || loading) return null;

  return (
    <>
      {/* --- BANNERS --- */}
      {showCreditWarning && !hideCreditBanner && (
        <div className="bg-destructive/10 border-b border-destructive/20 py-2 px-4 shadow-sm animate-in fade-in slide-in-from-top duration-500">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-destructive text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
              Low Credit Balance: Your balance is too low to create a new voice agent.
            </div>
            <div className="flex items-center gap-4">
              <Link to="/billing" className="hover:underline flex items-center gap-1">
                Buy Credits
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
              </Link>
              <button onClick={() => { setHideCreditBanner(true); setHideCreditModal(true); }} className="hover:text-destructive/80 transition-colors" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrialWarning && !hideTrialBanner && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 py-2 px-4 shadow-sm animate-in fade-in slide-in-from-top duration-500">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-orange-600 dark:text-orange-400 text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              Trial Expiring Soon: Your trial ends in less than 24 hours. Upgrade to keep access.
            </div>
            <div className="flex items-center gap-4">
              <Link to="/billing" className="hover:underline flex items-center gap-1">
                Upgrade Plan
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
              </Link>
              <button onClick={() => { setHideTrialBanner(true); setHideTrialModal(true); }} className="hover:text-orange-600/80 transition-colors" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS (POPUPS) --- */}
      {/* Credit Warning Modal */}
      <Dialog open={showCreditWarning && !hideCreditModal} onOpenChange={(open) => !open && setHideCreditModal(true)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Low Credit Balance
            </DialogTitle>
            <DialogDescription>
              Your current credit balance is too low to create a new voice agent. 
              Please purchase more credits to continue using our services without interruption.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHideCreditModal(true)}>
              Remind Me Later
            </Button>
            <Button onClick={() => { setHideCreditModal(true); navigate('/billing'); }}>
              Buy Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trial Ending Modal */}
      <Dialog open={showTrialWarning && !hideTrialModal} onOpenChange={(open) => !open && setHideTrialModal(true)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <Clock className="w-5 h-5 text-orange-500" />
              Trial Expiring Soon
            </DialogTitle>
            <DialogDescription>
              Your trial period ends in less than 24 hours. Upgrade to a paid plan now to keep your agents active and avoid service disruption.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHideTrialModal(true)}>
              Remind Me Later
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => { setHideTrialModal(true); navigate('/billing'); }}>
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserAlerts;
