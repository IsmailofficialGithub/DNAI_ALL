import React, { useState, useEffect } from 'react';
import { Coins, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCreditBalance, CreditBalance } from '../../services/creditService';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const CreditDisplay: React.FC = () => {
  const { user } = useAuth();
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCredits = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const balance = await getCreditBalance(user.id);
        setCreditBalance(balance);
      } catch (error) {
        console.error('Error loading credits:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCredits();
    
    // Refresh credits every 30 seconds
    const interval = setInterval(loadCredits, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading || !creditBalance) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading credits...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLow = creditBalance.balance <= creditBalance.low_credit_threshold;
  const isPaused = creditBalance.services_paused;

  return (
    <Card className={cn(
      "mb-6 border-2 transition-all",
      isPaused && "border-destructive",
      isLow && !isPaused && "border-warning",
      !isLow && !isPaused && "border-primary/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl transition-all",
              isPaused && "bg-destructive/20",
              isLow && !isPaused && "bg-warning/20",
              !isLow && !isPaused && "bg-primary/20"
            )}>
              <Coins className={cn(
                "w-6 h-6 transition-colors",
                isPaused && "text-destructive",
                isLow && !isPaused && "text-warning",
                !isLow && !isPaused && "text-primary"
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-muted-foreground">Available Credits</span>
                {isPaused && (
                  <Badge variant="destructive" className="text-xs">
                    Services Paused
                  </Badge>
                )}
                {isLow && !isPaused && (
                  <Badge variant="outline" className="text-xs border-warning text-warning">
                    Low Balance
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-3xl font-bold transition-colors",
                  isPaused && "text-destructive",
                  isLow && !isPaused && "text-warning",
                  !isLow && !isPaused && "text-primary"
                )}>
                  {creditBalance.balance.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">credits</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <div className="text-muted-foreground">Total Purchased</div>
              <div className="font-semibold text-foreground">{creditBalance.total_purchased.toFixed(2)}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-right">
              <div className="text-muted-foreground">Total Used</div>
              <div className="font-semibold text-foreground">{creditBalance.total_used.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {(isLow || isPaused) && (
          <div className={cn(
            "mt-4 p-3 rounded-lg flex items-start gap-2",
            isPaused && "bg-destructive/10 border border-destructive/20",
            isLow && !isPaused && "bg-warning/10 border border-warning/20"
          )}>
            <AlertCircle className={cn(
              "w-5 h-5 mt-0.5 flex-shrink-0",
              isPaused && "text-destructive",
              isLow && !isPaused && "text-warning"
            )} />
            <div className="flex-1">
              {isPaused ? (
                <p className="text-sm font-medium text-destructive">
                  Your services are paused due to insufficient credits. Please purchase credits to continue.
                </p>
              ) : (
                <p className="text-sm font-medium text-warning">
                  Your credit balance is low ({creditBalance.balance.toFixed(2)} credits). 
                  Consider purchasing more credits to avoid service interruption.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditDisplay;
