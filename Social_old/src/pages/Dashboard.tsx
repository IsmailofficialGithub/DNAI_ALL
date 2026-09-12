import React, { useEffect, useMemo, useState } from "react";
import { useAccountStatus } from "@/contexts/AccountStatusContext";

type PendingPost = {

  id: string | number;

  platform: string; // e.g., "twitter", "instagram"

  topic: string;

  content: string;

  hashtags?: string[];

  imageUrl?: string;

  imageFile?: File | null;

  scheduledAt?: string | null;

  imagePrompt?: string | null;

  approvalStatus?: "pending" | "approved" | "rejected" | "draft";

  postedAt?: string | null;

};

type AnalyticsSummary = {

  period: string; // e.g., "Last 7 days"

  engagementRate: number; // percentage

  posts: number;

  impressions: number;

  growth: number; // percentage

  series?: number[]; // simple sparkline data

  platformBreakdown?: { name: string; value: number }[];

};

type PostAnalytics = {

  id: string | number;

  platform: string;

  topic: string;

  postedAt: string;

  impressions: number;

  likes?: number;

  comments?: number;

  shares?: number;

  engagementRate?: number;

};

type PlatformSeries = Record<string, number[]>; // e.g., { facebook: [..], instagram: [..] }

type HistoryPost = {

  id: string | number;

  platform: string;

  topic: string;

  content?: string;

  hashtags?: string[];

  imageUrl?: string | null;

  imagePrompt?: string | null;

  scheduledAt?: string | null;

  approvalStatus?: "pending" | "approved" | "rejected" | "draft";

  postedAt?: string | null;

  statusNote?: string | null;

};



type StrategyItem = {
  id: string;
  platform: string;
  strategyName: string;
  postingPlan: string[];
  postingTimes: string[];
  postingCategories: string[];
};

import { N8N_ENDPOINTS } from "@/lib/n8n";
import {
  savePost as saveToDb,
  approvePost as approveInDb,
  rejectPost as rejectInDb,
  listPosts,
  deletePosts,
  listStrategies,
  DbPostRow,
  DbStrategyRow,
} from "@/lib/api";
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {

  const headers = new Headers(init?.headers || {});

  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {

    const text = await res.text().catch(() => "");

    throw new Error(text || `Request failed: ${res.status}`);

  }

  return res.json();

}

const SAMPLE_PENDING: PendingPost[] = [

  {

    id: 1,

    platform: "facebook",

    topic: "Product Launch",

    content: "We are launching our new feature today! 🚀",

    hashtags: ["DNAI", "Duhanashrah", "AI"],

    imagePrompt: "Rocket launch, vibrant, minimal",

    imageUrl: "https://picsum.photos/seed/launch/800/400",

    approvalStatus: "pending",

    scheduledAt: new Date(Date.now() + 3600_000).toISOString(),

  },

  {

    id: 2,

    platform: "instagram",

    topic: "Behind the Scenes",

    content: "A look into our creative process.",

    hashtags: ["DNAI", "Duhanashrah", "AI"],

    imagePrompt: "Studio desk, candid, warm light",

    imageUrl: "https://picsum.photos/seed/bts/800/400",

    approvalStatus: "draft",

    scheduledAt: new Date(Date.now() + 7200_000).toISOString(),

  },

];



const STRATEGY_PLATFORM_OPTIONS = [

  { value: "facebook", label: "Facebook" },

  { value: "instagram", label: "Instagram" },

  { value: "linkedin", label: "LinkedIn" },

  { value: "twitter", label: "Twitter/X" },

] as const;



const PLATFORM_ALLOWED_DOMAINS: Record<string, string[]> = {

  facebook: ["facebook.com", "fb.com"],

  instagram: ["instagram.com"],

  linkedin: ["linkedin.com"],

  tiktok: ["tiktok.com"],

};



export default function DashboardPage() {
  const { isAccountActive } = useAccountStatus();
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingPost[]>([]);

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  const [acting, setActing] = useState<string | number | null>(null);

  const [postAnalytics, setPostAnalytics] = useState<PostAnalytics[]>([]);

  const [seriesByPlatform, setSeriesByPlatform] = useState<PlatformSeries>({});

  const [history, setHistory] = useState<HistoryPost[]>([]);

  const [openPlatformFor, setOpenPlatformFor] = useState<string | number | null>(null);

  const [viewer, setViewer] = useState<{ kind: "image" | "video"; src: string; mime?: string } | null>(null);

  const [openLinkFor, setOpenLinkFor] = useState<string | number | null>(null);

  const [historyDetail, setHistoryDetail] = useState<HistoryPost | null>(null);

  const [selected, setSelected] = useState<Set<PendingPost["id"]>>(new Set());

  const viewerSourceType = useMemo(() => {
    if (!viewer || viewer.kind !== "video") return undefined;
    if (viewer.mime) return viewer.mime;
    return inferVideoMime(viewer.src);
  }, [viewer]);

  const [strategyPlatform, setStrategyPlatform] = useState<string>(STRATEGY_PLATFORM_OPTIONS[0].value);

  const [competitorLinks, setCompetitorLinks] = useState<string[]>([""]);
  const [competitorLinkErrors, setCompetitorLinkErrors] = useState<(string | null)[]>([null]);
  const [strategyItems, setStrategyItems] = useState<StrategyItem[]>([]);
  const [strategyLoadError, setStrategyLoadError] = useState<string | null>(null);
  const [strategyRefreshing, setStrategyRefreshing] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [generatePostsCount, setGeneratePostsCount] = useState<number>(1);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [generatePostsFeedback, setGeneratePostsFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [generatePostsRawResponse, setGeneratePostsRawResponse] = useState<string>("");
  const [strategyNiche, setStrategyNiche] = useState<string>("");
  const [strategyGoal, setStrategyGoal] = useState<string>("");
  const [strategyRegion, setStrategyRegion] = useState<string>("");
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [strategyFeedback, setStrategyFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  useEffect(() => {

    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      setStrategyLoadError(null);
      try {
        const [pendingPosts, analyticsSummary, perPost, platformSeries, strategyRows] = await Promise.all([
          listPosts().then((rows) => rows.map(normalizeFromDb)),
          fetchJson<AnalyticsSummary>(N8N_ENDPOINTS.analyticsSummary).catch(() => ({
            period: "Last 7 days",
            engagementRate: 3.8,
            posts: 12,
            impressions: 48210,

            growth: 12.4,

            series: [10, 12, 8, 14, 11, 16, 18, 15, 20, 22, 19, 24],

            platformBreakdown: [

              { name: "Twitter", value: 42 },

              { name: "Instagram", value: 33 },

              { name: "LinkedIn", value: 25 },

            ],

          })),

          fetchJson<PostAnalytics[]>(N8N_ENDPOINTS.analyticsPosts).catch(() => [
            {
              id: 101,
              platform: "facebook",
              topic: "Product Launch",
              postedAt: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
              impressions: 12000,

              likes: 430,

              comments: 58,

              shares: 42,

              engagementRate: 4.1,

            },

            {

              id: 102,

              platform: "instagram",

              topic: "Behind the Scenes",

              postedAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),

              impressions: 18000,

              likes: 980,

              comments: 120,

              shares: 60,

              engagementRate: 5.6,

            },

            {

              id: 103,

              platform: "linkedin",

              topic: "Case Study",

              postedAt: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),

              impressions: 8400,

              likes: 220,

              comments: 44,

              shares: 25,

              engagementRate: 3.2,

            },

            {

              id: 104,

              platform: "twitter",

              topic: "Tips & Tricks",

              postedAt: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),

              impressions: 15200,

              likes: 410,

              comments: 35,

              shares: 18,

              engagementRate: 2.9,

            },

          ]),

          fetchJson<PlatformSeries>(N8N_ENDPOINTS.analyticsPlatformSeries).catch(() => ({
            facebook: [12, 14, 9, 11, 13, 15, 18, 17, 19, 20, 22, 24],
            instagram: [8, 9, 10, 13, 12, 16, 18, 21, 20, 22, 23, 25],
            linkedin: [6, 7, 8, 9, 11, 10, 12, 14, 13, 16, 15, 17],
            twitter: [10, 12, 8, 9, 11, 13, 12, 14, 15, 16, 13, 18],
          })),
          listStrategies().catch((err) => {
            if (mounted) setStrategyLoadError(err instanceof Error ? err.message : "Failed to load strategies");
            return [] as DbStrategyRow[];
          }),
        ]);
        if (!mounted) return;
        const pendingOnly = pendingPosts.filter((post) => (post.approvalStatus ?? "pending") === "pending");
        const historyOnly = pendingPosts.filter((post) => (post.approvalStatus ?? "pending") !== "pending");
        setPending(pendingOnly);
        setHistory((prev) => {
          const bucket = new Map<string, HistoryPost>();
          historyOnly.map((post) => toHistory(post)).forEach((entry) => {
            const key = pendingKey(entry.id as PendingPost["id"]);
            const existing = bucket.get(key);
            const existingNote = (existing as any)?.statusNote ?? null;
            const entryNote = (entry as any)?.statusNote ?? null;
            if (existingNote && !entryNote) {
              bucket.set(key, { ...entry, statusNote: existingNote });
            } else {
              bucket.set(key, entry);
            }
          });
          prev.forEach((entry) => {
            const key = pendingKey(entry.id as PendingPost["id"]);
            if (!bucket.has(key)) {
              bucket.set(key, entry);
            }
          });
          return Array.from(bucket.values());
        });
        setAnalytics(analyticsSummary);
        setPostAnalytics(perPost);
        setSeriesByPlatform(platformSeries);
        setStrategyItems(strategyRows.map(normalizeStrategyRow));
        // Load posting history (scheduled + posted) — fallback to samples

        try {

          const hist = await fetchJson<HistoryPost[]>(N8N_ENDPOINTS.history);

          if (mounted)

            setHistory(

              (hist || []).map((h: any) => ({

                id: h.id,

                platform: h.platform,

                topic: h.topic,

                content: h.content,

                hashtags: h.hashtags || [],

                imageUrl: h.image_url ?? h.imageUrl ?? null,

                imagePrompt: h.image_prompt ?? h.imagePrompt ?? null,

                scheduledAt: h.scheduled_at ?? h.scheduledAt ?? null,

                approvalStatus: h.approval_status ?? h.approvalStatus ?? undefined,

                postedAt: h.posted_at ?? h.postedAt ?? null,

                statusNote: h.status_note ?? h.statusNote ?? null,

              }))

            );

        } catch {

          if (mounted)

            setHistory([

              {

                id: 9001,

                platform: "facebook",

                topic: "Release Notes v1.2",

                content: "Changelog highlights for v1.2 release including fixes and improvements.",

                hashtags: ["DNAI", "Duhanashrah", "AI"],

                imageUrl: "https://picsum.photos/seed/rel/800/400",

                scheduledAt: new Date(Date.now() + 6 * 3600_000).toISOString(),

                approvalStatus: "approved",

                postedAt: null,

                statusNote: null,

              },

              {

                id: 9000,

                platform: "instagram",

                topic: "Team Offsite Highlights",

                content: "Snapshots from our recent offsite and team bonding.",

                hashtags: ["DNAI", "Duhanashrah", "AI"],

                imageUrl: "https://picsum.photos/seed/offsite/800/400",

                scheduledAt: new Date(Date.now() - 12 * 3600_000).toISOString(),

                approvalStatus: "approved",

                postedAt: new Date(Date.now() - 10 * 3600_000).toISOString(),

                statusNote: null,

              },

            ]);

        }

        // Override: Load history from Supabase (no samples)

        const historyRows: DbPostRow[] = await listPosts(["draft", "approved", "rejected"]);

        if (mounted)
          setHistory((prev) => {
            const bucket = new Map<string, HistoryPost>();
            historyRows
              .map((row) => toHistory(normalizeFromDb(row)))
              .forEach((entry) => {
                const key = pendingKey(entry.id as PendingPost["id"]);
                const existing = bucket.get(key);
                const existingNote = (existing as any)?.statusNote ?? null;
                const entryNote = (entry as any)?.statusNote ?? null;
                if (existingNote && !entryNote) {
                  bucket.set(key, { ...entry, statusNote: existingNote });
                } else {
                  bucket.set(key, entry);
                }
              });
            prev.forEach((entry) => {
              const key = pendingKey(entry.id as PendingPost["id"]);
              if (!bucket.has(key)) {
                bucket.set(key, entry);
              }
            });
            return Array.from(bucket.values());
          });

      } catch (err: any) {

        if (!mounted) return;

        setError(err?.message || "Failed to load dashboard");

      } finally {

        if (mounted) setLoading(false);

      }

    })();

    return () => {

      mounted = false;

    };

  }, []);

  // Close platform/link pickers when clicking outside

  useEffect(() => {

    if (openPlatformFor === null && openLinkFor === null) return;

    function onDoc(e: MouseEvent) {

      const t = e.target as HTMLElement;

      const inPlatform = t.closest('[data-platform-menu]') || t.closest('[data-platform-toggle]');

      const inLink = t.closest('[data-link-menu]') || t.closest('[data-link-toggle]');

      if (!inPlatform) setOpenPlatformFor(null);

      if (!inLink) setOpenLinkFor(null);

    }

    document.addEventListener('mousedown', onDoc);

    return () => document.removeEventListener('mousedown', onDoc);

  }, [openPlatformFor, openLinkFor]);

  useEffect(() => {
    if (strategyItems.length === 0) {
      setSelectedStrategyId(null);
      return;
    }
    setSelectedStrategyId((prev) => {
      if (prev && strategyItems.some((item) => item.id === prev)) return prev;
      return strategyItems[0].id;
    });
  }, [strategyItems]);

  const postCountOptions = useMemo(() => Array.from({ length: 10 }, (_, idx) => idx + 1), []);

  const strategySelectOptions = useMemo(
    () =>
      strategyItems.map((item) => {
        const platformLabel =
          STRATEGY_PLATFORM_OPTIONS.find((opt) => opt.value === item.platform)?.label ??
          humanizeStrategyKey(item.platform || "Strategy");
        const displayName = item.strategyName?.trim()
          ? item.strategyName.trim()
          : platformLabel;
        const planSummary = item.postingPlan.filter(Boolean).slice(0, 3).join(", ");
        const label = planSummary
          ? `${displayName} · ${planSummary}`
          : `${displayName} (${platformLabel})`;
        return { id: item.id, label };
      }),
    [strategyItems]
  );

  const canGeneratePosts = Boolean(selectedStrategyId && strategyItems.length > 0);

  const spark = useMemo(() => analytics?.series ?? [], [analytics]);
  const historyMediaKind = useMemo(() => {
    if (!historyDetail?.imageUrl) return null;
    return inferMediaTypeFromUrl(historyDetail.imageUrl);
  }, [historyDetail?.imageUrl]);


  function linePathForSeries(series: number[], width = 240, height = 60, pad = 6) {

    if (!series || series.length === 0) return "";

    const min = Math.min(...series);

    const max = Math.max(...series);

    const span = Math.max(1, max - min);

    const innerW = width - pad * 2;

    const innerH = height - pad * 2;

    return series

      .map((v, i) => {

        const x = pad + (i / Math.max(1, series.length - 1)) * innerW;

        const y = pad + innerH - ((v - min) / span) * innerH;

        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;

      })

      .join(" ");

  }

  function updatePost(id: PendingPost["id"], patch: Partial<PendingPost>) {

    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  }

  function formatHashtags(list?: string[]) {

    if (!list || list.length === 0) return "";

    return list.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(", ");

  }

  function parseHashtags(input: string): string[] {

    return input

      .split(/[,\s]+/)

      .map((h) => h.trim())

      .filter(Boolean)

      .map((h) => h.replace(/^#+/, "#"));

  }

  function toLocalInput(iso?: string | null) {

    if (!iso) return "";

    const d = new Date(iso);

    const pad = (n: number) => String(n).padStart(2, "0");

    const yyyy = d.getFullYear();

    const mm = pad(d.getMonth() + 1);

    const dd = pad(d.getDate());

    const hh = pad(d.getHours());

    const mi = pad(d.getMinutes());

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;

    // Note: This uses local time; backend can convert to UTC if needed

  }

  function fromLocalInput(value: string): string | null {

    if (!value) return null;

    const d = new Date(value);

    return d.toISOString();

  }

  async function handleAction(id: PendingPost["id"], action: "approve" | "reject") {

    try {

      setActing(id);

      // Ensure record exists in Supabase; then update status + trigger n8n

      let numericId: number | null = typeof id === "number" ? id : null;

      let item = pending.find((p) => p.id === id);

      let finalApprovedSnapshot: PendingPost | null = null;
      let statusNote: string | null = null;
      let postedAtFromWebhook: string | null = null;
      let rejectionReason: string | null = null;

      if (!numericId && item) {

        const payload: any = {

          platform: item.platform,

          topic: item.topic,

          content: item.content,

          hashtags: item.hashtags ?? [],

          imagePrompt: item.imagePrompt ?? null,

          imageUrl: item.imageUrl ?? null,

          scheduledAt: item.scheduledAt ?? null,

          status: action === "approve" ? "approved" : "rejected",

        };

        const saved: any = await saveToDb(payload);

        numericId = saved?.id ?? (Array.isArray(saved) ? saved[0]?.id : null);

      }



      if (action === "approve") {

        if (numericId == null) throw new Error("Unable to save post before approval");
        if (!item) throw new Error("Post data unavailable for approval");

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();
        const minimumSchedule = new Date(now.getTime() + 5 * 60 * 1000);
        let scheduledAtDate = item.scheduledAt ? new Date(item.scheduledAt) : null;
        if (!scheduledAtDate || Number.isNaN(scheduledAtDate.getTime()) || scheduledAtDate < minimumSchedule) {
          scheduledAtDate = minimumSchedule;
        }
        const scheduledAtIso = scheduledAtDate.toISOString();

        await saveToDb({
          id: numericId,
          platform: item.platform,
          topic: item.topic,
          content: item.content,
          hashtags: item.hashtags ?? [],
          imagePrompt: item.imagePrompt ?? null,
          imageUrl: item.imageUrl ?? null,
          scheduledAt: scheduledAtIso,
          status: "approved",
        });

        const webhookPayload = {
          id: numericId,
          platform: item.platform,
          topic: item.topic,
          content: item.content,
          hashtags: item.hashtags ?? [],
          imagePrompt: item.imagePrompt ?? null,
          imageUrl: item.imageUrl ?? null,
          scheduledAt: scheduledAtIso,
          timeZone,
          status: "approved",
        };

        const webhookResponse = await fetch(N8N_ENDPOINTS.approve, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post: webhookPayload }),
        });

        const webhookText = await webhookResponse.text().catch(() => "");
        let webhookData: any = null;
        if (webhookText) {
          try {
            webhookData = JSON.parse(webhookText);
          } catch {
            webhookData = null;
          }
        }

        if (!webhookResponse.ok) {
          let errorMessage = webhookText || `Webhook request failed with status ${webhookResponse.status}`;
          if (webhookData && typeof webhookData === "object" && webhookData !== null) {
            const info = webhookData as Record<string, unknown>;
            if (typeof info.message === "string" && info.message.trim() !== "") {
              errorMessage = info.message;
            }
          }
          throw new Error(errorMessage);
        }

        if (webhookData && typeof webhookData === "object" && webhookData !== null) {
          const info = webhookData as Record<string, unknown>;
          const statusCandidate = info.status ?? info.postingStatus ?? info.state ?? info.result;
          if (typeof statusCandidate === "string" && statusCandidate.trim() !== "") {
            statusNote = statusCandidate.trim();
          }
          const postedCandidate = info.postedAt ?? info.published_at ?? info.publishedAt ?? info.timestamp;
          if (typeof postedCandidate === "string" && postedCandidate.trim() !== "") {
            postedAtFromWebhook = postedCandidate.trim();
          }
        } else if (webhookText.trim().length > 0) {
          statusNote = webhookText.trim();
        }

        await approveInDb(numericId);

        const scheduleMessage = `Scheduled for ${scheduledAtDate.toLocaleString()} (${timeZone})`;
        alert(`Post approved. ${scheduleMessage}${statusNote ? ` | ${statusNote}` : ""}`);

        const originalStatusNote = statusNote;
        statusNote = originalStatusNote ? `${originalStatusNote} | ${scheduleMessage}` : scheduleMessage;

        item = { ...item, scheduledAt: scheduledAtIso };
        finalApprovedSnapshot = item;

      } else {

        const reason = window.prompt("Reason for rejection?", "Rejected by reviewer");

        if (!reason) {

          setActing(null);

          return;

        }

        if (numericId == null) throw new Error("Unable to save post before rejection");

        await rejectInDb(numericId, reason);

        rejectionReason = reason;
        statusNote = reason;

      }

      if (action === "approve" && !statusNote) statusNote = "Approved";
      if (action === "reject" && !statusNote) statusNote = rejectionReason ?? "Rejected";

       // Move the item to History with status (dedupe)

      setPending((prev) => {

        const pendingItem = prev.find((p) => p.id === id);

        if (pendingItem) {

          const base = action === "approve" ? (finalApprovedSnapshot ?? pendingItem) : pendingItem;
          const hist: HistoryPost = toHistory(base, {
            id: (numericId ?? id) as any,
            approvalStatus: action === "approve" ? "approved" : "rejected",
            scheduledAt: base.scheduledAt ?? null,
            postedAt: action === "approve" ? (postedAtFromWebhook ?? base.scheduledAt ?? new Date().toISOString()) : null,
            statusNote,
          });

          setHistory((h) => {

            const without = h.filter((x) => x.id !== id && x.id !== (numericId as any));

            return [hist, ...without];

          });

        }

        return prev.filter((p) => p.id !== id);

      });

    } catch (err) {

      const msg = err instanceof Error ? err.message : "Action failed";

      alert(`${action.toUpperCase()} failed: ${msg}`);

    } finally {

      setActing(null);

    }

  }

  async function savePost(id: PendingPost["id"]) {

    const post = pending.find((p) => p.id === id);

    if (!post) return;

    try {

      setActing(id);

      const payload: any = {

        ...(typeof id === "number" ? { id } : {}),

        platform: post.platform,

        topic: post.topic,

        content: post.content,

        hashtags: post.hashtags ?? [],

        imagePrompt: post.imagePrompt ?? undefined,

        imageUrl: post.imageUrl ?? undefined,

        scheduledAt: post.scheduledAt ?? undefined,

        status: "draft",

      };

      const saved: any = await saveToDb(payload);

      const savedId = saved?.id ?? (Array.isArray(saved) ? saved[0]?.id : undefined);

      if (!savedId) throw new Error("Save did not return an id");

      // Move to history as Draft and remove from review (dedupe)

      setPending((prev) => {

        const item = prev.find((p) => p.id === id);

        if (item) {

          const hist: HistoryPost = toHistory(item, {
            id: savedId,
            approvalStatus: "draft",
            postedAt: null,
            statusNote: null,
          });

          setHistory((h) => {

            const without = h.filter((x) => x.id !== id && x.id !== savedId);

            return [hist, ...without];

          });

        }

        return prev.filter((p) => p.id !== id);

      });

    } catch (err) {

      const msg = err instanceof Error ? err.message : "Save failed";

      alert(`SAVE failed: ${msg}`);

    } finally {

      setActing(null);

    }

  }

  function normalizeFromDb(row: DbPostRow): PendingPost {
    return {
      id: row.id,
      platform: row.platform,
      topic: row.topic,
      content: row.content,
      hashtags: (row.hashtags as string[] | null) || [],
      imagePrompt: row.image_prompt ?? null,
      imageUrl: row.image_url ?? null,
      approvalStatus: row.status ?? "pending",
      scheduledAt: row.scheduled_at ?? null,
      postedAt: null,
    } as PendingPost;
  }

  function makeGeneratedId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function pendingKey(id: PendingPost["id"]): string {
    return typeof id === "number" ? `n:${id}` : `s:${id}`;
  }

  function normalizeGeneratedPost(raw: unknown): PendingPost | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;

    const idCandidate = source.id ?? source.post_id ?? source.postId ?? source.uuid ?? source.external_id;
    let id: PendingPost["id"];
    if (typeof idCandidate === "number" && Number.isFinite(idCandidate)) {
      id = idCandidate;
    } else if (typeof idCandidate === "string" && idCandidate.trim() !== "") {
      const trimmed = idCandidate.trim();
      const numeric = Number(trimmed);
      id = Number.isFinite(numeric) ? numeric : trimmed;
    } else {
      id = makeGeneratedId("post");
    }

    const platformRaw = source.platform ?? source.channel ?? source.network;
    const platform = typeof platformRaw === "string" && platformRaw.trim() !== "" ? platformRaw : "facebook";

    const topicRaw = source.topic ?? source.title ?? source.subject ?? "";
    const topic = typeof topicRaw === "string" ? topicRaw : String(topicRaw ?? "");

    const contentRaw = source.content ?? source.body ?? source.caption ?? "";
    let content: string;
    if (typeof contentRaw === "string") {
      content = contentRaw;
    } else if (contentRaw == null) {
      content = "";
    } else {
      try {
        content = JSON.stringify(contentRaw);
      } catch {
        content = String(contentRaw);
      }
    }

    const hashtagsRaw = source.hashtags ?? source.tags ?? [];
    let hashtags: string[] = [];
    if (Array.isArray(hashtagsRaw)) {
      hashtags = hashtagsRaw
        .map((tag) => {
          if (typeof tag === "string") return tag.replace(/^#+/, "").trim();
          if (typeof tag === "number") return String(tag);
          return "";
        })
        .filter((tag) => tag.length > 0);
    } else if (typeof hashtagsRaw === "string") {
      hashtags = hashtagsRaw
        .split(/[,\s]+/)
        .map((tag) => tag.replace(/^#+/, "").trim())
        .filter((tag) => tag.length > 0);
    }

    const imagePromptRaw = source.image_prompt ?? source.imagePrompt;
    const imagePrompt = typeof imagePromptRaw === "string" ? imagePromptRaw : null;

    const imageUrlRaw = source.image_url ?? source.imageUrl;
    const imageUrl = typeof imageUrlRaw === "string" ? imageUrlRaw : null;

    const scheduledAtRaw = source.scheduled_at ?? source.scheduledAt ?? source.publish_at ?? null;
    const scheduledAt = typeof scheduledAtRaw === "string" ? scheduledAtRaw : null;

    const statusRaw = source.status ?? source.approval_status ?? source.approvalStatus;
    const statusValue = typeof statusRaw === "string" ? statusRaw.toLowerCase() : "";
    const allowedStatuses: PendingPost["approvalStatus"][] = ["pending", "approved", "rejected", "draft"];
    const approvalStatus = allowedStatuses.includes(statusValue as PendingPost["approvalStatus"])
      ? (statusValue as PendingPost["approvalStatus"])
      : "pending";

    return {
      id,
      platform,
      topic,
      content,
      hashtags,
      imagePrompt,
      imageUrl: imageUrl ?? undefined,
      scheduledAt,
      approvalStatus,
      postedAt: null,
    };
  }

  function toHistory(post: PendingPost, extras?: Partial<HistoryPost>): HistoryPost {
    return {
      id: post.id,
      platform: post.platform,
      topic: post.topic,
      content: post.content,
      hashtags: post.hashtags,
      imageUrl: post.imageUrl ?? null,
      imagePrompt: post.imagePrompt ?? null,
      scheduledAt: post.scheduledAt ?? null,
      approvalStatus: post.approvalStatus ?? "pending",
      postedAt: post.postedAt ?? null,
      statusNote: null,
      ...(extras ?? {}),
    };
  }

  function normalizeStrategyRow(row: DbStrategyRow): StrategyItem {
    return {
      id: String(row.id ?? `strategy-${Date.now()}`),
      platform: row.platform ?? "Unknown",
      strategyName:
        typeof row.strategy_name === "string" && row.strategy_name.trim().length > 0
          ? row.strategy_name.trim()
          : "Untitled Strategy",
      postingPlan: normalizePlanValues(row.posting_plan),
      postingTimes: normalizeTimeValues(row.best_times_by_day ?? row.posting_times),
      postingCategories: normalizeCategoryValues(row.category_names ?? row.posting_categories),
    };
  }

  function addNewRow() {

    const id = `new-${Date.now()}`;

    const now = new Date();

    const plus1h = new Date(now.getTime() + 3600_000).toISOString();

    const row: PendingPost = {

      id,

      platform: "facebook",

      topic: "",

      content: "",

      hashtags: ["DNAI", "Duhanashrah", "AI"],

      imagePrompt: "",

      imageUrl: "",

      approvalStatus: "draft",

      scheduledAt: plus1h,

      postedAt: null,

    };

    setPending((prev) => [row, ...prev]);

  }



  function isNonEmpty(value?: string | null): boolean {

    return typeof value === "string" && value.trim().length > 0;

  }



  function inferMediaTypeFromUrl(url: string): "image" | "video" {
    const lower = url.toLowerCase();
    if (lower.startsWith("data:video/")) return "video";
    if (lower.startsWith("data:image/")) return "image";
    if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(lower)) return "video";
    return "image";
  }

  function inferVideoMime(url: string): string {
    const lower = url.toLowerCase();
    if (lower.startsWith("data:video/")) {
      const semi = lower.indexOf(';', 11);
      return lower.slice(5, semi > 0 ? semi : undefined);
    }
    if (lower.endsWith('.webm') || lower.includes('.webm?')) return "video/webm";
    if (lower.endsWith('.ogg') || lower.includes('.ogg?')) return "video/ogg";
    if (lower.endsWith('.ogv') || lower.includes('.ogv?')) return "video/ogg";
    if (lower.endsWith('.mov') || lower.includes('.mov?')) return "video/quicktime";
    if (lower.endsWith('.m4v') || lower.includes('.m4v?')) return "video/x-m4v";
    if (lower.endsWith('.webp') || lower.includes('.webp?')) return "image/webp";
    return "video/mp4";
  }

  function inferMediaKind(post: PendingPost): "image" | "video" | null {
    const file = post.imageFile;
    if (file?.type) {
      if (file.type.startsWith("video/")) return "video";
      if (file.type.startsWith("image/")) return "image";
    }
    if (!post.imageUrl) return null;
    return inferMediaTypeFromUrl(post.imageUrl);
  }

  function approvalIssues(post: PendingPost): string[] {

    const issues: string[] = [];

    if (!isNonEmpty(post.topic)) issues.push("Topic");

    if (!isNonEmpty(post.content)) issues.push("Post Content");

    if (!post.hashtags || post.hashtags.length === 0) issues.push("Hashtags");

    if (!post.scheduledAt) issues.push("Scheduling Date & Time");

    // Platform-specific requirements

    const p = (post.platform || "").toLowerCase();

    if (p === "instagram") {

      if (!isNonEmpty(post.imageUrl)) issues.push("Media");

    }

    // For facebook/linkedin image is optional

    return issues;

  }



  function toggleSelect(id: PendingPost["id"]) {

    setSelected((prev) => {

      const next = new Set(prev);

      if (next.has(id)) next.delete(id);

      else next.add(id);

      return next;

    });

  }



  function areAllSelected() {

    if (pending.length === 0) return false;

    return pending.every((p) => selected.has(p.id));

  }



  function toggleSelectAll() {

    const all = areAllSelected();

    if (all) {

      setSelected(new Set());

    } else {

      setSelected(new Set(pending.map((p) => p.id)));

    }

  }



  function ensureUrlProtocol(link: string) {

    if (!link) return "";

    const lower = link.toLowerCase();

    if (lower.startsWith("http://") || lower.startsWith("https://")) {

      return link;

    }

    return `https://${link}`;

  }



  function validateCompetitorLink(link: string, platform: string): string | null {

    const trimmed = link.trim();

    if (!trimmed) return null;

    let url: URL;

    try {

      url = new URL(ensureUrlProtocol(trimmed));

    } catch {

      return "Enter a valid URL (include https://).";

    }

    const allowedDomains = PLATFORM_ALLOWED_DOMAINS[platform] ?? [];

    if (allowedDomains.length === 0) return null;

    const host = url.host.toLowerCase();

    const matches = allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));

    if (!matches) {

      const label = STRATEGY_PLATFORM_OPTIONS.find((opt) => opt.value === platform)?.label ?? platform;

      const example = allowedDomains[0] ? `https://${allowedDomains[0]}/your-handle` : undefined;

      return example ? `Link must be a ${label} URL (e.g., ${example}).` : `Link must be a ${label} URL.`;

    }

    return null;

  }



  function selectStrategyPlatform(value: string) {

    setStrategyPlatform(value);

    setCompetitorLinkErrors(competitorLinks.map((link) => validateCompetitorLink(link, value)));

  }



  function updateCompetitorLink(index: number, value: string) {

    setCompetitorLinks((prev) => prev.map((link, i) => (i === index ? value : link)));

    setCompetitorLinkErrors((prev) => {

      const next = [...prev];

      next[index] = validateCompetitorLink(value, strategyPlatform);

      return next;

    });

  }



  function addCompetitorLinkField() {

    setCompetitorLinks((prev) => [...prev, ""]);

    setCompetitorLinkErrors((prev) => [...prev, null]);

  }



  function removeCompetitorLink(index: number) {
    setCompetitorLinks((prev) => {
      if (prev.length === 1) {
        return [""];
      }
      return prev.filter((_, i) => i !== index);

    });

    setCompetitorLinkErrors((prev) => {

      if (prev.length === 1) {

        return [null];

      }

      return prev.filter((_, i) => i !== index);
    });
  }

  async function reloadStrategies() {
    setStrategyRefreshing(true);
    setStrategyLoadError(null);
    try {
      const rows = await listStrategies();
      setStrategyItems(rows.map(normalizeStrategyRow));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load strategies";
      setStrategyLoadError(message);
    } finally {
      setStrategyRefreshing(false);
    }
  }

  async function triggerGeneratePosts() {
    if (!selectedStrategyId) {
      setGeneratePostsFeedback({ type: "error", message: "Select a strategy before generating posts." });
      return;
    }

    setGeneratePostsFeedback(null);
    setGeneratePostsRawResponse("");
    setGeneratingPosts(true);
    try {
      const response = await fetch(N8N_ENDPOINTS.generatePosts, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generatePostsCount, strategyId: selectedStrategyId }),
      });

      const textBody = await response.text().catch(() => "");
      let parsedBody: unknown = null;
      if (textBody) {
        try {
          parsedBody = JSON.parse(textBody);
        } catch {
          parsedBody = null;
        }
      }

      if (!response.ok) {
        let errorMessage = textBody || `Webhook request failed with status ${response.status}`;
        if (parsedBody && typeof parsedBody === "object" && parsedBody !== null) {
          const info = parsedBody as Record<string, unknown>;
          if (typeof info.message === "string" && info.message.trim() !== "") {
            errorMessage = info.message;
          }
        }
        throw new Error(errorMessage);
      }

      let message = "Post generation triggered.";
      if (parsedBody && typeof parsedBody === "object" && parsedBody !== null) {
        const info = parsedBody as Record<string, unknown>;
        if (typeof info.message === "string" && info.message.trim() !== "") {
          message = info.message;
        }
      } else if (textBody) {
        message = textBody;
      }

      const rawOutput = textBody && textBody.trim().length > 0
        ? textBody
        : parsedBody
        ? JSON.stringify(parsedBody, null, 2)
        : "";
      setGeneratePostsRawResponse(rawOutput);

      const generatedPosts: PendingPost[] = [];
      const pushNormalized = (value: unknown) => {
        const normalized = normalizeGeneratedPost(value);
        if (normalized) generatedPosts.push(normalized);
      };

      if (Array.isArray(parsedBody)) {
        parsedBody.forEach(pushNormalized);
      } else if (parsedBody && typeof parsedBody === "object") {
        const container = parsedBody as Record<string, unknown>;
        const candidates = [container.posts, container.data, container.items];
        candidates.forEach((candidate) => {
          if (Array.isArray(candidate)) candidate.forEach(pushNormalized);
        });
        if (generatedPosts.length === 0) pushNormalized(parsedBody);
      }

      if (generatedPosts.length > 0) {
        setPending((prevPending) => {
          const newIds = new Set(generatedPosts.map((post) => pendingKey(post.id)));
          const remaining = prevPending.filter((post) => !newIds.has(pendingKey(post.id)));
          return [...generatedPosts, ...remaining];
        });

        setHistory((prevHistory) => prevHistory.filter((entry) => !generatedPosts.some((post) => post.id === entry.id)));
      }

      setGeneratePostsFeedback({ type: "success", message });

      try {
        const refreshed = await listPosts();
        setPending(refreshed.map(normalizeFromDb));
      } catch {
        // Ignore refresh errors; user still sees success message
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger post generation";
      setGeneratePostsFeedback({ type: "error", message });
      setGeneratePostsRawResponse(message);
    } finally {
      setGeneratingPosts(false);
    }
  }

  async function generateStrategy() {
    setStrategyFeedback(null);
    setGeneratingStrategy(true);
    if (!canTriggerStrategy) {
      setStrategyFeedback({ type: "error", message: requirementMessage });
      setGeneratingStrategy(false);

      return;

    }



    try {

      const payload = {

        platform: strategyPlatform,

        competitors: sanitizedCompetitorLinks,

        niche: trimmedStrategyNiche,

        goal: trimmedStrategyGoal,

        targetRegion: trimmedStrategyRegion,

      };

      const response = await fetch(N8N_ENDPOINTS.generateStrategy, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(payload),

      });

      const textBody = await response.text();

      if (!response.ok) {

        throw new Error(textBody || `Webhook request failed with status ${response.status}`);

      }

      let message = "Strategy generation triggered.";

      if (textBody) {

        try {

          const data = JSON.parse(textBody) as any;

          if (data && typeof data === "object" && typeof data.message === "string") {

            message = data.message;

          } else {

            message = textBody;

          }

        } catch {

          message = textBody;

        }

      }
      setStrategyFeedback({ type: "success", message });
      void reloadStrategies();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger strategy generation";
      setStrategyFeedback({ type: "error", message });
    } finally {
      setGeneratingStrategy(false);
    }

  }

  async function deleteSelected() {

    const ids = Array.from(selected);

    if (ids.length === 0) return;

    const numericIds = ids.reduce<number[]>((acc, id) => {
      if (typeof id === "number" && Number.isFinite(id)) {
        acc.push(id);
        return acc;
      }
      if (typeof id === "string") {
        if (id.startsWith("new-")) return acc;
        const parsed = Number(id);
        if (Number.isFinite(parsed)) acc.push(parsed);
      }
      return acc;
    }, []);

    // Optimistically remove from UI

    setPending((prev) => prev.filter((p) => !selected.has(p.id)));

    setSelected(new Set());

    if (numericIds.length === 0) return;

    try {

      await deletePosts(numericIds);

    } catch (err) {

      const message = err instanceof Error ? err.message : "Failed to delete posts.";

      setError(message);

      try {

        const refreshed = await listPosts();

        const pendingOnly = refreshed

          .map(normalizeFromDb)

          .filter((post) => (post.approvalStatus ?? "pending") === "pending");

        setPending(pendingOnly);

      } catch {

        // ignore reload failures

      }

    }

  }



  function editHistoryItem(item: HistoryPost) {

    const back: PendingPost = {

      id: item.id,

      platform: item.platform,

      topic: item.topic,

      content: item.content || "",

      hashtags: item.hashtags || [],

      imagePrompt: item.imagePrompt ?? "",

      imageUrl: item.imageUrl ?? "",

      imageFile: null,

      scheduledAt: item.scheduledAt ?? null,

      approvalStatus: (item.approvalStatus as PendingPost["approvalStatus"]) ?? "draft",

      postedAt: null,

    };

    setPending((prev) => [back, ...prev]);

    setHistory((prev) => prev.filter((h) => h.id !== item.id));

    setHistoryDetail(null);

    // Scroll to review section for convenience

    try {

      document.getElementById("review-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch {}

  }

  const selectedPlatformLabel = useMemo(

    () => STRATEGY_PLATFORM_OPTIONS.find((opt) => opt.value === strategyPlatform)?.label ?? "",

    [strategyPlatform]

  );

  const trimmedCompetitorLinks = useMemo(

    () => competitorLinks.map((link) => link.trim()),

    [competitorLinks]

  );

  const validCompetitorLinks = useMemo(

    () => trimmedCompetitorLinks.filter((link, index) => link.length > 0 && !competitorLinkErrors[index]),

    [trimmedCompetitorLinks, competitorLinkErrors]

  );

  const sanitizedCompetitorLinks = useMemo(

    () => validCompetitorLinks.map((link) => ensureUrlProtocol(link)),

    [validCompetitorLinks]

  );

  const trimmedStrategyNiche = strategyNiche.trim();

  const trimmedStrategyGoal = strategyGoal.trim();

  const trimmedStrategyRegion = strategyRegion.trim();

  const canTriggerStrategy =

    sanitizedCompetitorLinks.length > 0 &&

    trimmedStrategyNiche.length > 0 &&

    trimmedStrategyGoal.length > 0 &&

    trimmedStrategyRegion.length > 0;

  const hasAnyCompetitorInput = useMemo(

    () => trimmedCompetitorLinks.some((link) => link.length > 0),

    [trimmedCompetitorLinks]

  );

  const hasAnyStrategyInput = useMemo(

    () =>

      sanitizedCompetitorLinks.length > 0 ||

      trimmedStrategyNiche.length > 0 ||

      trimmedStrategyGoal.length > 0 ||

      trimmedStrategyRegion.length > 0,

    [sanitizedCompetitorLinks, trimmedStrategyNiche, trimmedStrategyGoal, trimmedStrategyRegion]

  );

  const requirementMessage = useMemo(() => {

    const label = STRATEGY_PLATFORM_OPTIONS.find((opt) => opt.value === strategyPlatform)?.label;

    const missingFields: string[] = [];

    if (!trimmedStrategyNiche) missingFields.push('niche');

    if (!trimmedStrategyGoal) missingFields.push('goal');

    if (!trimmedStrategyRegion) missingFields.push('target region');

    const needsCompetitors = sanitizedCompetitorLinks.length === 0;

    if (missingFields.length > 0) {

      const readable = missingFields.length > 1

        ? `${missingFields.slice(0, -1).join(', ')} and ${missingFields.slice(-1)}`

        : missingFields[0];

      return `Please provide ${readable} to continue.`;

    }

    if (needsCompetitors) {

      return label ? `Add at least one valid ${label} profile link to enable generation.` : 'Add at least one competitor link to enable generation.';

    }

    return label ? `Add at least one valid ${label} profile link to enable generation.` : 'Add at least one competitor link to enable generation.';

  }, [strategyPlatform, sanitizedCompetitorLinks, trimmedStrategyNiche, trimmedStrategyGoal, trimmedStrategyRegion]);



  const generateButtonClasses = (!isAccountActive || !canTriggerStrategy || generatingStrategy)

    ? "w-full rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm transition sm:w-auto bg-gradient-to-br from-gray-400 to-gray-500 cursor-not-allowed"

    : "w-full rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm transition sm:w-auto bg-gradient-to-br from-[#C83E39] via-[#623561] to-[#3553AA] hover:brightness-105";

  const feedbackBaseClasses = "mt-3 rounded-md px-3 py-2 text-sm";





  return (

    <div className="min-h-screen bg-[#3A236E] px-3 sm:px-4 md:px-6 lg:px-8 pb-8 sm:pb-12 text-[#f3eff9] safe-area-inset-x">

      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 lg:space-y-10">

        {/* App Header */}

        <header className="sticky top-0 z-50 bg-[#3A236E] pt-2 sm:pt-0">

          <nav className="flex items-center justify-between rounded-full border border-[#623561]/40 bg-[#2A194D] px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm font-medium text-[#f3eff9] shadow-xl">

            <div className="flex items-center gap-2 sm:gap-4 min-w-0">

              <div className="flex items-center gap-1 sm:gap-2 rounded-full bg-[#C83E39]/20 px-2 sm:px-3 py-1 text-base font-bold tracking-wide text-[#f3eff9] flex-shrink-0">

                <span className="text-lg sm:text-2xl font-black">DNAI</span>

                <span className="hidden lg:block text-xs uppercase tracking-[0.2em] text-[#C9C2D4]">Social Pulse Intelligence</span>

              </div>

              <div className="hidden lg:flex items-center gap-2 xl:gap-4">

                {[
                  { label: "Strategies Hub", target: "#competitor-strategy-heading" },
                  { label: "Posting Point", target: "#review-heading" },
                  { label: "History", target: "#history-heading" },
                  { label: "Analytics Assistant", target: "#summary-heading" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.target}
                    className="rounded-full px-2 xl:px-3 py-1 text-xs xl:text-sm transition hover:bg-[#C83E39]/25 whitespace-nowrap"
                  >
                    {item.label}
                  </a>
                ))}

              </div>

            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">

              <button className="hidden md:block rounded-full px-2 xl:px-3 py-1 text-xs xl:text-sm transition hover:bg-[#C83E39]/25" type="button">
                Contact Us
              </button>

              <button className="hidden md:block rounded-full px-2 xl:px-3 py-1 text-xs xl:text-sm transition hover:bg-[#C83E39]/25" type="button">
                Logout
              </button>

              <div className="lg:hidden">
                <button className="rounded-full bg-[#C83E39] px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold text-white shadow touch-target-sm" type="button">
                  Menu
                </button>
              </div>

            </div>

          </nav>
        </header>

        <section className="overflow-hidden rounded-2xl sm:rounded-3xl border border-[#623561]/40 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
          <div className="relative min-h-[16rem] sm:min-h-[20rem] md:min-h-[26rem] lg:min-h-[30rem] w-full overflow-hidden bg-[#2A194D]">
            <video
              className="h-full w-full object-cover sm:object-contain object-center opacity-80"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/cover.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-[#3A236E]/90 via-[#623561]/70 to-transparent px-4 sm:px-6 md:px-12 py-6 sm:py-10">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-bold text-white leading-tight">DNAI Command Center</h1>
              <p className="mt-2 sm:mt-4 max-w-2xl text-sm sm:text-base text-[#FDF7FF]/85 line-clamp-3 sm:line-clamp-none">
                Track, generate, and orchestrate your social voice with intelligent strategies, guided analytics, and seamless publish pipelines.
              </p>
            </div>
          </div>
        </section>


        {/* Review & Approve (Editable Table) */}

        <section aria-labelledby="review-heading" className="mb-4 sm:mb-6">

          <h2 id="review-heading" className="mb-3 sm:mb-4">

            <span className="badge-title inline-flex items-center rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base font-semibold shadow-sm">

              Review & Approve Posts

            </span>

          </h2>

          <div className="mb-3 space-y-3">

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-2 sm:gap-3">

              <div className="text-xs sm:text-sm text-[#2b1b4a]/80">Select rows to delete, or edit and approve.</div>

              <div className="flex items-center gap-2 w-full sm:w-auto">

                <button

                  onClick={deleteSelected}

                  disabled={selected.size === 0}

                  className="flex-1 sm:flex-none rounded-md border border-[#3553AA] bg-[rgba(201,194,212,0.9)] px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[#130b27] transition hover:bg-[rgba(201,194,212,0.75)] disabled:cursor-not-allowed disabled:opacity-60"

                  title={selected.size ? `Delete ${selected.size} selected` : "No items selected"}

                >

                  Delete Selected

                </button>

                <button

                  onClick={addNewRow}

                  className="flex-1 sm:flex-none btn-primary rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"

                >

                  + Add Post

                </button>

              </div>

            </div>

            <div className="accent-surface flex flex-wrap items-end gap-2 sm:gap-3 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3">

              <div className="flex flex-col">

                <label className="text-xs font-semibold text-[#2b1b4a]/80" htmlFor="generate-post-count">Posts</label>

                <select

                  id="generate-post-count"

                  value={generatePostsCount}

                  onChange={(e) => { setGeneratePostsCount(Number(e.target.value)); setGeneratePostsFeedback(null); }}

                  className="mt-1 rounded-md border border-[#3553AA]/45 bg-white px-2 py-1.5 text-sm text-[#130b27] focus:outline-none focus:ring-2 focus:ring-[#3553AA]/40"

                >

                  {postCountOptions.map((count) => (

                    <option key={count} value={count}>{count}</option>

                  ))}

                </select>

              </div>

              <div className="flex min-w-[200px] flex-1 flex-col">

                <label className="text-xs font-semibold text-[#2b1b4a]/80" htmlFor="generate-post-strategy">Strategy</label>

                <select

                  id="generate-post-strategy"

                  value={selectedStrategyId ?? ""}

                  onChange={(e) => {
                    setSelectedStrategyId(e.target.value ? e.target.value : null);
                    setGeneratePostsFeedback(null);
                  }}

                  disabled={strategyItems.length === 0 || generatingPosts}

                  className="mt-1 rounded-md border border-[#3553AA]/45 bg-white px-2 py-1.5 text-sm text-[#130b27] focus:outline-none focus:ring-2 focus:ring-[#3553AA]/40 disabled:cursor-not-allowed disabled:bg-[rgba(201,194,212,0.45)]"

                >

                  {strategyItems.length === 0 ? (

                    <option value="">No strategies available</option>

                  ) : (

                    strategySelectOptions.map((option) => (

                      <option key={option.id} value={option.id}>{option.label}</option>

                    ))

                  )}

                </select>

              </div>

              <button

                type="button"

                onClick={triggerGeneratePosts}

                disabled={!isAccountActive || !canGeneratePosts || generatingPosts}

                className="btn-primary rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"

                title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}

              >

                {generatingPosts ? "Generating..." : "Generate Posts"}

              </button>

            </div>

            {generatePostsFeedback && (

              <div

                className={`rounded-md px-3 py-2 text-sm ${

                  generatePostsFeedback.type === "success"

                    ? "bg-[#d5f2e7] text-[#1f6b4e]"

                    : "bg-[#fde1e1] text-[#8c1f26]"

                }`}

              >

                {generatePostsFeedback.message}

              </div>

            )}

            {generatePostsRawResponse && generatePostsRawResponse.trim().length > 0 && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#3553AA]/30 bg-[#f3f1f7] px-3 py-2 text-xs text-[#35255c]">
                {generatePostsRawResponse}
              </pre>
            )}

          </div>


          {error && (

            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">

              {error}

            </div>

          )}

          {loading ? (

            <div className="panel-shell h-32 sm:h-48 animate-pulse bg-transparent" />

          ) : (

            <div className="panel-shell p-0">

              <div className="overflow-x-auto -mx-3 sm:mx-0">

              <table className="min-w-[960px] w-full text-left text-xs sm:text-sm text-[#2b1b4a]">

                <thead className="sticky top-0 bg-[#C9C2D4] text-[#2b1b4a]/80">

                  <tr className="[&>th]:px-4 [&>th]:py-3">

                    <th>

                      <label className="inline-flex items-center gap-2 text-sm text-[#2b1b4a]/85">

                        <input

                          type="checkbox"

                          className="size-4 rounded border-[#3553AA]/45 text-[#3553AA] focus:ring-[#3553AA]"

                          checked={areAllSelected()}

                          onChange={toggleSelectAll}

                        />

                        Platform

                      </label>

                    </th>

                    <th>Topic</th>

                    <th>Post Content</th>

                    <th>Hashtags</th>
                    <th>Media</th>

                    <th>Scheduling Date & Time</th>

                    <th className="text-right">Actions</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-[#739EC9]/25">

                  {pending.length === 0 ? (

                    <tr>

                      <td colSpan={7} className="px-4 py-6 text-center text-[#2b1b4a]/60">

                        No pending posts. You're all caught up!

                      </td>

                    </tr>

                  ) : (

                    pending.map((post) => (

                      <tr key={post.id} className="align-top [&>td]:px-4 [&>td]:py-3">

                        <td className="min-w-[180px]">

                          <div className="relative flex items-center gap-2" data-platform-menu>

                            <input

                              type="checkbox"

                              className="size-4 rounded border-[#3553AA]/45 text-[#3553AA] focus:ring-[#3553AA]"

                              checked={selected.has(post.id)}

                              onChange={() => toggleSelect(post.id)}

                              aria-label={`Select ${post.topic || "post"}`}

                            />

                            <button

                              type="button"

                              data-platform-toggle

                              onClick={() => setOpenPlatformFor((v) => (v === post.id ? null : post.id))}

                              className="rounded-md focus:outline-none hover:ring-2 ring-[#3553AA]/40 transition"

                              title="Change platform"

                            >

                              <PlatformBadge platform={post.platform} />

                            </button>

                            {openPlatformFor === post.id && (

                              <div className="absolute left-0 top-8 z-20 w-44 overflow-hidden rounded-md border border-gray-200 bg-white/95 text-gray-800 shadow-lg backdrop-blur-sm">

                                {(

                                  [

                                    ["facebook", "Facebook"],

                                    ["instagram", "Instagram"],

                                    ["linkedin", "LinkedIn"],

                                    ["twitter", "Twitter/X"],

                                  ] as const

                                ).map(([val, label]) => (

                                  <button

                                    key={val}

                                    onClick={() => {

                                      updatePost(post.id, { platform: val });

                                      setOpenPlatformFor(null);

                                    }}

                                    className={`block w-full px-3 py-2 text-left text-sm text-[#2b1b4a] hover:bg-[rgba(201,194,212,0.45)] ${

                                      post.platform === val ? "bg-[rgba(200,62,57,0.12)] text-[#C83E39] font-medium" : ""

                                    }`}

                                  >

                                    {label}

                                  </button>

                                ))}

                              </div>

                            )}

                          </div>

                        </td>

                        <td className="min-w-[180px]">

                          <input

                            type="text"

                            value={post.topic}

                            onChange={(e) => updatePost(post.id, { topic: e.target.value })}

                            className="w-full rounded-md border border-gray-300 bg-white/90 px-2.5 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                            placeholder="Enter topic"

                          />

                        </td>

                        <td className="min-w-[260px]">

                          <textarea

                            value={post.content}

                            onChange={(e) => updatePost(post.id, { content: e.target.value })}

                            rows={3}

                            className="w-full resize-y rounded-md border border-gray-300 bg-white/90 px-2.5 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                            placeholder="Write the post content..."

                          />

                        </td>

                        <td className="min-w-[260px] align-top">

                          <TagInput

                            tags={post.hashtags ?? []}

                            onChange={(tags) => updatePost(post.id, { hashtags: tags })}

                            placeholder="#DNAI  #Duhanashrah  #AI"

                            className="h-[80px] overflow-y-auto resize-y"

                          />

                        </td>
                        <td className="min-w-[280px] align-top">

                          <div className="relative flex items-center gap-2" data-link-menu>

                            <input

                              id={`file-${post.id}`}

                              type="file"

                              accept="image/*,video/*"

                              className="hidden"

                              onChange={(e) => {

                                const file = e.target.files?.[0] || null;

                                if (file) {

                                  const url = URL.createObjectURL(file);

                                  updatePost(post.id, { imageFile: file, imageUrl: url });

                                }

                              }}

                            />

                            <label htmlFor={`file-${post.id}`} className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50">

                              Upload Media



                            </label>

                            <button

                              type="button"

                              data-link-toggle

                              onClick={() => setOpenLinkFor((v) => (v === post.id ? null : post.id))}

                              className="rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50"

                            >

                              Link

                            </button>

                            {openLinkFor === post.id && (

                              <div className="absolute z-20 mt-32 w-[340px] overflow-hidden rounded-md border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur-sm">

                                <input

                                  type="url"

                                  autoFocus

                                  value={post.imageUrl ?? ""}

                                  onChange={(e) => updatePost(post.id, { imageUrl: e.target.value })}

                                  onKeyDown={(e) => {

                                    if (e.key === 'Enter') setOpenLinkFor(null);

                                    if (e.key === 'Escape') setOpenLinkFor(null);

                                  }}

                                  placeholder="Paste media URL and press Enter"

                                  className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                                />

                                <div className="mt-2 flex justify-end gap-2">

                                  <button onClick={() => setOpenLinkFor(null)} className="rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100">Close</button>

                                </div>

                              </div>

                            )}

                            <button

                              type="button"

                              disabled={!post.imageUrl}

                              onClick={() => {
                                if (!post.imageUrl) return;
                                const kind = inferMediaKind(post);
                                if (!kind) return;
                                setViewer({ kind, src: post.imageUrl, mime: post.imageFile?.type });
                              }}

                              className="rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-60"

                            >

                              View

                            </button>

                          </div>



                        </td>

                        {/* Status column removed as requested */}

                        <td className="min-w-[210px]">

                          <input

                            type="datetime-local"

                            value={toLocalInput(post.scheduledAt)}

                            onChange={(e) => updatePost(post.id, { scheduledAt: fromLocalInput(e.target.value) })}

                            className="w-full rounded-md border border-gray-300 bg-white/90 px-2.5 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                          />

                        </td>

                        <td className="min-w-[200px] text-right">

                          <div className="flex justify-end gap-2">

                            <button

                              onClick={() => savePost(post.id)}

                              disabled={acting === post.id}

                              className="rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-60"

                            >

                              {acting === post.id ? "Drafting..." : "Draft"}

                            </button>

                            <button

                              onClick={() => handleAction(post.id, "reject")}

                              disabled={acting === post.id}

                              className="rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:opacity-60"

                            >

                              Reject

                            </button>

                            <button

                              onClick={() => {

                                const issues = approvalIssues(post);

                                if (issues.length) {

                                  alert(`Please fill required fields before approval: ${issues.join(", ")}`);

                                  return;

                                }

                                handleAction(post.id, "approve");

                              }}

                              disabled={acting === post.id || approvalIssues(post).length > 0}

                              title={approvalIssues(post).length ? `Missing: ${approvalIssues(post).join(", ")}` : undefined}

                              className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"

                            >

                              Approve

                            </button>

                          </div>

                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          </div>

          )}

        </section>

        {/* Posting History (Read-only) */}

        <section aria-labelledby="history-heading" className="mb-10">

          <h2 id="history-heading" className="mb-4">

            <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#C9C2D4] via-[#E4DFF0] to-[#f3eff9] px-4 py-2 text-base font-semibold text-[#2b1b4a] ring-1 ring-inset ring-[#623561]/30">Posting History</span>

          </h2>

          <div className="overflow-x-auto rounded-2xl border border-white/20 bg-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">

            <table className="min-w-[760px] w-full text-left text-sm">

              <thead className="sticky top-0 bg-white/90 text-gray-600">

                <tr className="[&>th]:px-4 [&>th]:py-3">

                  <th>Platform</th>

                  <th>Topic</th>

                  <th>Status</th>

                  <th>Scheduled At</th>

                  <th>Posted At</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-100/70">

                {history.length === 0 ? (

                  <tr>

                    <td colSpan={5} className="px-4 py-6 text-center text-gray-600">No history yet.</td>

                  </tr>

                ) : (

                  history.map((h) => (

                    <tr

                      key={h.id}

                      className="cursor-pointer hover:bg-gray-50 [&>td]:px-4 [&>td]:py-3"

                      onClick={() => setHistoryDetail(h)}

                    >

                      <td className="min-w-[140px]"><PlatformBadge platform={h.platform} /></td>

                      <td className="max-w-[340px] truncate text-gray-900">

                        {h.topic}

                        {(h.approvalStatus === 'draft' || h.approvalStatus === 'rejected') && (

                          <button

                            onClick={(e) => { e.stopPropagation(); editHistoryItem(h); }}

                            className="ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-[#3553AA] hover:underline"

                            title="Edit this post"

                          >

                            Edit

                          </button>

                        )}

                      </td>

                      <td className="text-[#2b1b4a]">

                        <div className="font-medium capitalize">{h.approvalStatus || 'approved'}</div>

                        {h.statusNote && (

                          <div className="text-xs text-[#3553AA]">{h.statusNote}</div>

                        )}

                      </td>

                      <td className="text-gray-700">{h.scheduledAt ? new Date(h.scheduledAt).toLocaleString() : '—'}</td>

                      <td className="text-[#2b1b4a]/70">{h.postedAt ? new Date(h.postedAt).toLocaleString() : 'Pending publish'}</td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </section>

        

        {/* Competitors Based Strategy Generation */}

        <section aria-labelledby="competitor-strategy-heading" className="mb-10">

          <h2 id="competitor-strategy-heading" className="mb-4">

            <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#C9C2D4] via-[#E4DFF0] to-[#f3eff9] px-4 py-2 text-base font-semibold text-[#2b1b4a] ring-1 ring-inset ring-[#623561]/30">Competitors Based Strategy Generation</span>

          </h2>

          <div className="rounded-2xl border border-white/20 bg-white/70 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">

            <div className="mb-6">

              <div className="mb-1 text-sm font-medium text-gray-900">Platforms</div>

              <p className="text-xs text-[#3a236e]/70">Select the channels you want to tailor the playbook for.</p>

              <div className="mt-3 flex flex-wrap gap-2">

                {STRATEGY_PLATFORM_OPTIONS.map((option) => {

                  const active = strategyPlatform === option.value;

                  return (

                    <button

                      key={option.value}

                      type="button"

                      onClick={() => selectStrategyPlatform(option.value)}

                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? "bg-gradient-to-r from-[#C83E39] via-[#623561] to-[#3553AA] text-white shadow" : "bg-[rgba(201,194,212,0.45)] text-[#2b1b4a] ring-1 ring-inset ring-[#623561]/30 hover:ring-[#3553AA]/40 hover:text-[#3553AA]"}`}

                    >

                      {option.label}

                    </button>

                  );

                })}

              </div>

              <div className="mt-2 text-xs text-[#3a236e]/70">

                {selectedPlatformLabel ? `Selected: ${selectedPlatformLabel}` : "Select a platform"}

              </div>

            </div>

            <div>

              <div className="mb-1 text-sm font-medium text-gray-900">Competitor Profiles</div>

              <p className="text-xs text-[#3a236e]/70">Add profile URLs your team wants to monitor for inspiration.</p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">

                <div>

                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor="strategy-niche">Niche</label>

                  <input

                    id="strategy-niche"

                    type="text"

                    value={strategyNiche}

                    onChange={(e) => setStrategyNiche(e.target.value)}

                    placeholder="Real estate, SaaS, BPO"

                    className="w-full rounded-md border border-gray-300 bg-white/90 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                  />

                </div>

                <div>

                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor="strategy-goal">Goal</label>

                  <input

                    id="strategy-goal"

                    type="text"

                    value={strategyGoal}

                    onChange={(e) => setStrategyGoal(e.target.value)}

                    placeholder="Lead gen, awareness, community"

                    className="w-full rounded-md border border-gray-300 bg-white/90 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                  />

                </div>

                <div>

                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor="strategy-region">Target Audience Region</label>

                  <input

                    id="strategy-region"

                    type="text"

                    value={strategyRegion}

                    onChange={(e) => setStrategyRegion(e.target.value)}

                    placeholder="North America, GCC, APAC"

                    className="w-full rounded-md border border-gray-300 bg-white/90 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                  />

                </div>

              </div>

              <div className="mt-3 space-y-3">

                {competitorLinks.map((link, index) => (

                  <div key={index} className="space-y-1">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                      <input

                        type="url"

                        value={link}

                        onChange={(e) => updateCompetitorLink(index, e.target.value)}

                        placeholder="https://www.instagram.com/competitor"

                        className="w-full rounded-md border border-gray-300 bg-white/90 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3553AA]/35"

                      />

                      <button

                        type="button"

                        onClick={() => removeCompetitorLink(index)}

                        className="rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50"

                      >

                        Remove

                      </button>

                    </div>

                    {competitorLinkErrors[index] && (

                      <p className="text-xs text-[#8c1f26]">{competitorLinkErrors[index]}</p>

                    )}

                  </div>

                ))}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <button

                    type="button"

                    onClick={addCompetitorLinkField}

                    className="w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 sm:w-auto"

                  >

                    + Add another profile

                  </button>

                  <button

                    type="button"

                    onClick={generateStrategy}

                    disabled={!isAccountActive || !canTriggerStrategy || generatingStrategy}

                    className={generateButtonClasses}
                    title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}

                  >

                    {generatingStrategy ? "Generating..." : "Generate Strategy"}

                  </button>

                </div>

                {strategyFeedback && (

                  <div className={feedbackBaseClasses + " " + (strategyFeedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>

                    {strategyFeedback.message}

                  </div>

                )}

                {!canTriggerStrategy && hasAnyStrategyInput && (

                  <p className="text-xs text-[#8c1f26]">{requirementMessage}</p>

                )}

              </div>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#f3eff9]">Strategy Library</h3>
                <button
                  type="button"
                  onClick={reloadStrategies}
                  disabled={strategyRefreshing}
                  className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-800 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {strategyRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              {strategyLoadError && (
                <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {strategyLoadError}
                </div>
              )}
              <div className="overflow-hidden rounded-lg border border-[#623561]/25 bg-[rgba(201,194,212,0.45)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr className="[&>th]:px-4 [&>th]:py-3">
                      <th className="w-[220px] text-left font-medium">Strategy Name</th>
                      <th className="w-[140px] text-left font-medium">Platform</th>
                      <th className="text-left font-medium">Posting Plan</th>
                      <th className="text-left font-medium">Posting Times</th>
                      <th className="text-left font-medium">Posting Categories</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/70">
                    {strategyItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-[#3a236e]/70">
                          {strategyLoadError ? "Unable to load strategies." : "No strategies available yet."}
                        </td>
                      </tr>
                    ) : (
                      strategyItems.map((item) => (
                        <tr key={item.id} className="[&>td]:align-top [&>td]:px-4 [&>td]:py-3 hover:bg-gray-50">
                          <td className="font-semibold text-[#2b1b4a]">{item.strategyName}</td>
                          <td>
                            <PlatformBadge platform={item.platform} />
                          </td>
                          <td>
                            <StrategyValue value={item.postingPlan} />
                          </td>
                          <td>
                            <StrategyValue value={item.postingTimes} />
                          </td>
                          <td>
                            <StrategyValue value={item.postingCategories} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>

          </div>

        </section>



        {/* Summary */}

        <section aria-labelledby="summary-heading" className="mb-6 sm:mb-10">

          <h2 id="summary-heading" className="mb-3 sm:mb-4">

            <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#C9C2D4] via-[#E4DFF0] to-[#f3eff9] px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base font-semibold text-[#2b1b4a] ring-1 ring-inset ring-[#623561]/30">Summary</span>

          </h2>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">

            {/* Engagement Overview */}

            <div className="rounded-xl sm:rounded-2xl border border-white/20 bg-white/60 p-4 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">

              <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">

                <h3 className="font-medium text-gray-900 text-sm sm:text-base">Engagement Overview</h3>

                {typeof analytics?.engagementRate === "number" && (

                  <span className="text-xs sm:text-sm text-[#C9C2D4]">{analytics.engagementRate}% avg</span>

                )}

              </div>

              <div className="mb-3 sm:mb-4 grid grid-cols-3 gap-2 sm:gap-3 text-center">

                <Metric label="Posts" value={analytics?.posts ?? 0} />

                <Metric label="Impressions" value={analytics?.impressions ?? 0} />

                <Metric label="Growth" value={`${analytics?.growth ?? 0}%`} positive={((analytics?.growth ?? 0) as number) >= 0} />

              </div>

              {/* Simple sparkline bars */}

              <div className="flex items-end gap-1 sm:gap-1.5 overflow-x-auto pb-1">

                {spark.map((v, i) => (

                  <div

                    key={i}

                    className="w-1.5 sm:w-2 rounded bg-gradient-to-t from-[#3553AA] to-[#C83E39] flex-shrink-0"

                    style={{ height: Math.max(4, Math.min(48, v * 2)) }}

                    aria-hidden

                  />

                ))}

              </div>

            </div>

            {/* Platform Breakdown */}

            <div className="rounded-xl sm:rounded-2xl border border-white/20 bg-white/60 p-4 sm:p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">

              <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">

                <h3 className="font-medium text-gray-900 text-sm sm:text-base">Platform Breakdown</h3>

                <span className="text-xs sm:text-sm text-[#C9C2D4]">Share of engagement</span>

              </div>

              <div className="space-y-2 sm:space-y-3">

                {(analytics?.platformBreakdown ?? [

                  { name: "Twitter", value: 42 },

                  { name: "Instagram", value: 33 },

                  { name: "LinkedIn", value: 25 },

                ]).map((row) => (

                  <div key={row.name} className="grid grid-cols-[80px_1fr_40px] sm:grid-cols-[120px_1fr_auto] items-center gap-2 sm:gap-3 text-xs sm:text-sm">

                    <div className="text-gray-700">{row.name}</div>

                    <div className="h-2 rounded bg-gray-200">

                      <div

                        className="h-2 rounded bg-gradient-to-r from-[#3553AA] to-[#C83E39]"

                        style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}

                      />

                    </div>

                    <div className="tabular-nums text-gray-700">{row.value}%</div>

                  </div>

                ))}

              </div>

            </div>

          </div>

        </section>

        {/* Previous Analytics (Per Post) */}

        <section aria-labelledby="per-post-heading" className="mb-10">

          <h2 id="per-post-heading" className="mb-4">

            <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#C9C2D4] via-[#E4DFF0] to-[#f3eff9] px-4 py-2 text-base font-semibold text-[#2b1b4a] ring-1 ring-inset ring-[#623561]/30">Previous Analytics (Per Post)</span>

          </h2>

          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">

            <div className="max-h-[380px] overflow-auto">

              <table className="min-w-full text-left text-sm">

                <thead className="sticky top-0 bg-white/90 text-gray-600">

                  <tr className="[&>th]:px-4 [&>th]:py-3">

                    <th>Platform</th>

                    <th>Topic</th>

                    <th>Posted</th>

                    <th className="text-right">Impressions</th>

                    <th className="text-right">Likes</th>

                    <th className="text-right">Comments</th>

                    <th className="text-right">Shares</th>

                    <th className="text-right">Eng. Rate</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100/70">

                  {postAnalytics.map((p) => (

                    <tr key={p.id} className="[&>td]:px-4 [&>td]:py-3">

                      <td>

                        <div className="flex items-center gap-2">

                          <PlatformBadge platform={p.platform} />

                        </div>

                      </td>

                      <td className="max-w-[280px] truncate text-gray-900">{p.topic}</td>

                      <td className="text-gray-600">{new Date(p.postedAt).toLocaleString()}</td>

                      <td className="text-right tabular-nums">{(p.impressions ?? 0).toLocaleString()}</td>

                      <td className="text-right tabular-nums">{(p.likes ?? 0).toLocaleString()}</td>

                      <td className="text-right tabular-nums">{(p.comments ?? 0).toLocaleString()}</td>

                      <td className="text-right tabular-nums">{(p.shares ?? 0).toLocaleString()}</td>

                      <td className="text-right tabular-nums">{typeof p.engagementRate === "number" ? `${p.engagementRate.toFixed(1)}%` : "—"}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </section>

        {/* Platform Trends */}

        <section aria-labelledby="trends-heading" className="mb-10">

          <h2 id="trends-heading" className="mb-4">

            <span className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#C9C2D4] via-[#E4DFF0] to-[#f3eff9] px-4 py-2 text-base font-semibold text-[#2b1b4a] ring-1 ring-inset ring-[#623561]/30">Platform Trends</span>

          </h2>

          <div className="grid gap-4 md:grid-cols-3">

            {(["facebook", "instagram", "linkedin"] as const).map((platform) => (

              <PlatformTrendCard

                key={platform}

                platform={platform}

                series={seriesByPlatform[platform] ?? []}

                makePath={linePathForSeries}

              />

            ))}

          </div>

        </section>

        {/* Media Viewer Modal */}

        {viewer && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setViewer(null)}
          >
            <div
              className="relative w-full max-w-[90vw] md:max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-sm text-gray-900 shadow ring-1 ring-gray-300 hover:bg-white"
                aria-label="Close viewer"
              >
                Close
              </button>
              {viewer.kind === "video" ? (
                <video
                  className="h-auto w-full max-h-[75vh] rounded-lg bg-black object-contain shadow-2xl"
                  controls
                  autoPlay
                  playsInline
                >
                  <source src={viewer.src} type={viewerSourceType ?? "video/mp4"} />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewer.src}
                    alt="Full image"
                    className="h-auto w-full max-h-[75vh] rounded-lg bg-white object-contain shadow-2xl"
                  />
                </>
              )}
            </div>
          </div>
        )}


        {/* History Detail Modal */}        {/* History Detail Modal */}

        {historyDetail && (

          <div

            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"

            onClick={() => setHistoryDetail(null)}

          >

            <div

              className="relative w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"

              onClick={(e) => e.stopPropagation()}

            >

              <div className="mb-4 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <PlatformBadge platform={historyDetail.platform} />

                  {historyDetail.approvalStatus && (

                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700 ring-1 ring-inset ring-gray-200">

                      {historyDetail.approvalStatus}

                    </span>

                  )}

                  {historyDetail.statusNote && (

                    <span className="rounded-md bg-[#C9C2D4]/60 px-2 py-0.5 text-xs text-[#3553AA]">

                      {historyDetail.statusNote}

                    </span>

                  )}

                </div>

                <div className="flex items-center gap-2">

                  {(historyDetail.approvalStatus === 'draft' || historyDetail.approvalStatus === 'rejected') && (

                    <button

                      type="button"

                      onClick={() => editHistoryItem(historyDetail)}

                      className="rounded-md bg-gradient-to-br from-[#C83E39] via-[#623561] to-[#3553AA] px-3 py-1.5 text-sm font-medium text-white shadow-sm"

                    >

                      Edit

                    </button>

                  )}

                  <button

                    type="button"

                    onClick={() => setHistoryDetail(null)}

                    className="rounded-md bg-white/90 px-2 py-1 text-sm text-[#2b1b4a] shadow ring-1 ring-[#623561]/30 hover:bg-white"

                  >

                    Close

                  </button>

                </div>

              </div>

              <h3 className="mb-2 text-lg font-semibold text-[#2b1b4a]">{historyDetail.topic}</h3>

              <div className="mb-3 grid gap-3 md:grid-cols-2">

                <div>

                  <div className="text-xs text-[#3a236e]/70">Scheduled At</div>

                  <div className="text-sm text-gray-800">{historyDetail.scheduledAt ? new Date(historyDetail.scheduledAt).toLocaleString() : "—"}</div>

                </div>

                <div>

                  <div className="text-xs text-[#3a236e]/70">Posted At</div>

                  <div className="text-sm text-gray-800">{historyDetail.postedAt ? new Date(historyDetail.postedAt).toLocaleString() : "—"}</div>

                </div>

              </div>

              {historyDetail.imageUrl && (
                <div className="mb-3 overflow-hidden rounded-lg ring-1 ring-gray-200">
                  {historyMediaKind === "video" ? (
                    <video
                      className="h-full w-full max-h-[60vh] bg-black object-contain"
                      controls
                      playsInline
                    >
                      <source src={historyDetail.imageUrl} type={inferVideoMime(historyDetail.imageUrl)} />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={historyDetail.imageUrl}
                        alt="Post media"
                        className="max-h-[60vh] w-full object-contain"
                      />
                    </>
                  )}
                </div>
              )}

              {historyDetail.content && (

                <p className="mb-3 text-sm text-gray-900">{historyDetail.content}</p>

              )}

              {historyDetail.hashtags && historyDetail.hashtags.length > 0 && (

                <div className="mb-2 flex flex-wrap gap-2">

                  {historyDetail.hashtags.map((h) => (

                    <span

                      key={h}

                      className="rounded-full bg-[#C9C2D4]/40 px-2.5 py-1 text-xs text-[#3553AA] ring-1 ring-inset ring-[#3553AA]/25"

                    >

                      #{h}

                    </span>

                  ))}

                </div>

              )}            </div>

          </div>

        )}

          

      </div>

    </div>

  );

}

function Metric({ label, value, positive = true }: { label: string; value: number | string; positive?: boolean }) {

  return (

    <div className="rounded-xl bg-[rgba(201,194,212,0.45)] p-3 ring-1 ring-inset ring-[#623561]/25">

      <div className="text-[11px] uppercase tracking-wide text-[#3a236e]/70">{label}</div>

      <div className="mt-1 text-lg font-semibold text-[#2b1b4a]">{value}</div>

      <div className={`text-[11px] ${positive ? "text-[#1f6b4e]" : "text-[#8c1f26]"}`}>{positive ? "▲" : "▼"} {positive ? "+" : "-"}{typeof value === "number" ? Math.abs(Number(value)).toLocaleString() : ""}</div>

    </div>

  );

}

function PlatformBadge({ platform }: { platform: string }) {

  const map: Record<string, { label: string; color: string }> = {

    instagram: { label: "Instagram", color: "bg-[#623561]/15 text-[#623561] ring-[#623561]/30" },

    linkedin: { label: "LinkedIn", color: "bg-[#3553AA]/15 text-[#3553AA] ring-[#3553AA]/30" },

    facebook: { label: "Facebook", color: "bg-[#C83E39]/15 text-[#C83E39] ring-[#C83E39]/30" },

  };

  const meta = map[platform?.toLowerCase?.()] ?? { label: platform, color: "bg-[#C9C2D4]/30 text-[#2b1b4a] ring-[#3A236E]/20" };

  return <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${meta.color}`}>{meta.label}</span>;

}

function PlatformTrendCard({

  platform,

  series,

  makePath,

}: {

  platform: string;

  series: number[];

  makePath: (s: number[], w?: number, h?: number, p?: number) => string;

}) {

  const path = makePath(series, 260, 72, 8);

  const title = platform.charAt(0).toUpperCase() + platform.slice(1);

  return (

    <div className="panel-shell p-5">

      <div className="mb-3 flex items-center justify-between">

        <div className="flex items-center gap-2">

          <PlatformBadge platform={platform} />

          <h3 className="font-medium text-[#2b1b4a]">{title}</h3>

        </div>

        <span className="text-xs text-[#3a236e]/70">Last 12 periods</span>

      </div>

      <svg viewBox="0 0 260 72" className="h-16 w-full">

        <defs>

          <linearGradient id={`grad-${platform}`} x1="0" x2="0" y1="0" y2="1">

            <stop offset="0%" stopColor="#3553AA" stopOpacity="0.65" />

            <stop offset="100%" stopColor="#C83E39" stopOpacity="0.35" />

          </linearGradient>

        </defs>

        <rect x="0" y="0" width="260" height="72" rx="14" fill={`url(#grad-${platform})`} opacity="0.2" />

        <path d={path} fill="none" stroke={`url(#grad-${platform})`} strokeWidth="2" />

      </svg>

    </div>

  );

}

function TagInput({

  tags,

  onChange,

  placeholder,

  className,

}: {

  tags: string[];

  onChange: (next: string[]) => void;

  placeholder?: string;

  className?: string;

}) {

  const [value, setValue] = useState("");

  function commitToken(raw: string) {

    let t = raw.trim();

    if (!t) return;

    t = t.replace(/^#+/, "");

    if (!t) return;

    if (tags.includes(t)) {

      setValue("");

      return;

    }

    onChange([...tags, t]);

    setValue("");

  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {

    if (e.key === "Enter" || e.key === "," || e.key === " ") {

      e.preventDefault();

      commitToken(value);

    } else if (e.key === "Backspace" && value === "" && tags.length > 0) {

      // Remove last tag

      onChange(tags.slice(0, -1));

    }

  }

  return (

    <div className={`min-h-[42px] w-full rounded-md border border-[#3553AA]/30 bg-[rgba(201,194,212,0.35)] px-2.5 py-1.5 text-sm text-[#2b1b4a] focus-within:ring-2 focus-within:ring-[#3553AA]/40 ${className ?? ""}`}>

      <div className="flex flex-wrap items-center gap-2">

        {tags.map((t) => (

          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#3553AA]/15 px-2 py-0.5 text-xs text-[#3553AA] ring-1 ring-inset ring-[#3553AA]/30">

            #{t}

            <button

              type="button"

              onClick={() => onChange(tags.filter((x) => x !== t))}

              className="ml-0.5 text-[#623561] hover:text-[#C83E39]"

              aria-label={`Remove ${t}`}

            >

              ×

            </button>

          </span>

        ))}

        <input

          value={value}

          onChange={(e) => setValue(e.target.value)}

          onKeyDown={onKeyDown}

          onBlur={() => commitToken(value)}

          placeholder={placeholder}

          className="flex-1 min-w-[120px] border-0 bg-transparent outline-none placeholder:text-gray-400"

        />

      </div>

    </div>

  );

}





















function coerceStrategyField(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return coerceStrategyField(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => coerceStrategyField(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, coerceStrategyField(val)])
    );
  }
  return value;
}

function humanizeStrategyKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function summarizeStrategyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => summarizeStrategyValue(item)).filter(Boolean);
    return parts.join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${humanizeStrategyKey(key)}: ${summarizeStrategyValue(val)}`)
      .join(", ");
  }
  return "";
}

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function normalizePlanValues(raw: unknown): string[] {
  const resolved = coerceStrategyField(raw);
  if (resolved === null || resolved === undefined) return [];
  if (Array.isArray(resolved)) {
    return resolved
      .map((item) =>
        typeof item === "string"
          ? humanizeStrategyKey(item)
          : summarizeStrategyValue(item)
      )
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  if (typeof resolved === "object") {
    return Object.values(resolved as Record<string, unknown>)
      .map((item) =>
        typeof item === "string"
          ? humanizeStrategyKey(item)
          : summarizeStrategyValue(item)
      )
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  if (typeof resolved === "string") {
    const trimmed = resolved.trim();
    return trimmed ? [humanizeStrategyKey(trimmed)] : [];
  }
  return [summarizeStrategyValue(resolved)].filter((line) => line.trim().length > 0);
}

function normalizeCategoryValues(raw: unknown): string[] {
  const resolved = coerceStrategyField(raw);
  if (resolved === null || resolved === undefined) return [];
  if (Array.isArray(resolved)) {
    return resolved
      .map((item) =>
        typeof item === "string"
          ? humanizeStrategyKey(item)
          : summarizeStrategyValue(item)
      )
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  if (typeof resolved === "object") {
    return Object.entries(resolved as Record<string, unknown>)
      .map(([slug, label]) => {
        if (typeof label === "string" && label.trim().length > 0) {
          return label.trim();
        }
        return humanizeStrategyKey(slug);
      })
      .filter((line) => line.trim().length > 0);
  }
  if (typeof resolved === "string") {
    const trimmed = resolved.trim();
    return trimmed ? [humanizeStrategyKey(trimmed)] : [];
  }
  return [summarizeStrategyValue(resolved)].filter((line) => line.trim().length > 0);
}

function normalizeTimeValues(raw: unknown): string[] {
  const resolved = coerceStrategyField(raw);
  if (resolved === null || resolved === undefined) return [];
  if (Array.isArray(resolved)) {
    return resolved
      .map((item) =>
        typeof item === "string" ? item : summarizeStrategyValue(item)
      )
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  if (typeof resolved === "object") {
    return Object.entries(resolved as Record<string, unknown>)
      .map(([key, val]) => {
        const index = Number(key);
        const baseLabel =
          Number.isFinite(index) && index >= 0 && index < DAY_LABELS.length
            ? DAY_LABELS[index]
            : humanizeStrategyKey(key);
        const times: string[] = [];
        if (Array.isArray(val)) {
          val.forEach((entry) => {
            const str =
              typeof entry === "string"
                ? entry
                : summarizeStrategyValue(entry);
            if (str && str.trim().length > 0) {
              times.push(str.trim());
            }
          });
        } else if (typeof val === "string") {
          const trimmed = val.trim();
          if (trimmed) times.push(trimmed);
        } else if (val !== null && val !== undefined) {
          const str = summarizeStrategyValue(val);
          if (str.trim().length > 0) times.push(str.trim());
        }
        return times.length > 0 ? `${baseLabel}: ${times.join(", ")}` : baseLabel;
      })
      .filter((line) => line.trim().length > 0);
  }
  if (typeof resolved === "string") {
    const trimmed = resolved.trim();
    return trimmed ? [trimmed] : [];
  }
  return [summarizeStrategyValue(resolved)].filter((line) => line.trim().length > 0);
}

function StrategyValue({ value }: { value: string[] }) {
  if (!value || value.length === 0) {
    return <span className="text-[#2b1b4a]/50">—</span>;
  }
  if (value.length === 1) {
    return <span className="text-[#2b1b4a]">{value[0]}</span>;
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-[#2b1b4a] marker:text-[#623561]/60">
      {value.map((line, index) => (
        <li key={`${index}-${line}`}>{line}</li>
      ))}
    </ul>
  );
}


