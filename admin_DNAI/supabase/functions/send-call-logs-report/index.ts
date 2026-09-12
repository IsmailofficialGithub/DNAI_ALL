// Supabase Edge Function to send call logs report when campaign is completed
// This function is triggered by a database trigger when a campaign's calls_completed equals contacts_count

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CampaignPayload {
  id: string;
  owner_user_id: string;
  contacts_count: number;
  calls_completed: number;
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API endpoint URL from environment
    const apiUrl = Deno.env.get("API_URL") || "http://localhost:5000";
    const apiKey = Deno.env.get("API_KEY") || "";
    const apiSecret = Deno.env.get("API_SECRET") || "";

    if (!apiKey || !apiSecret) {
      console.error("❌ API_KEY and API_SECRET must be set in environment variables");
      return new Response(
        JSON.stringify({ error: "API credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the request body (from database trigger)
    const payload: { record?: CampaignPayload; old_record?: CampaignPayload } =
      await req.json();

    const campaign = payload.record || payload.old_record;

    if (!campaign) {
      console.error("❌ No campaign data in payload");
      return new Response(
        JSON.stringify({ error: "No campaign data provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📧 Triggering call logs report for campaign:", campaign.id);

    // Check if campaign is completed
    if (
      campaign.calls_completed >= campaign.contacts_count &&
      campaign.contacts_count > 0
    ) {
      // Call the API endpoint to generate and send the report
      const response = await fetch(`${apiUrl}/api/genie/calls/export-and-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-API-Secret": apiSecret,
        },
        body: JSON.stringify({
          campaign_id: campaign.id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API call failed:", errorText);
        return new Response(
          JSON.stringify({
            error: "Failed to send call logs report",
            details: errorText,
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result = await response.json();
      console.log("✅ Call logs report sent successfully:", result);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Call logs report sent successfully",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.log(
        "ℹ️ Campaign not completed yet:",
        campaign.calls_completed,
        "/",
        campaign.contacts_count
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: "Campaign not completed yet",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("❌ Error in send-call-logs-report function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
