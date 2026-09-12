import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from './ui/button';
import { useThemeMode } from '../contexts/ThemeContext';
import logoImage from '../assest/LOGO LIGHT MODE.png';
import topLines from "../assest/toplines.svg";
import characterImage from "../assest/new-password.png";

const Success: React.FC = () => {
  const navigate = useNavigate();
  const { setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] relative overflow-hidden flex flex-col items-center justify-center p-6">
       <div className="absolute top-0 right-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <img
          src={topLines}
          alt="Background Lines"
          className="absolute -top-10 -right-10 w-[800px] h-auto opacity-100 select-none"
        />
      </div>

      {/* Top Logo */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20">
        <img
          src={logoImage}
          alt="DNAi Logo"
          className="h-20 w-auto object-contain"
        />
      </div>

      {/* Center Content Card */}
      <div className="z-10 bg-transparent flex flex-col items-center max-w-lg text-center animate-scale-in">
        {/* Success Icon */}
        <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center mb-8 ring-1 ring-primary/25 animate-success-icon-pop">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/35">
            <Check className="w-8 h-8 text-white stroke-[3px]" />
          </div>
        </div>

        {/* Text Group */}
        <div className="space-y-3 mb-12">
          <h1 className="text-4xl font-extrabold text-[#2a3c4a]">
            Password Changed!
          </h1>
          <p className="text-lg text-[#2a3c4a] leading-relaxed max-w-sm mx-auto">
            Your password has been changed successfully.
          </p>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate('/')}
          className="bg-primary hover:bg-primary/90 text-white px-10 py-7 rounded-[24px] text-lg font-bold shadow-lg shadow-[#128a6d]/20 transition-all hover:-translate-y-1 active:scale-95 border-none"
        >
          Go to Dashboard
        </Button>
      </div>

      {/* Mascot Image (Bottom Left) */}
      <div className="absolute bottom-[-10px] left-[-10px] pointer-events-none z-20 hidden lg:block">
        <img
          src={characterImage}
          alt="Mascot"
          className="w-[480px] h-auto drop-shadow-2xl"
        />
      </div>
    </div>
  );
};

export default Success;
