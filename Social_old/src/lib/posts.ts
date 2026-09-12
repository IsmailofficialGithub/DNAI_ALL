import type { DbPostRow, DbStrategyRow, PrimaryContentCalendarRow, ContentCalendarRow, StrategicCalendarRow } from "./api";

export type PendingPost = {
  id: string | number;
  platform: string;
  topic: string;
  content: string;
  hashtags?: string[];
  imageUrl?: string | null;
  imageFile?: File | null;
  scheduledAt?: string | null;
  imagePrompt?: string | null;
  approvalStatus?: "pending" | "approved" | "rejected" | "draft" | "posted" | "scheduled" | "archived" | "ready" | "deleted";
  postedAt?: string | null;
  calendar_id?: string;
  brand_id?: string;
  mediaType?: "image" | "video" | "carousel" | "none";
};

const VIDEO_KEYWORDS = [
  "video",
  "reel",
  "vertical clip",
  "motion",
  "animated",
  "story",
  "short",
  "tiktok",
  "youtube",
  "mp4",
  "mov",
  "mkv",
  "webm",
  "gif",
  "clip",
];

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv", ".ogg"];

function inferMediaTypeFromSchema({
  mediaUrl,
  mediaPrompt,
  isCarousel,
  noMedia,
}: {
  mediaUrl?: string | null;
  mediaPrompt?: string | null;
  isCarousel?: boolean | null;
  noMedia?: number | boolean | null;
}): "image" | "video" | "carousel" | "none" {
  if (isCarousel) {
    return "carousel";
  }

  const prompt = mediaPrompt?.toLowerCase() ?? "";
  const url = mediaUrl?.toLowerCase() ?? "";

  const hasVideoKeyword = VIDEO_KEYWORDS.some((keyword) => prompt.includes(keyword) || url.includes(keyword));
  const hasVideoExtension = VIDEO_EXTENSIONS.some((ext) => url.endsWith(ext));
  const videoFolderHint = url.includes("/videohub/") || url.includes("/videos/");

  if (hasVideoKeyword || hasVideoExtension || videoFolderHint) {
    return "video";
  }

  if (prompt || mediaUrl) {
    return "image";
  }

  if (noMedia != null && Number(noMedia) > 0) {
    return "none";
  }

  return "none";
}

export type HistoryPost = {
  id: string | number;
  platform: string;
  topic: string;
  content?: string;
  hashtags?: string[];
  imageUrl?: string | null;
  imagePrompt?: string | null;
  scheduledAt?: string | null;
  approvalStatus?: "pending" | "approved" | "rejected" | "draft" | "posted" | "scheduled" | "archived" | "ready" | "deleted";
  postedAt?: string | null;
  statusNote?: string | null;
};

export type StrategyItem = {
  id: string;
  platform: string;
  strategyName: string;
  strategyGoal?: string | null;
  region?: string | null;
  niche?: string | null;
  engagementRate?: string | null;
  tacticCount?: number | null;
  details?: string | null;
  postingPlan: string[];
  postingTimes: string[];
  postingCategories: string[];
};

export function normalizeFromDb(row: DbPostRow): PendingPost {
  return {
    id: row.id,
    platform: row.platform,
    topic: row.topic,
    content: row.content,
    hashtags: (row.hashtags as string[] | null) ?? [],
    imagePrompt: row.image_prompt ?? null,
    imageUrl: row.image_url ?? null,
    approvalStatus: row.status ?? "pending",
    scheduledAt: row.scheduled_at ?? null,
    postedAt: null,
    mediaType: inferMediaTypeFromSchema({
      mediaUrl: row.image_url,
      mediaPrompt: row.image_prompt,
      isCarousel: false,
      noMedia: !row.image_url,
    }),
  };
}

export function normalizeFromPrimaryContentCalendar(row: PrimaryContentCalendarRow): PendingPost {
  // Combine date and time to create a proper datetime string
  let scheduledAt = null;
  if (row.date) {
    let dateStr = row.date;
    
    // If time is provided, combine it with date
    if (row.time) {
      // Handle different time formats
      let timeStr = row.time;
      if (!timeStr.includes(':')) {
        // If time is just numbers like "1400", convert to "14:00"
        if (timeStr.length === 4) {
          timeStr = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
        }
      }
      dateStr = `${row.date}T${timeStr}`;
    } else {
      // If no time, use midnight
      dateStr = `${row.date}T00:00:00`;
    }
    
    // Validate the date string before setting scheduledAt
    try {
      const testDate = new Date(dateStr);
      if (!isNaN(testDate.getTime())) {
        scheduledAt = dateStr;
      } else {
        console.warn('Invalid date format:', dateStr, 'for row:', row.id);
      }
    } catch (error) {
      console.warn('Error parsing date:', dateStr, 'for row:', row.id, error);
    }
  }
  
  // Parse hashtags from text string
  let hashtags: string[] = [];
  if (row.hashtags) {
    hashtags = row.hashtags
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#+/, '').trim())
      .filter(tag => tag.length > 0);
  }
  
  return {
    id: row.id,
    platform: row.platforms || "unknown",
    topic: row.topic || "Untitled",
    content: row.description || "",
    hashtags: hashtags,
    imagePrompt: row.media_prompt ?? null,
    imageUrl: row.media_url ?? null,
    approvalStatus: row.post_status ?? "pending",
    scheduledAt: scheduledAt,
    postedAt: null,
    mediaType: inferMediaTypeFromSchema({
      mediaUrl: row.media_url,
      mediaPrompt: row.media_prompt,
      isCarousel: false,
      noMedia: !row.media_url,
    }),
  };
}

export function normalizeFromContentCalendar(row: ContentCalendarRow): PendingPost {
  // Use scheduled_at if available, otherwise combine date and time
  let scheduledAt = null;
  
  if (row.scheduled_at) {
    scheduledAt = row.scheduled_at;
  } else if (row.date) {
    let dateStr = row.date;
    
    // If time is provided, combine it with date
    if (row.time) {
      // Handle different time formats
      let timeStr = row.time;
      if (!timeStr.includes(':')) {
        // If time is just numbers like "1400", convert to "14:00"
        if (timeStr.length === 4) {
          timeStr = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
        }
      }
      dateStr = `${row.date}T${timeStr}`;
    } else {
      // If no time, use midnight
      dateStr = `${row.date}T00:00:00`;
    }
    
    // Validate the date string before setting scheduledAt
    try {
      const testDate = new Date(dateStr);
      if (!isNaN(testDate.getTime())) {
        scheduledAt = dateStr;
      } else {
        console.warn('Invalid date format:', dateStr, 'for row:', row.id);
      }
    } catch (error) {
      console.warn('Error parsing date:', dateStr, 'for row:', row.id, error);
    }
  }
  
  // Parse hashtags from text string
  let hashtags: string[] = [];
  if (row.hashtags) {
    hashtags = row.hashtags
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#+/, '').trim())
      .filter(tag => tag.length > 0);
  }
  
  // Normalize platform name to handle case variations
  const normalizePlatform = (platform: string): string => {
    if (!platform) return "other";
    
    const normalized = platform.toLowerCase().trim();
    
    // Handle platforms with case-insensitive matching
    if (normalized === "facebook") return "facebook";
    if (normalized === "instagram") return "instagram";
    if (normalized === "linkedin") return "linkedin";
    if (normalized === "tiktok") return "tiktok";
    
    return "other";
  };

  // Normalize post status - default to "draft" if post_status is "Draft" or null
  const normalizeStatus = (status: string | null): "pending" | "approved" | "rejected" | "draft" | "posted" | "scheduled" | "archived" | "ready" => {
    if (!status) return "draft";
    const normalized = status.toLowerCase().trim();
    if (normalized === "draft") return "draft";
    if (normalized === "approved") return "approved";
    if (normalized === "rejected") return "rejected";
    if (normalized === "posted") return "posted";
    if (normalized === "scheduled") return "scheduled";
    if (normalized === "archived") return "archived";
    if (normalized === "ready") return "ready";
    return "draft"; // Default to draft for unknown statuses
  };

  return {
    id: row.id,
    platform: normalizePlatform(row.platforms) || "other",
    topic: row.topic || "Untitled",
    content: row.description || "",
    hashtags: hashtags,
    imagePrompt: row.media_prompt ?? null,
    imageUrl: row.media_url ?? null,
    approvalStatus: normalizeStatus(row.post_status),
    scheduledAt: scheduledAt,
    postedAt: row.published_at ?? null,
    calendar_id: row.calendar_id,
    brand_id: row.brand_id,
    mediaType: inferMediaTypeFromSchema({
      mediaUrl: row.media_url,
      mediaPrompt: row.media_prompt,
      isCarousel: row.isCarsoul,
      noMedia: row.noMedia,
    }),
  };
}

export function normalizeFromStrategicCalendar(row: StrategicCalendarRow): PendingPost {
  // Combine start_date with post_time to create scheduledAt
  let scheduledAt = null;
  if (row.start_date) {
    let dateStr = row.start_date;
    
    // If post_time is provided, combine it with date
    if (row.post_time) {
      let timeStr = row.post_time;
      if (!timeStr.includes(':')) {
        // If time is just numbers like "1400", convert to "14:00"
        if (timeStr.length === 4) {
          timeStr = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
        }
      }
      dateStr = `${row.start_date}T${timeStr}`;
    } else {
      // If no time, use midnight
      dateStr = `${row.start_date}T00:00:00`;
    }
    
    // Validate the date string before setting scheduledAt
    try {
      const testDate = new Date(dateStr);
      if (!isNaN(testDate.getTime())) {
        scheduledAt = dateStr;
      } else {
        console.warn('Invalid date format:', dateStr, 'for strategic calendar row:', row.id);
      }
    } catch (error) {
      console.warn('Error parsing date:', dateStr, 'for strategic calendar row:', row.id, error);
    }
  }
  
  // Parse hashtags from text string
  let hashtags: string[] = [];
  if (row.hashtags) {
    hashtags = row.hashtags
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#+/, '').trim())
      .filter(tag => tag.length > 0);
  }
  
  return {
    id: row.id,
    platform: row.platform || "unknown",
    topic: row.title || "Untitled Strategic Post",
    content: row.posting_idea || "",
    hashtags: hashtags,
    imagePrompt: null, // Strategic calendar doesn't have image prompts
    imageUrl: null, // Strategic calendar doesn't have image URLs
    approvalStatus: "draft" as const, // Strategic calendars are typically drafts for editing
    scheduledAt: scheduledAt,
    postedAt: null,
  };
}

export function makeGeneratedId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function pendingKey(id: PendingPost["id"]): string {
  return typeof id === "number" ? `n:${id}` : `s:${id}`;
}

export function normalizeGeneratedPost(raw: unknown): PendingPost | null {
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
      .split(/[\s,]+/)
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
    imageUrl,
    scheduledAt,
    approvalStatus,
    postedAt: null,
  };
}

export function toHistory(post: PendingPost, extras?: Partial<HistoryPost>): HistoryPost {
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

export function normalizeStrategyRow(row: DbStrategyRow): StrategyItem {
  const goal =
    typeof row.strategy_goal === "string" && row.strategy_goal.trim().length > 0
      ? row.strategy_goal.trim()
      : typeof row.goal === "string" && row.goal.trim().length > 0
      ? row.goal.trim()
      : null;

  const rawDetails = row.details ?? row.strategy_details ?? null;
  const resolvedDetails = coerceStrategyField(rawDetails);
  const detailsObject =
    resolvedDetails && typeof resolvedDetails === "object" && !Array.isArray(resolvedDetails)
      ? (resolvedDetails as Record<string, unknown>)
      : null;

  let details: string | null = null;
  if (typeof rawDetails === "string") {
    const trimmed = rawDetails.trim();
    details = trimmed.length > 0 ? trimmed : null;
  } else if (Array.isArray(resolvedDetails)) {
    const lines = resolvedDetails
      .map((item) => (typeof item === "string" ? item : summarizeStrategyValue(item)))
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length > 0) {
      details = lines.join("\n");
    }
  } else if (detailsObject) {
    const lines = Object.entries(detailsObject)
      .map(([key, val]) => {
        const label = humanizeStrategyKey(key);
        const summary = summarizeStrategyValue(val);
        return summary ? `${label}: ${summary}` : label;
      })
      .filter((line) => line.trim().length > 0);
    if (lines.length > 0) {
      details = lines.join("\n");
    }
  } else if (resolvedDetails !== null && resolvedDetails !== undefined) {
    const summary = summarizeStrategyValue(resolvedDetails);
    details = summary.trim().length > 0 ? summary : null;
  }

  const tacticCount =
    typeof row.tactic_count === "number"
      ? row.tactic_count
      : typeof row.tactics_count === "number"
      ? row.tactics_count
      : Array.isArray(row.posting_plan)
      ? row.posting_plan.length
      : null;

  const metadataRaw = row.metadata ?? row.strategy_metadata ?? row.meta ?? null;
  const resolvedMetadata = coerceStrategyField(metadataRaw);
  const metadataObject =
    resolvedMetadata && typeof resolvedMetadata === "object" && !Array.isArray(resolvedMetadata)
      ? (resolvedMetadata as Record<string, unknown>)
      : null;

  const regionCandidates = [
    row.region,
    row.target_region,
    row.strategy_region,
    row.geo_region,
    pickFromObject(detailsObject, ["region", "targetRegion", "target_region", "geoRegion", "market"]),
    pickFromObject(metadataObject, ["region", "targetRegion", "target_region", "geoRegion", "market"]),
  ];
  let region = pickFirstString(regionCandidates);
  if (!region) {
    region = extractFromText(details, ["Region", "Target Region", "Market"]);
  }

  const nicheCandidates = [
    row.niche,
    row.target_niche,
    row.strategy_niche,
    row.audience,
    row.audience_focus,
    pickFromObject(detailsObject, ["niche", "targetNiche", "audience", "audienceProfile", "audience_focus"]),
    pickFromObject(metadataObject, ["niche", "targetNiche", "audience", "audienceProfile", "audience_focus"]),
  ];
  let niche = pickFirstString(nicheCandidates);
  if (!niche) {
    niche = extractFromText(details, ["Niche", "Audience", "Target Audience"]);
  }

  const engagementCandidates = [
    row.engagement_rate,
    row.engagement_rate_percent,
    row.avg_engagement_rate,
    row.engagement_percentage,
    row.engagement,
    pickFromObject(detailsObject, ["engagementRate", "engagement_rate", "engagementPercentage"]),
    pickFromObject(metadataObject, ["engagementRate", "engagement_rate", "engagementPercentage"]),
  ];
  let engagementRaw = pickFirstDefined(engagementCandidates);
  if (!engagementRaw) {
    engagementRaw = extractFromText(details, ["Engagement Rate"]);
  }
  const engagementRate = formatEngagementRateDisplay(engagementRaw);

  return {
    id: String(row.id ?? `strategy-${Date.now()}`),
    platform: row.platform ?? "Unknown",
    strategyName:
      typeof row.strategy_name === "string" && row.strategy_name.trim().length > 0
        ? row.strategy_name.trim()
        : "Untitled Strategy",
    strategyGoal: goal,
    region: region ?? null,
    niche: niche ?? null,
    engagementRate: engagementRate ?? null,
    tacticCount,
    details,
    postingPlan: normalizePlanValues(row.posting_plan),
    postingTimes: normalizeTimeValues(row.best_times_by_day ?? row.posting_times),
    postingCategories: normalizeCategoryValues(row.category_names ?? row.posting_categories),
  };
}


function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (Array.isArray(value) || (value && typeof value === "object")) {
      const summary = summarizeStrategyValue(value);
      if (summary && summary.trim().length > 0) {
        return summary.trim();
      }
    }
  }
  return null;
}

function pickFirstDefined(values: unknown[]): unknown {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    return value;
  }
  return null;
}

function pickFromObject(source: Record<string, unknown> | null, keys: string[]): unknown {
  if (!source) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value === null || value === undefined) continue;
      if (typeof value === "string" && value.trim().length === 0) continue;
      return value;
    }
  }
  return null;
}

function extractFromText(text: string | null, labels: string[]): string | null {
  if (!text) return null;
  for (const label of labels) {
    const pattern = new RegExp(String.raw`${label}\s*(?:[:\-])\s*([^\n\r]+)`, "i");

    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return null;
}

function formatEngagementRateDisplay(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const percent = raw > 1 ? raw : raw * 100;
    const decimals = percent >= 100 ? 0 : percent >= 10 ? 1 : 2;
    return `${percent.toFixed(decimals)}%`;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(-?\d+(?:\.\d+)?)/);
    if (!match) return trimmed;
    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) {
      return trimmed;
    }
    const hasPercent = /%/.test(trimmed);
    const percent = hasPercent ? numeric : numeric > 1 ? numeric : numeric * 100;
    const decimals = percent >= 100 ? 0 : percent >= 10 ? 1 : 2;
    return `${percent.toFixed(decimals)}%`;
  }
  return null;
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
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
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
        typeof item === "string" ? humanizeStrategyKey(item) : summarizeStrategyValue(item)
      )
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  if (typeof resolved === "object") {
    return Object.values(resolved as Record<string, unknown>)
      .map((item) =>
        typeof item === "string" ? humanizeStrategyKey(item) : summarizeStrategyValue(item)
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
        typeof item === "string" ? humanizeStrategyKey(item) : summarizeStrategyValue(item)
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
      .map((item) => (typeof item === "string" ? item : summarizeStrategyValue(item)))
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
            const str = typeof entry === "string" ? entry : summarizeStrategyValue(entry);
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
