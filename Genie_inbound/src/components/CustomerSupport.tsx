import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';
import { Loader2, Search, ArrowLeft, MessageSquare, Clock, Send, Paperclip, X, FileIcon, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments';

interface SupportAttachment {
    id?: string;
    file_name?: string;
    fileName?: string;
    name?: string;
    file_url?: string;
    fileUrl?: string;
    url?: string;
    file_path?: string;
    filePath?: string;
    file_type?: string;
    fileType?: string;
}

const getAttachmentName = (att: SupportAttachment) =>
    att.file_name || att.fileName || att.name || 'Attachment';

const isImageAttachment = (att: SupportAttachment) => {
    const mime = att.file_type || att.fileType || '';
    const name = getAttachmentName(att);
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
};

const extractStoragePath = (value: string | undefined, bucket: string): string | null => {
    if (!value) return null;
    if (!value.startsWith('http')) return value.replace(/^\/+/, '');

    const markers = [
        `/storage/v1/object/public/${bucket}/`,
        `/storage/v1/object/sign/${bucket}/`,
        `/storage/v1/object/authenticated/${bucket}/`,
    ];
    for (const marker of markers) {
        const index = value.indexOf(marker);
        if (index >= 0) {
            let path = decodeURIComponent(value.slice(index + marker.length));
            const queryIndex = path.indexOf('?');
            if (queryIndex >= 0) path = path.slice(0, queryIndex);
            return path;
        }
    }
    return null;
};

const resolveAttachmentUrl = async (att: SupportAttachment): Promise<string | null> => {
    const storage = supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET);
    const storageWithSigned = storage as unknown as {
        createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: Error | null }>;
    };

    const filePath =
        extractStoragePath(att.file_path || att.filePath, SUPPORT_ATTACHMENTS_BUCKET) ||
        extractStoragePath(att.file_url || att.fileUrl || att.url, SUPPORT_ATTACHMENTS_BUCKET);

    if (filePath) {
        const { data: signed, error: signedError } = await storageWithSigned.createSignedUrl(filePath, 3600);
        if (!signedError && signed?.signedUrl) return signed.signedUrl;

        const { data: { publicUrl } } = storage.getPublicUrl(filePath);
        if (publicUrl) return publicUrl;
    }

    const directUrl = att.file_url || att.fileUrl || att.url;
    return directUrl?.startsWith('http') ? directUrl : null;
};

const MessageAttachmentItem = ({
    att,
    isUserMessage,
}: {
    att: SupportAttachment;
    isUserMessage: boolean;
}) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    const name = getAttachmentName(att);
    const isImage = isImageAttachment(att);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadFailed(false);
        setImageFailed(false);
        setUrl(null);

        resolveAttachmentUrl(att)
            .then((resolved) => {
                if (cancelled) return;
                setUrl(resolved);
                setLoadFailed(!resolved);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadFailed(true);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [att.id, att.file_url, att.fileUrl, att.url, att.file_path, att.filePath]);

    const wrapperClass = cn(
        'rounded-lg p-2 min-w-[140px]',
        isUserMessage ? 'bg-primary-foreground/15' : 'bg-background/80 border border-border'
    );
    const textClass = isUserMessage ? 'text-primary-foreground' : 'text-foreground';
    const linkClass = cn('flex items-center gap-2 text-xs font-medium transition-opacity hover:opacity-80', textClass);

    if (loading) {
        return (
            <div className={wrapperClass}>
                <div className={cn('flex items-center gap-2 text-xs', textClass)}>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Loading {name}…</span>
                </div>
            </div>
        );
    }

    if (loadFailed || !url) {
        return (
            <div className={wrapperClass}>
                <div className={cn('flex items-center gap-2 text-xs', textClass)}>
                    <FileIcon className="h-4 w-4 shrink-0 opacity-80" />
                    <span className="truncate">{name}</span>
                </div>
                <p className={cn('mt-1 text-[10px] opacity-80', textClass)}>Preview unavailable</p>
            </div>
        );
    }

    if (isImage && !imageFailed) {
        return (
            <div className={wrapperClass}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                        src={url}
                        alt={name}
                        className="max-h-48 max-w-full rounded-md border border-border/50 object-contain bg-background"
                        onError={() => setImageFailed(true)}
                    />
                    <span className={cn('mt-1.5 block truncate text-xs font-medium', textClass)}>{name}</span>
                </a>
            </div>
        );
    }

    return (
        <div className={wrapperClass}>
            <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <FileIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{name}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </a>
        </div>
    );
};

const MessageAttachments = ({
    attachments,
    isUserMessage,
    showDivider = true,
}: {
    attachments: SupportAttachment[];
    isUserMessage: boolean;
    showDivider?: boolean;
}) => (
    <div
        className={cn(
            'space-y-2',
            showDivider && 'mt-2 border-t pt-2',
            showDivider && (isUserMessage ? 'border-primary-foreground/25' : 'border-border')
        )}
    >
        {attachments.map((att, index) => (
            <MessageAttachmentItem key={att.id || `${getAttachmentName(att)}-${index}`} att={att} isUserMessage={isUserMessage} />
        ))}
    </div>
);

interface Ticket {
    id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    user_email: string;
}

interface Message {
    id: string;
    ticket_id: string;
    message: string;
    message_type: 'user' | 'agent' | 'system';
    sender_name: string;
    sender_email: string;
    created_at: string;
    attachments?: any[];
    support_attachments?: any[];
}

interface TicketDetails extends Ticket {
    messages: Message[];
}

const CustomerSupport = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const [userEmail, setUserEmail] = useState<string>('');
    const [userId, setUserId] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const [replyMessage, setReplyMessage] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    
    // New Ticket State
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [newTicketSubject, setNewTicketSubject] = useState('');
    const [newTicketCategory, setNewTicketCategory] = useState('technical');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getApiUrl = () => {
        return process.env.REACT_APP_SUPPORT_TICKET_STAGING || process.env.SUPPORT_TICKET_STAGING || "https://devstage.duhanashrah.ai/api/public/customer-support/tickets";
    };

    const normalizeMessage = useCallback((message: any): Message => ({
        ...message,
        attachments: message.attachments || message.support_attachments || []
    }), []);

    const mergeMessage = useCallback((message: any) => {
        const normalizedMessage = normalizeMessage(message);

        setCurrentMessages(prev => {
            const existingIndex = prev.findIndex(m => m.id === normalizedMessage.id);
            const nextMessages = existingIndex >= 0
                ? prev.map((m, index) => index === existingIndex ? normalizedMessage : m)
                : [...prev, normalizedMessage];

            return nextMessages.sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        });
    }, [normalizeMessage]);

    const loadMessageById = useCallback(async (messageId: string) => {
        const { data, error } = await supabase
            .from('support_messages')
            .select('*, support_attachments(*)')
            .eq('id', messageId)
            .single();

        if (error) {
            console.error("Failed to load realtime support message:", error);
            return;
        }

        if (data) mergeMessage(data);
    }, [mergeMessage]);

    useEffect(() => {
        const fetchUserAndTickets = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const email = session.user.email || '';
                const uid = session.user.id;
                const name = session.user.user_metadata?.full_name || email.split('@')[0] || "User";
                
                setUserEmail(email);
                setUserId(uid);
                setUserName(name);
                loadTickets(email, uid);
            }
        };
        fetchUserAndTickets();
    }, []);

    useEffect(() => {
        if (currentMessages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [currentMessages]);

    // Real-time Subscription
    useEffect(() => {
        if (!selectedTicket?.id) return;

        const ticketId = selectedTicket.id;
        console.log("Initializing subscription for ticket:", ticketId);

        const channel = (supabase as any)
            .channel(`support_messages_${ticketId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'admin',
                    table: 'support_messages',
                    filter: `ticket_id=eq.${ticketId}`
                },
                (payload: any) => {
                    console.log("Support message inserted:", payload);
                    const newMessage = payload.new as Message | undefined;
                    if (newMessage?.id) loadMessageById(newMessage.id);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'admin',
                    table: 'support_messages',
                    filter: `ticket_id=eq.${ticketId}`
                },
                (payload: any) => {
                    console.log("Support message updated:", payload);
                    const updatedMessage = payload.new as Message | undefined;
                    if (updatedMessage?.id) loadMessageById(updatedMessage.id);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'admin',
                    table: 'support_attachments',
                    filter: `ticket_id=eq.${ticketId}`
                },
                (payload: any) => {
                    const messageId = payload.new?.message_id;
                    if (messageId) loadMessageById(messageId);
                }
            )
            .subscribe((status: string, err?: any) => {
                console.log(`Subscription status for ${ticketId}:`, status);
                if (err) console.error("Subscription error:", err);
            });

        return () => {
            console.log("Cleaning up subscription for ticket:", ticketId);
            (supabase as any).removeChannel(channel);
        };
    }, [selectedTicket?.id, loadMessageById]);


    const loadTickets = async (email: string, uid: string) => {
        setIsLoadingList(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .or(`user_email.eq.${email},user_id.eq.${uid}`)
                .order('updated_at', { ascending: false });
            
            if (error) throw error;
            if (data) setTickets(data);
        } catch (error) {
            console.error("Failed to load tickets:", error);
        } finally {
            setIsLoadingList(false);
        }
    };

    const loadTicketDetails = async (ticketId: string) => {
        setIsLoadingDetails(true);
        try {
            // Fetch ticket info
            const { data: ticket, error: ticketError } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', ticketId)
                .single();
            
            if (ticketError) throw ticketError;

            // Fetch messages
            const { data: messages, error: messagesError } = await supabase
                .from('support_messages')
                .select('*, support_attachments(*)')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });
            
            if (messagesError) throw messagesError;

            setSelectedTicket(ticket);
            setCurrentMessages((messages || []).map(normalizeMessage));
        } catch (error) {
            console.error("Failed to load ticket details:", error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleSelectTicket = (ticket: Ticket) => {
        loadTicketDetails(ticket.id);
    };

    const triggerWebhook = async (payload: any) => {
        const webhookUrl = process.env.REACT_APP_SUPPORT_CHAT_WEBHOOK_URL;
        console.log("Triggering support webhook:", webhookUrl, payload);
        
        if (!webhookUrl) {
            console.warn("Support webhook URL not found in environment variables. Please restart your dev server.");
            return;
        }

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([payload]) // Wrapping in a list as shown in example
            });
            console.log("Webhook sent successfully");
        } catch (error) {
            console.error("Webhook notification failed:", error);
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicketSubject.trim() || !userId) return;

        setIsLoadingList(true);
        try {
            const ticketNumber = `TICKET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
            
            const { data, error } = await supabase
                .from('support_tickets')
                .insert({
                    ticket_number: ticketNumber,
                    subject: newTicketSubject.trim(),
                    category: newTicketCategory,
                    user_id: userId,
                    user_email: userEmail,
                    user_name: userName,
                    status: 'open',
                    priority: 'medium'
                })
                .select()
                .single();

            if (error) throw error;
            
            if (data) {
                setTickets(prev => [data, ...prev]);
                setIsCreatingTicket(false);
                setNewTicketSubject('');
                handleSelectTicket(data);

                // Trigger Webhook for new ticket
                triggerWebhook({
                    body: {
                        sender_name: userName,
                        sender_email: userEmail,
                        ticket_subject: data.subject,
                        Ticket_message: `New ticket created: ${data.subject}`,
                        ticket_id: data.id
                    }
                });
            }
        } catch (error) {
            console.error("Failed to create ticket:", error);
        } finally {
            setIsLoadingList(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendReply = async () => {
        if ((!replyMessage.trim() && attachments.length === 0) || !selectedTicket || !userId) return;
        
        setIsSendingReply(true);
        const pendingFiles = [...attachments];
        const outboundText = replyMessage.trim();
        const messageBody = outboundText || (pendingFiles.length > 0 ? 'Sent an attachment' : '');

        try {
            // 1. Insert message
            const { data: messageData, error: messageError } = await supabase
                .from('support_messages')
                .insert({
                    ticket_id: selectedTicket.id,
                    message: messageBody,
                    message_type: 'user',
                    sender_id: userId,
                    sender_name: userName,
                    sender_email: userEmail,
                    sender_role: 'external',
                    is_internal: false
                })
                .select()
                .single();

            if (messageError) throw messageError;
            
            // Trigger Webhook for new message
            if (messageData && selectedTicket) {
                triggerWebhook({
                    body: {
                        sender_name: userName,
                        sender_email: userEmail,
                        ticket_subject: selectedTicket.subject,
                        Ticket_message: messageBody,
                        ticket_id: selectedTicket.id
                    }
                });
            }

            // Add to local state when there are no files (otherwise reload after upload)
            if (messageData && pendingFiles.length === 0) {
                mergeMessage(messageData);
            }

            // 2. Handle attachments
            if (pendingFiles.length > 0 && messageData) {
                setUploadingFiles(true);
                let uploadedCount = 0;

                for (const file of pendingFiles) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                    const filePath = `support/${selectedTicket.id}/ticket/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from(SUPPORT_ATTACHMENTS_BUCKET)
                        .upload(filePath, file, { upsert: false });

                    if (uploadError) {
                        console.error("Upload error:", uploadError);
                        toast.error(`Failed to upload ${file.name}`, {
                            description: uploadError.message,
                        });
                        continue;
                    }

                    const { data: signedData, error: signedError } = await (
                        supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET) as unknown as {
                            createSignedUrl: (path: string, expiresIn: number) => Promise<{
                                data: { signedUrl: string } | null;
                                error: Error | null;
                            }>;
                        }
                    ).createSignedUrl(filePath, 3600);

                    const fileUrl = !signedError && signedData?.signedUrl
                        ? signedData.signedUrl
                        : supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).getPublicUrl(filePath).data.publicUrl;

                    const { error: attachError } = await supabase
                        .from('support_attachments')
                        .insert({
                            ticket_id: selectedTicket.id,
                            message_id: messageData.id,
                            file_name: file.name,
                            file_path: filePath,
                            file_url: fileUrl,
                            file_size: file.size,
                            file_type: file.type,
                            file_extension: fileExt?.toUpperCase(),
                            uploaded_by: userId,
                            uploaded_at: new Date().toISOString()
                        });

                    if (attachError) {
                        console.error("Attachment record error:", attachError);
                        toast.error(`Failed to save ${file.name}`, {
                            description: attachError.message,
                        });
                        continue;
                    }

                    uploadedCount += 1;
                }

                setUploadingFiles(false);

                if (uploadedCount > 0) {
                    await loadMessageById(messageData.id);
                } else {
                    toast.error('No attachments were uploaded. Check storage permissions.');
                }
            }

            setReplyMessage('');
            setAttachments([]);
            // Real-time will update the list
        } catch (error) {
            console.error("Failed to send reply:", error);
        } finally {
            setIsSendingReply(false);
            setUploadingFiles(false);
        }
    };

    const filteredTickets = tickets.filter(t => 
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch(status.toLowerCase()) {
            case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] gap-4 pt-4 px-4 w-full min-w-0 overflow-hidden">
            {/* Left Panel: Ticket List */}
            <Card className={`w-full md:w-1/3 min-w-0 flex flex-col h-full ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                <CardHeader className="px-4 py-3 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg">Customer Support</CardTitle>
                            <CardDescription>View and respond to your tickets</CardDescription>
                        </div>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs h-8 shrink-0 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-primary"
                            onClick={() => setIsCreatingTicket(true)}
                        >
                            New Ticket
                        </Button>
                    </div>
                    <div className="mt-2 relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search tickets..." 
                            className="pl-9 h-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden relative">
                    {isLoadingList ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : isCreatingTicket ? (
                        <div className="p-4 h-full bg-muted/20">
                            <form onSubmit={handleCreateTicket} className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-sm">Create New Ticket</h4>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCreatingTicket(false)}><X className="h-4 w-4" /></Button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Subject</label>
                                    <Input 
                                        value={newTicketSubject} 
                                        onChange={(e) => setNewTicketSubject(e.target.value)} 
                                        placeholder="What's the issue?" 
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Category</label>
                                    <select 
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={newTicketCategory}
                                        onChange={(e) => setNewTicketCategory(e.target.value)}
                                    >
                                        <option value="technical">Technical</option>
                                        <option value="billing">Billing</option>
                                        <option value="account">Account</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <Button type="submit" className="w-full" disabled={!newTicketSubject.trim()}>Create Ticket</Button>
                                <Button variant="ghost" className="w-full text-xs" onClick={() => setIsCreatingTicket(false)}>Cancel</Button>
                            </form>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 h-full text-center text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No tickets found.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full scrollbar-thin">
                            <div className="divide-y">
                                {filteredTickets.map(ticket => (
                                    <div 
                                        key={ticket.id} 
                                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-muted border-l-2 border-primary' : ''}`}
                                        onClick={() => handleSelectTicket(ticket)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-sm line-clamp-1">{ticket.subject}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                                            <span className="font-mono">{ticket.ticket_number}</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(ticket.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* Right Panel: Ticket Details */}
            <Card className={`w-full md:w-2/3 min-w-0 flex flex-col h-full ${!selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                {!selectedTicket ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-foreground">Select a ticket</h3>
                        <p className="text-sm">Choose a ticket from the list to view its details.</p>
                    </div>
                ) : (
                    <>
                        <CardHeader className="px-4 py-3 border-b flex flex-row items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="md:hidden" 
                                    onClick={() => setSelectedTicket(null)}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold">{selectedTicket.subject}</h2>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getStatusColor(selectedTicket.status)}`}>
                                            {selectedTicket.status}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {selectedTicket.ticket_number} • Created {new Date(selectedTicket.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col relative">
                            {isLoadingDetails ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    <ScrollArea className="flex-1 p-4 scrollbar-thin">
                                        <div className="space-y-4 pb-4">
                                            {currentMessages.map((msg) => (
                                                <div 
                                                    key={msg.id} 
                                                    className={`flex flex-col max-w-[85%] ${msg.message_type === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                                                >
                                                    <span className="text-xs text-muted-foreground mb-1 px-1">
                                                        {msg.sender_name} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                                                        msg.message_type === 'user' 
                                                            ? 'bg-primary text-primary-foreground rounded-br-sm' 
                                                            : 'bg-muted/60 border rounded-bl-sm'
                                                    }`}>
                                                        {msg.message?.trim() ? (
                                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                                        ) : null}
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <MessageAttachments
                                                                attachments={msg.attachments}
                                                                isUserMessage={msg.message_type === 'user'}
                                                                showDivider={Boolean(msg.message?.trim())}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    </ScrollArea>
                                    
                                    <div className="p-3 border-t bg-background shrink-0 mt-auto pr-4 pb-4 sm:pr-6">
                                        {attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2 min-w-0">
                                                {attachments.map((file, i) => (
                                                    <div key={i} className="bg-muted px-2 py-1 rounded-md flex items-center gap-2 text-xs border border-border max-w-full">
                                                        <FileIcon className="h-3 w-3 shrink-0" />
                                                        <span className="max-w-[100px] truncate">{file.name}</span>
                                                        <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => removeAttachment(i)}>
                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 min-w-0 w-full max-w-[calc(100%-4.5rem)]">
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                ref={fileInputRef} 
                                                onChange={handleFileChange} 
                                                multiple 
                                            />
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="shrink-0 rounded-full h-10 w-10 border border-input"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isSendingReply || uploadingFiles}
                                            >
                                                <Paperclip className="h-4 w-4" />
                                            </Button>
                                            <Input
                                                placeholder="Type your reply..."
                                                value={replyMessage}
                                                onChange={(e) => setReplyMessage(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendReply();
                                                    }
                                                }}
                                                disabled={isSendingReply || selectedTicket.status.toLowerCase() === 'closed'}
                                                className="h-10 flex-1 min-w-0"
                                            />
                                            <Button 
                                                onClick={handleSendReply} 
                                                disabled={(!replyMessage.trim() && attachments.length === 0) || isSendingReply || selectedTicket.status.toLowerCase() === 'closed'}
                                                size="icon"
                                                className="shrink-0 rounded-full h-10 w-10 bg-primary hover:bg-primary/90"
                                            >
                                                {isSendingReply || uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
};

export default CustomerSupport;
