import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

import { AlertCircle } from "lucide-react";



const LinkExpired = () => {

  const navigate = useNavigate();



  return (

    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background image */}

      <div 

        className="absolute inset-0 bg-cover bg-center bg-no-repeat"

        style={{

          backgroundImage: 'url(/authbg.png)',

        }}

      />



      {/* Overlay for both dark and light modes - ensures readability */}

      <div className="absolute inset-0 bg-background/60 dark:bg-background/40" />



      <div className="w-full max-w-md glass-card rounded-3xl p-8 shadow-[var(--shadow-glow)] relative z-10">

        <div className="space-y-6 text-center">

          <div className="flex justify-center">

            <div className="p-4 rounded-full bg-destructive/10">

              <AlertCircle className="h-12 w-12 text-destructive" />

            </div>

          </div>



          <div className="space-y-2">

            <h1 className="text-3xl font-bold text-foreground">Link Expired</h1>

            <p className="text-sm text-muted-foreground">

              The password reset link is invalid or has expired. Please request a new password reset link.

            </p>

          </div>



          <div className="pt-4">

            <Button

              onClick={() => navigate("/auth")}

              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all hover:scale-105"

            >

              Go to Sign In

            </Button>

          </div>

        </div>

      </div>

    </div>

  );

};



export default LinkExpired;







