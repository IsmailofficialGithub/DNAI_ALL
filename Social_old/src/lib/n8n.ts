// Get base URL from environment variables
const rawBase = (import.meta.env.VITE_N8N_BASE_URL ?? import.meta.env.VITE_N8N_URL ?? "https://auto.nsolbpo.com").toString();
const sanitizedBase = rawBase.replace(/\/$/, "").replace(/\/+$/, "");
const base = sanitizedBase.length > 0 ? sanitizedBase : "https://auto.nsolbpo.com";
const baseWithPort = import.meta.env.VITE_N8N_BASE_URL_WITH_PORT ?? "https://auto.nsolbpo.com:5678";

// Helper function to build webhook URL from env var or default
const buildWebhookUrl = (envVar: string | undefined, defaultPath: string): string => {
  const path = envVar ?? defaultPath;
  // If path already includes base URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, combine base with path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

export const N8N_ENDPOINTS = {
  // Post Management
  pending: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_PENDING_POSTS, "/webhook/smas/pending-posts"),
  postAction: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_PROCESS_POST, "/webhook/process-post"),
  deletePost: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_DELETE_POST, "/webhook/delete-post"),
  postUpdate: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_POST_UPDATE, "/webhook/smas/post-update"),
  approve: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_APPROVE_POST, "/webhook/Approved-Posts"),
  editPost: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_EDIT_POST, "/webhook/editpost"),
  postNow: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_POST_NOW, "/webhook/post-now"),
  AdPost: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_AD_POST, "/webhook/ad-post"),

  // Analytics
  analyticsSummary: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_ANALYTICS_SUMMARY, "/webhook/smas/analytics-summary"),
  analyticsPosts: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_ANALYTICS_POSTS, "/webhook/smas/analytics-posts"),
  analyticsPlatformSeries: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_ANALYTICS_PLATFORM_SERIES, "/webhook/smas/platform-series"),

  // Content Generation
  generatePosts: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_GENERATE_POSTS, "/webhook/generate-posts"),
  generateStrategy: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_GENERATE_STRATEGY, "/webhook/Generate-Strategy"),
  generateMedia: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_GENERATE_MEDIA, "/webhook/generate-media"),
  customizeImage: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_CUSTOMIZE_IMAGE, "/webhook/customize-image"),

  // Company & Competitor Analysis
  companyLookup: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_COMPANY_SEARCH, "/webhook/company-search"),
  competitorLookup: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_COMPETITOR_LOOKUP, "/webhook/smas/competitor-lookup"),

  // Calendar
  scalendar: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_SCALENDAR, "/webhook/scalendar"),
  scalendarTest: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_SCALENDAR_TEST, "/webhook-test/scalendar"),

  // History
  history: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_HISTORY, "/webhook/smas/history"),

  // Genie Bot
  createGenieBot: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_CREATE_GENIE_BOT, "/webhook/c50c815b-8c98-4eef-b56e-8c8e8a4708ca"),
  editGenieBot: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_EDIT_GENIE_BOT, "/webhook/editbot"),
  initiateGenieCall: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_INITIATE_GENIE_CALL, "/webhook/e04ee263-e338-4d8e-b564-33376f491e70"),
  stopGenieCall: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_STOP_GENIE_CALL, "/webhook/stop-genie-call"),
  resumeGenieCall: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_RESUME_GENIE_CALL, "/webhook/resume-genie-call"),
  deleteGenieAgent: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_DELETE_GENIE_AGENT, "/webhook/delete-genie-agent"),

  // Authentication
  passwordReset: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_PASSWORD_RESET, "/webhook/password-reset"),

  // Support
  createSupportTicket: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_CREATE_SUPPORT_TICKET, "/webhook/create-support-ticket"),

  // Testing
  test: buildWebhookUrl(import.meta.env.VITE_N8N_WEBHOOK_TEST, "/webhook/test"),
} as const;

export function getN8nBaseUrl() {
  return base;
}
