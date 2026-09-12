import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import { MessageCircle, X, Send, AlertCircle, CheckCircle2, Paperclip, Trash2, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { chatbotApi } from "../services/chatbotApi";
import { supabase } from "../lib/supabase";
import { uploadFile } from "../lib/fileUpload";

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

const SESSION_STORAGE_KEY = "chatbot_session_id";

// Generate a unique session ID
const generateSessionId = (): string => {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Get or create session ID from localStorage
const getSessionId = (): string => {
    if (typeof window === "undefined") return generateSessionId();

    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
};

export const Chatbot = () => {
    const location = useLocation();
    const hideOnSupportPage = location.pathname === '/support';

    const [isOpen, setIsOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string>(getSessionId());
    const [userId, setUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            text: "Hello! I'm here to help you learn about DNAI, our AI-powered voice automation platform. You can ask me about our features, bots, calls, or how to use the platform. How can I assist you today?",
            isUser: false,
            timestamp: new Date(),
        },
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Support ticket state
    const [ticketSubject, setTicketSubject] = useState("");
    const [ticketMessage, setTicketMessage] = useState("");
    const [ticketPriority, setTicketPriority] = useState("medium");
    const [ticketEmail, setTicketEmail] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
    const [ticketSuccess, setTicketSuccess] = useState(false);
    const [ticketError, setTicketError] = useState("");
    const [activeTab, setActiveTab] = useState("chat");
    const [uploadProgress, setUploadProgress] = useState<string>("");

    const fileInputRef2 = useRef<HTMLInputElement>(null);

    // Initialize session ID and get user ID on mount
    useEffect(() => {
        const savedSessionId = getSessionId();
        setSessionId(savedSessionId);

        // Get current user if authenticated
        const getCurrentUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUserId(session.user.id);
                }
            } catch (error) {
                // Silently fail - chatbot can work without user ID
            }
        };

        getCurrentUser();

        // Listen for auth state changes
        try {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (session?.user) {
                    setUserId(session.user.id);
                } else {
                    setUserId(null);
                }
            });

            return () => {
                subscription.unsubscribe();
            };
        } catch (error) {
            // Silently fail if auth listener fails
            return () => { };
        }
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && activeTab === "chat" && scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, isOpen, activeTab]);

    // Focus input when chat opens or when switching back to chat tab
    useEffect(() => {
        if (isOpen && activeTab === "chat" && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, activeTab]);

    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputMessage.trim(),
            isUser: true,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const messageText = inputMessage.trim();
        setInputMessage("");
        setIsLoading(true);

        try {
            // Build conversation history from existing messages (excluding the welcome message)
            const conversationHistory = messages
                .slice(1) // Skip welcome message
                .map((msg) => ({
                    role: msg.isUser ? ("user" as const) : ("assistant" as const),
                    content: msg.text,
                }));

            // Add current user message to history
            conversationHistory.push({
                role: "user",
                content: messageText,
            });

            // Call the chatbot API
            const data = await chatbotApi.sendMessage(
                messageText,
                conversationHistory,
                sessionId,
                userId
            );

            // Update session_id if returned from backend
            if (data.session_id && data.session_id !== sessionId) {
                setSessionId(data.session_id);
                if (typeof window !== "undefined") {
                    localStorage.setItem(SESSION_STORAGE_KEY, data.session_id);
                }
            }

            // Extract response
            const botResponse =
                data.response || data.message || "I'm sorry, I couldn't process that request. Please try again.";

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: botResponse.trim(),
                isUser: false,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, botMessage]);
        } catch (error: any) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: error.message || "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
                isUser: false,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            // Limit to 5MB total size, max 3 files
            const maxFiles = 3;
            const currentCount = attachments.length;

            if (currentCount + newFiles.length > maxFiles) {
                setTicketError(`You can only upload a maximum of ${maxFiles} attachments.`);
                return;
            }

            const validFiles = newFiles.filter(f => f.size <= 5 * 1024 * 1024);
            if (validFiles.length < newFiles.length) {
                setTicketError("Some files were skipped because they exceed the 5MB size limit.");
            }

            setAttachments(prev => [...prev, ...validFiles]);
            if (fileInputRef2.current) fileInputRef2.current.value = "";
        }
    };

    const removeAttachment = (indexToRemove: number) => {
        setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const submitSupportTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketSubject.trim() || !ticketMessage.trim() || isSubmittingTicket) return;

        if (!userId && !ticketEmail.trim()) {
            setTicketError("Email is required so we can follow up with you.");
            return;
        }

        if (!userId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticketEmail)) {
            setTicketError("Please enter a valid email address.");
            return;
        }

        if (ticketMessage.trim().length < 10) {
            setTicketError("Message must be at least 10 characters long");
            return;
        }

        setIsSubmittingTicket(true);
        setTicketError("");
        setTicketSuccess(false);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Use REACT_APP specified by convention, or standard SUPPORT_TICKET_STAGING
            const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
            const apiUrl = process.env.REACT_APP_SUPPORT_TICKET_STAGING || process.env.SUPPORT_TICKET_STAGING || "https://devstage.duhanashrah.ai/api/public/customer-support/tickets";

            if (!apiUrl) {
                throw new Error("Support API endpoint is missing");
            }

            // Upload attachments if any
            const uploadedAttachments = [];
            if (attachments.length > 0) {
                setUploadProgress(`Uploading 0 of ${attachments.length} files...`);
                let uploadedCount = 0;

                for (const file of attachments) {
                    const basePath = userId ? "support" : "public-support";
                    const result = await uploadFile(file, "support-attachments", "", basePath);
                    if (result.error) {
                        throw new Error(`Failed to upload ${file.name}: ${result.error}`);
                    }
                    if (result.url) {
                        uploadedAttachments.push({
                            file_name: file.name,
                            file_path: result.url,
                            file_url: result.url,
                            file_size: file.size,
                            file_type: file.type
                        });
                    }
                    uploadedCount++;
                    setUploadProgress(`Uploading ${uploadedCount} of ${attachments.length} files...`);
                }
            }

            setUploadProgress("Submitting ticket...");

            const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || "Guest User";
            const userEmail = session?.user?.email || ticketEmail.trim() || "guest@example.com";

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    name: userName,
                    email: userEmail,
                    subject: ticketSubject.trim(),
                    message: ticketMessage.trim(),
                    category: "Customer Support",
                    priority: ticketPriority,
                    api_key: "1234567890",
                    source_url: window.location.href,
                    user_agent: navigator.userAgent,
                    metadata: {
                        referrer: document.referrer || "",
                        timestamp: new Date().toISOString()
                    },
                    user_id: userId,
                    attachments: uploadedAttachments,
                })
            });

            const text = await response.text();
            let result;
            try {
                result = text ? JSON.parse(text) : {};
            } catch (err) {
                console.error("Failed to parse ticket api response", text);
                result = { error: { message: "Server returned invalid JSON response: " + text.slice(0, 50) } };
            }

            if (!response.ok || (result && result.success === false)) {
                // Handle provided error format: { success: false, error: { message: string } }
                const errorMessage = result?.error?.message || result?.message || "Failed to create support ticket.";
                throw new Error(errorMessage);
            }

            setTicketSuccess(true);
            setTicketSubject("");
            setTicketMessage("");
            setTicketEmail("");
            setTicketPriority("medium");
            setAttachments([]);

            setTimeout(() => {
                setTicketSuccess(false);
                setActiveTab("chat");
            }, 3000);
        } catch (error: any) {
            console.error("Support ticket error:", error);
            setTicketError(error.message || "An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmittingTicket(false);
            setUploadProgress("");
        }
    };

    if (hideOnSupportPage) {
        return null;
    }

    return (
        <>
            {/* Floating Chat Button */}
            <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60]">
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "relative h-14 w-14 rounded-full shadow-lg transition-all duration-200 p-0",
                        "bg-primary text-white hover:opacity-90 hover:shadow-xl hover:scale-105",
                        isOpen && "bg-destructive hover:bg-destructive/90"
                    )}
                    aria-label={isOpen ? "Close chat" : "Open chat"}
                >
                    {isOpen ? (
                        <X className="h-6 w-6" />
                    ) : (
                        <MessageCircle className="h-6 w-6" />
                    )}
                </Button>
            </div>

            {/* Chat Window */}
            {isOpen && (
                <Card className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[500px] sm:h-[600px] max-h-[calc(100vh-6rem)] shadow-2xl z-[60] flex flex-col border border-border bg-card animate-in fade-in zoom-in duration-200">
                    <CardContent className="flex flex-col h-full p-0">
                        {/* Header */}
                        <div className="p-4 border-b border-border bg-primary text-primary-foreground rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                                        <MessageCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">AI Support Assistant</h3>
                                        <p className="text-xs opacity-90 mt-0.5">
                                            Ask me about DNAI
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                                    onClick={() => {
                                        setIsOpen(false);
                                        setTicketError("");
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                            <div className="px-4 py-2 border-b border-border bg-muted/20">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="chat">AI Chat</TabsTrigger>
                                    <TabsTrigger value="support">Customer Support</TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Chat Tab */}
                            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 m-0 data-[state=inactive]:hidden">
                                {/* Messages */}
                                <ScrollArea className="flex-1 p-4 bg-muted/30 scrollbar-thin" ref={scrollAreaRef}>
                                    <div className="space-y-4">
                                        {messages.map((message) => (
                                            <div
                                                key={message.id}
                                                className={cn(
                                                    "flex",
                                                    message.isUser ? "justify-end" : "justify-start"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm",
                                                        message.isUser
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-background text-foreground border border-border"
                                                    )}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                        {message.text}
                                                    </p>
                                                    <span
                                                        className={cn(
                                                            "text-[10px] mt-1.5 block",
                                                            message.isUser ? "opacity-80 text-primary-foreground" : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {message.timestamp.toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {isLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-background border border-border rounded-2xl px-4 py-2.5 shadow-sm">
                                                    <div className="flex gap-1 items-center">
                                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>

                                <div className="p-4 border-t border-border bg-card rounded-b-xl">
                                    <div className="flex gap-2">
                                        <Input
                                            ref={inputRef}
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Ask a question..."
                                            disabled={isLoading}
                                            className="flex-1"
                                        />
                                        <Button
                                            onClick={sendMessage}
                                            disabled={!inputMessage.trim() || isLoading}
                                            size="icon"
                                            className="shrink-0"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Support Tab */}
                            <TabsContent value="support" className="flex-1 flex flex-col min-h-0 m-0 overflow-y-auto scrollbar-thin data-[state=inactive]:hidden p-4">
                                <form onSubmit={submitSupportTicket} className="space-y-4">
                                    {!userId && (
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="your.email@example.com"
                                                value={ticketEmail}
                                                onChange={(e) => setTicketEmail(e.target.value)}
                                                disabled={isSubmittingTicket}
                                                required
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject</Label>
                                        <Input
                                            id="subject"
                                            placeholder="Brief description of your issue"
                                            value={ticketSubject}
                                            onChange={(e) => setTicketSubject(e.target.value)}
                                            disabled={isSubmittingTicket}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="priority">Priority</Label>
                                        <Select
                                            value={ticketPriority}
                                            onValueChange={setTicketPriority}
                                            disabled={isSubmittingTicket}
                                        >
                                            <SelectTrigger id="priority">
                                                <SelectValue placeholder="Select priority" />
                                            </SelectTrigger>
                                            <SelectContent className="z-[100]">
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="urgent">Urgent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="message">Message <span className="text-destructive">*</span></Label>
                                        </div>
                                        <Textarea
                                            id="message"
                                            placeholder="Describe your issue in detail..."
                                            value={ticketMessage}
                                            onChange={(e) => setTicketMessage(e.target.value)}
                                            disabled={isSubmittingTicket}
                                            required
                                            className="min-h-[120px]"
                                        />
                                    </div>

                                    {ticketError && (
                                        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>{ticketError}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Attachments (Max 3, 5MB each)</Label>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef2.current?.click()}
                                                disabled={isSubmittingTicket || attachments.length >= 3}
                                                className="w-full flex justify-center border-dashed border-2 py-4 h-auto text-muted-foreground hover:text-foreground"
                                            >
                                                <Paperclip className="h-4 w-4 mr-2" />
                                                Add Attachments
                                            </Button>
                                            <input
                                                type="file"
                                                ref={fileInputRef2}
                                                onChange={handleFileChange}
                                                className="hidden"
                                                multiple
                                                accept="image/*,.pdf,.doc,.docx,.txt"
                                            />
                                        </div>

                                        {attachments.length > 0 && (
                                            <div className="space-y-2">
                                                {attachments.map((file, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                                                        <span className="truncate flex-1 max-w-[200px]" title={file.name}>{file.name}</span>
                                                        <span className="text-muted-foreground text-xs ml-2">
                                                            {(file.size / 1024 / 1024).toFixed(1)} MB
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 ml-2 text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                                                            onClick={() => removeAttachment(i)}
                                                            disabled={isSubmittingTicket}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {ticketSuccess && (
                                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md dark:bg-green-900/20 dark:text-green-400">
                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                            <span>Support ticket created successfully!</span>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={isSubmittingTicket || !ticketSubject.trim() || !ticketMessage.trim()}
                                    >
                                        {isSubmittingTicket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isSubmittingTicket ? (uploadProgress || "Creating Ticket...") : "Submit Ticket"}
                                    </Button>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </>
    );
};

export default Chatbot;
