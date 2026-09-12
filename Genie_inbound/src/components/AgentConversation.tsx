import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, Mic, PhoneOff } from 'lucide-react';
import { createPortal } from 'react-dom';
import Vapi from '@vapi-ai/web';

interface AgentConversationProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
  conversationLink: string | null; // Contains assistant ID or URL with assistantId param
}

const AgentConversation: React.FC<AgentConversationProps> = ({
  open,
  onClose,
  agentName,
  conversationLink,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const vapiRef = useRef<Vapi | null>(null);
  const callActiveRef = useRef(false);

  // Extract assistantId and apiKey from conversationLink
  const getConfig = useCallback(() => {
    if (!conversationLink) return null;

    let assistantId = conversationLink;
    let apiKey = process.env.REACT_APP_VAPI_PUBLIC_KEY || '88848d0b-ec4f-4a5c-bda1-0f021f6e87bb';

    // If it's a URL, extract the assistant ID and shareKey from query parameters
    if (conversationLink.includes('http') || conversationLink.includes('?')) {
      try {
        const url = new URL(conversationLink);
        const extractedId = url.searchParams.get('assistantId');
        const shareKey = url.searchParams.get('shareKey');

        if (extractedId) {
          assistantId = extractedId;
        } else {
          // If no assistantId param, look for UUID pattern in the URL string
          const uuidMatch = conversationLink.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
          if (uuidMatch) {
            // Usually the assistantId is the last or only UUID in the share link (if shareKey is also a UUID)
            // If there's only one, use it. If two, and we found shareKey, take the other one.
            if (uuidMatch.length === 1) {
              assistantId = uuidMatch[0];
            } else if (uuidMatch.length >= 2) {
              // If we have multiple UUIDs (e.g. shareKey and assistantId)
              // We try to find the one that ISN'T the shareKey
              const foundAssistantId = uuidMatch.find(id => id !== shareKey);
              if (foundAssistantId) {
                assistantId = foundAssistantId;
              } else {
                // Last one is often the assistantId in some Vapi share URL formats
                assistantId = uuidMatch[uuidMatch.length - 1];
              }
            }
          }
        }

        if (shareKey) {
          apiKey = shareKey;
        }
      } catch (e) {
        // Fallback: try to extract ID manually
        const match = conversationLink.match(/assistantId=([^&]+)/);
        if (match && match[1]) {
          assistantId = match[1];
        } else {
          const uuidMatch = conversationLink.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
          if (uuidMatch) {
            assistantId = uuidMatch[uuidMatch.length - 1];
          }
        }

        const shareKeyMatch = conversationLink.match(/shareKey=([^&]+)/);
        if (shareKeyMatch && shareKeyMatch[1]) {
          apiKey = shareKeyMatch[1];
        }
      }
    }

    if (!assistantId || !apiKey) return null;

    // Final check: if assistantId is still a full URL, it failed to extract
    if (assistantId.includes('http') || assistantId.includes('vapi.ai')) {
      return null;
    }

    return { assistantId, apiKey };
  }, [conversationLink]);

  // Request microphone permissions when dialog opens
  useEffect(() => {
    if (!open) return;

    const requestMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermissionGranted(true);
        // Stop the stream immediately — we just needed permission
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Microphone permission denied:', err);
        setMicPermissionGranted(false);
        setErrorMessage('Microphone access is required. Please allow microphone permissions and try again.');
        setConnectionStatus('error');
        setIsLoading(false);
      }
    };

    requestMic();
  }, [open]);

  // Initialize Vapi instance once mic is granted
  useEffect(() => {
    if (!open || !micPermissionGranted) return;

    const config = getConfig();
    if (!config) {
      setErrorMessage('Conversation link is missing or invalid.');
      setConnectionStatus('error');
      setIsLoading(false);
      return;
    }

    // Create Vapi instance
    const vapi = new Vapi(config.apiKey);
    vapiRef.current = vapi;

    // Attach event listeners
    vapi.on('call-start', () => {
      console.log('Vapi: call-start');
      setConnectionStatus('connected');
      setIsLoading(false);
      callActiveRef.current = true;
    });

    vapi.on('call-end', () => {
      console.log('Vapi: call-end');
      setConnectionStatus('idle');
      setIsLoading(false);
      callActiveRef.current = false;
    });

    vapi.on('error', (err: any) => {
      console.error('Vapi error:', err);
      setConnectionStatus('error');
      setIsLoading(false);
      setErrorMessage('An error occurred during the call. Please try again.');
      callActiveRef.current = false;
    });

    vapi.on('speech-start', () => {
      console.log('Vapi: speech-start (agent speaking)');
    });

    vapi.on('speech-end', () => {
      console.log('Vapi: speech-end');
    });

    setIsLoading(false);
    setConnectionStatus('idle');

    // Cleanup on unmount / close
    return () => {
      if (callActiveRef.current) {
        try {
          vapi.stop();
        } catch (e) {
          console.error('Error stopping Vapi on cleanup:', e);
        }
      }
      callActiveRef.current = false;
      vapiRef.current = null;
    };
  }, [open, micPermissionGranted, getConfig]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (open) return;

    // Stop any running call
    if (vapiRef.current && callActiveRef.current) {
      try {
        vapiRef.current.stop();
        console.log('Vapi stopped on dialog close');
      } catch (e) {
        console.error('Error stopping Vapi on close:', e);
      }
    }

    // Reset state
    callActiveRef.current = false;
    setConnectionStatus('idle');
    setIsLoading(true);
    setMicPermissionGranted(false);
    setErrorMessage(null);
  }, [open]);

  // Start or stop the call
  const handleMicClick = useCallback(async () => {
    if (!vapiRef.current) return;

    const config = getConfig();
    if (!config) return;

    if (connectionStatus === 'idle' || connectionStatus === 'error') {
      // Start call
      try {
        setConnectionStatus('connecting');
        setIsLoading(true);
        setErrorMessage(null);
        console.log('Starting Vapi call with assistant:', config.assistantId);
        await vapiRef.current.start(config.assistantId);
        // Status will be updated by the 'call-start' event
      } catch (err: any) {
        console.error('Failed to start call:', err);
        setConnectionStatus('error');
        setIsLoading(false);
        setErrorMessage(err?.message || 'Failed to start the call. Please try again.');
        callActiveRef.current = false;
      }
    } else if (connectionStatus === 'connected') {
      // Stop call
      try {
        vapiRef.current.stop();
        // Status will be updated by the 'call-end' event
      } catch (err) {
        console.error('Failed to stop call:', err);
        setConnectionStatus('idle');
        callActiveRef.current = false;
      }
    }
    // If connecting, do nothing (wait)
  }, [connectionStatus, getConfig]);

  const handleClose = useCallback(() => {
    // Stop the call first
    if (vapiRef.current && callActiveRef.current) {
      try {
        vapiRef.current.stop();
        console.log('Vapi stopped on close');
      } catch (e) {
        console.error('Error stopping Vapi:', e);
      }
    }

    callActiveRef.current = false;
    setConnectionStatus('idle');
    setIsLoading(false);

    onClose();
  }, [onClose]);

  if (!open) {
    return null;
  }

  // No conversation link
  if (!conversationLink) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#00c19c]/20 flex items-center justify-center mb-4">
            <X className="w-10 h-10 text-[#00c19c]" />
          </div>
          <h3 className="text-[24px] font-bold text-white mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Conversation Link Not Available
          </h3>
          <p className="text-[16px] text-white/70 mb-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
            The conversation link for this agent is not available yet. Please try again later.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-[#00c19c] hover:bg-[#00c19c]/90 text-white rounded-lg font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Blurred Background Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Interactive Microphone Widget - Centered */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute -top-16 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-20"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Loading State - Only show during initial SDK load */}
        {isLoading && connectionStatus === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center -z-10">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-[#00c19c]/30 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-[#00c19c] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Volume2 className="w-8 h-8 text-[#00c19c] animate-pulse" />
                </div>
              </div>
              <p className="text-[16px] font-medium text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Initializing...
              </p>
            </div>
          </div>
        )}

        {/* Interactive Microphone Widget */}
        <button
          onClick={handleMicClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          disabled={connectionStatus === 'connecting'}
          className={`
            relative w-32 h-32 md:w-40 md:h-40 rounded-full
            flex items-center justify-center
            transition-all duration-300 ease-in-out
            transform hover:scale-110 active:scale-95
            focus:outline-none focus:ring-4 focus:ring-[#00c19c]/50
            ${connectionStatus === 'connected'
              ? 'bg-[#00c19c] shadow-[0_0_40px_rgba(0,193,156,0.6)]'
              : connectionStatus === 'connecting'
                ? 'bg-[#f59e0b] shadow-[0_0_40px_rgba(245,158,11,0.6)] animate-pulse'
                : connectionStatus === 'error'
                  ? 'bg-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                  : isHovering
                    ? 'bg-[#00c19c]/80 shadow-[0_0_30px_rgba(0,193,156,0.4)]'
                    : 'bg-[#00c19c]/60 shadow-[0_0_20px_rgba(0,193,156,0.3)]'
            }
            ${connectionStatus === 'connecting' ? 'cursor-wait' : 'cursor-pointer'}
          `}
        >
          {/* Pulsing rings when connected */}
          {connectionStatus === 'connected' && (
            <>
              <div className="absolute inset-0 rounded-full bg-[#00c19c] animate-ping opacity-75" />
              <div className="absolute inset-0 rounded-full bg-[#00c19c] animate-ping opacity-50" style={{ animationDelay: '0.5s' }} />
            </>
          )}

          {/* Icon */}
          <div className="relative z-10">
            {connectionStatus === 'connected' ? (
              isHovering ? (
                <PhoneOff className="w-12 h-12 md:w-16 md:h-16 text-white" />
              ) : (
                <Volume2 className="w-12 h-12 md:w-16 md:h-16 text-white animate-pulse" />
              )
            ) : connectionStatus === 'connecting' ? (
              <div className="relative w-12 h-12 md:w-16 md:h-16">
                <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin" />
                <Mic className="w-8 h-8 md:w-12 md:h-12 text-white absolute inset-0 m-auto" />
              </div>
            ) : (
              <Mic className="w-12 h-12 md:w-16 md:h-16 text-white" />
            )}
          </div>
        </button>

        {/* Status Text */}
        <div className="mt-6 text-center">
          <p className="text-white text-lg md:text-xl font-semibold mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {connectionStatus === 'connected'
              ? 'Connected - Speak Now'
              : connectionStatus === 'connecting'
                ? 'Connecting...'
                : connectionStatus === 'error'
                  ? 'Connection Error'
                  : 'Click to Start Conversation'}
          </p>
          <p className="text-white/70 text-sm md:text-base" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {connectionStatus === 'connected'
              ? `Talking with ${agentName}`
              : connectionStatus === 'connecting'
                ? 'Please wait...'
                : connectionStatus === 'error'
                  ? errorMessage || 'Something went wrong. Click to retry.'
                  : 'Click the microphone to begin'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AgentConversation;
