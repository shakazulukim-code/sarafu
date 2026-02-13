import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { withdrawalId } = await req.json();

    if (!withdrawalId) {
      return new Response(
        JSON.stringify({ error: "withdrawalId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (withdrawalError || !withdrawal) {
      console.error("Withdrawal not found:", withdrawalError);
      return new Response(
        JSON.stringify({ error: "Withdrawal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (withdrawal.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Withdrawal not approved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing withdrawal ${withdrawalId} for KES ${withdrawal.amount}`);

    // Get M-PESA config
    const { data: mpesaConfig, error: configError } = await supabase
      .from("mpesa_config")
      .select("*")
      .maybeSingle();

    if (configError || !mpesaConfig) {
      console.error("M-PESA config error:", configError);
      return new Response(
        JSON.stringify({ error: "M-PESA config not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth token
    const baseUrl = mpesaConfig.is_sandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    const authString = btoa(`${mpesaConfig.consumer_key}:${mpesaConfig.consumer_secret}`);
    const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get OAuth token for M-PESA B2C");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("✅ OAuth token obtained for B2C");

    // Format phone number
    let formattedPhone = withdrawal.phone.replace(/\s+/g, "").replace(/^\+/, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // Prepare B2C request
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14);

    const password = btoa(`${mpesaConfig.paybill_number}${mpesaConfig.passkey}${timestamp}`);

    const b2cPayload = {
      InitiatorName: "withdrawals",
      SecurityCredential: password,
      CommandID: "BusinessPayment",
      Amount: Math.round(withdrawal.amount),
      PartyA: mpesaConfig.paybill_number,
      PartyB: formattedPhone,
      Remarks: `Withdrawal - ${withdrawalId.slice(0, 8)}`,
      QueueTimeOutURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-b2c-timeout`,
      ResultURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-b2c-callback`,
    };

    console.log("Sending B2C payout request to M-PESA...");

    const b2cResponse = await fetch(
      `${baseUrl}/mpesa/b2c/v3/paymentrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(b2cPayload),
      }
    );

    const b2cResult = await b2cResponse.json();
    console.log("B2C response:", JSON.stringify(b2cResult, null, 2));

    if (b2cResult.ResponseCode === "0") {
      // Update withdrawal status to processing
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      if (updateError) {
        console.error("Failed to update withdrawal status:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Withdrawal payout initiated",
          conversationId: b2cResult.ConversationID,
          originator: b2cResult.OriginatorConversationID,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Update withdrawal status to failed
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "failed",
          mpesa_error_reason: b2cResult.ResponseDescription || "B2C payment failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      if (updateError) {
        console.error("Failed to update withdrawal status:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: b2cResult.ResponseDescription || "B2C payment failed",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
