import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  Eye,
  Edit2,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Calendar,
  TrendingUp,
  Heart,
  MessageCircle,
  Share,
  RefreshCw,
} from "lucide-react";
import { listPosts } from "@/lib/api";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import {
  HistoryPost as HistoryRecord,
  PendingPost,
  normalizeFromDb,
  pendingKey,
  toHistory,
  makeGeneratedId,
} from "@/lib/posts";

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music2,
};

type EngagementMetrics = {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
};

type HistoryEntry = HistoryRecord & {
  engagement: EngagementMetrics;
};

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function formatNumber(num?: number) {
  const value = num ?? 0;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

function formatHashtags(tags?: string[]) {
  if (!tags || tags.length === 0) return "";
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");
}

function normalizeExternalHistory(raw: Record<string, unknown>): HistoryEntry {
  const idCandidate = raw.id ?? raw.post_id ?? raw.postId ?? makeGeneratedId("history");
  const base: HistoryEntry = {
    id: typeof idCandidate === "number" || typeof idCandidate === "string" ? idCandidate : makeGeneratedId("history"),
    platform: typeof raw.platform === "string" ? raw.platform : "Unknown",
    topic: typeof raw.topic === "string" ? raw.topic : typeof raw.title === "string" ? raw.title : "Untitled",
    content: typeof raw.content === "string" ? raw.content : typeof raw.body === "string" ? raw.body : "",
    hashtags:
      Array.isArray(raw.hashtags)
        ? (raw.hashtags as string[])
        : typeof raw.hashtags === "string"
        ? raw.hashtags.split(/[\s,]+/).filter(Boolean)
        : [],
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : typeof raw.image_url === "string" ? raw.image_url : null,
    imagePrompt: typeof raw.imagePrompt === "string" ? raw.imagePrompt : typeof raw.image_prompt === "string" ? raw.image_prompt : null,
    scheduledAt: typeof raw.scheduledAt === "string" ? raw.scheduledAt : typeof raw.scheduled_at === "string" ? raw.scheduled_at : null,
    approvalStatus:
      typeof raw.status === "string"
        ? (raw.status.toLowerCase() as HistoryRecord["approvalStatus"])
        : typeof raw.approval_status === "string"
        ? (raw.approval_status.toLowerCase() as HistoryRecord["approvalStatus"])
        : "approved",
    postedAt: typeof raw.postedAt === "string" ? raw.postedAt : typeof raw.published_at === "string" ? raw.published_at : null,
    statusNote:
      typeof raw.statusNote === "string"
        ? raw.statusNote
        : typeof raw.note === "string"
        ? raw.note
        : typeof raw.state === "string"
        ? raw.state
        : null,
    engagement: {
      likes: toNumber(raw.likes),
      comments: toNumber(raw.comments),
      shares: toNumber(raw.shares),
      reach: toNumber(raw.reach),
    },
  };

  return base;
}

export default function PostingHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedPost, setSelectedPost] = useState<HistoryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [n8nData, supabaseRows] = await Promise.all([
        fetch(N8N_ENDPOINTS.history)
          .then(async (res) => {
            if (!res.ok) throw new Error(`History request failed (${res.status})`);
            const body = await res.json();
            if (!Array.isArray(body)) return [] as HistoryEntry[];
            return body.map((item) => normalizeExternalHistory(item as Record<string, unknown>));
          })
          .catch(() => [] as HistoryEntry[]),
        listPosts(["approved", "rejected", "draft"]),
      ]);

      const supabaseHistory = supabaseRows.map((row) => {
        const pending: PendingPost = normalizeFromDb(row);
        const hist = toHistory(pending);
                return {
          ...hist,
          engagement: { likes: 0, comments: 0, shares: 0, reach: 0 },
        } satisfies HistoryEntry;
      });

      const merged = new Map<string, HistoryEntry>();
      n8nData.forEach((entry) => {
        merged.set(pendingKey(entry.id), entry);
      });
      supabaseHistory.forEach((entry) => {
        const key = pendingKey(entry.id);
        const existing = merged.get(key);
        if (existing) {
          merged.set(key, {
            ...existing,
            ...entry,
            engagement: existing.engagement ?? entry.engagement,
          });
        } else {
          merged.set(key, entry);
        }
      });

      const combined = Array.from(merged.values()).sort((a, b) => {
        const dateA = a.postedAt ?? a.scheduledAt ?? "";
        const dateB = b.postedAt ?? b.scheduledAt ?? "";
        return dateA < dateB ? 1 : dateA > dateB ? -1 : 0;
      });

      setHistory(combined);
      setSelectedPost((prev) => {
        if (!prev) return null;
        return combined.find((item) => pendingKey(item.id) === pendingKey(prev.id)) ?? null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load posting history.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const filteredHistory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return history.filter((post) => {
      const matchesSearch =
        term.length === 0 ||
        post.topic.toLowerCase().includes(term) ||
        (post.content ?? "").toLowerCase().includes(term) ||
        post.platform.toLowerCase().includes(term);
      const status = post.approvalStatus ?? "approved";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [history, searchTerm, statusFilter]);

  const approvedCount = useMemo(
    () => history.filter((post) => (post.approvalStatus ?? "approved") === "approved").length,
    [history]
  );

  const totalEngagement = useMemo(
    () =>
      history.reduce(
        (sum, post) => sum + post.engagement.likes + post.engagement.comments + post.engagement.shares,
        0
      ),
    [history]
  );

  const totalReach = useMemo(
    () => history.reduce((sum, post) => sum + post.engagement.reach, 0),
    [history]
  );

  const statusVariant = (status?: HistoryRecord["approvalStatus"]) => {
    if (status === "approved") return "approved" as const;
    if (status === "rejected") return "rejected" as const;
    return "draft" as const;
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-primary">Posting History</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track published content and performance.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={refreshHistory} disabled={loading} className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export Data</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>

        {error && (
          <GlassCard className="p-4 border-destructive/50 text-destructive">
            <p className="text-sm font-medium">{error}</p>
          </GlassCard>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <GlassCard className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Posts</p>
                <p className="text-2xl font-bold text-foreground">{history.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-400" />
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Engagement</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(totalEngagement)}</p>
              </div>
              <Heart className="h-8 w-8 text-accent" />
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reach</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(totalReach)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-secondary" />
            </div>
          </GlassCard>
        </div>

        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Reach</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">
                      Loading history...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">
                      No history matches your filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filteredHistory.map((post) => {
                    const PlatformIcon = platformIcons[post.platform as keyof typeof platformIcons];
                    const total = post.engagement.likes + post.engagement.comments + post.engagement.shares;

                    return (
                      <TableRow key={pendingKey(post.id)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {PlatformIcon && <PlatformIcon className="h-4 w-4 text-primary" />}
                            {post.platform}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-48 truncate" title={post.topic}>
                            {post.topic}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(post.postedAt ?? post.scheduledAt)}</div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={statusVariant(post.approvalStatus)}>
                            {post.approvalStatus ?? "approved"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3 text-red-400" />
                              {formatNumber(post.engagement.likes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3 text-blue-400" />
                              {formatNumber(post.engagement.comments)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share className="h-3 w-3 text-green-400" />
                              {formatNumber(post.engagement.shares)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatNumber(post.engagement.reach)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPost(post)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button variant="ghost" size="sm" className="opacity-50" disabled>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        {!loading && history.length === 0 && (
          <GlassCard className="p-12 text-center">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No posts found</h3>
            <p className="text-muted-foreground">Try adjusting your search or status filters.</p>
          </GlassCard>
        )}

        {/* Post Details Dialog */}
        <Dialog open={selectedPost !== null} onOpenChange={(open) => !open && setSelectedPost(null)}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl glass max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Post Details</DialogTitle>
            </DialogHeader>
            {selectedPost && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2 flex-wrap">
                  {platformIcons[selectedPost.platform as keyof typeof platformIcons] &&
                    React.createElement(
                      platformIcons[selectedPost.platform as keyof typeof platformIcons],
                      { className: "h-4 w-4 sm:h-5 sm:w-5 text-primary" }
                    )}
                  <span className="font-medium text-sm sm:text-base">{selectedPost.platform}</span>
                  <StatusBadge variant={statusVariant(selectedPost.approvalStatus)}>
                    {selectedPost.approvalStatus ?? "approved"}
                  </StatusBadge>
                </div>

                <div>
                  <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">Topic</h4>
                  <p className="text-muted-foreground text-sm">{selectedPost.topic}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">Content</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm">{selectedPost.content}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">Hashtags</h4>
                  <p className="text-blue-400 text-sm">{formatHashtags(selectedPost.hashtags)}</p>
                </div>

                {selectedPost.statusNote && (
                  <div>
                    <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">Status Note</h4>
                    <p className="text-muted-foreground text-sm">{selectedPost.statusNote}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-1 sm:mb-2 text-sm sm:text-base">Published</h4>
                  <p className="text-muted-foreground text-sm">{formatDate(selectedPost.postedAt)}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2 sm:mb-4 text-sm sm:text-base">Engagement Metrics</h4>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-red-400" />
                      <span className="text-xs sm:text-sm">Likes: {selectedPost.engagement.likes.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                      <span className="text-xs sm:text-sm">Comments: {selectedPost.engagement.comments.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Share className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                      <span className="text-xs sm:text-sm">Shares: {selectedPost.engagement.shares.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                      <span className="text-xs sm:text-sm">Reach: {selectedPost.engagement.reach.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}