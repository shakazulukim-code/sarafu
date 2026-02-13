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

    const body = await req.json();
    const { transactionId, checkoutRequestId } = body;

    if (!transactionId || !checkoutRequestId) {
      return new Response(
        JSON.stringify({ error: "transactionId and checkoutRequestId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Polling M-PESA status for CheckoutRequestID: ${checkoutRequestId}`);

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

    // Get OAuth token for M-PESA
    const baseUrl = mpesaConfig.is_sandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    console.log(`Using M-PESA ${mpesaConfig.is_sandbox ? "sandbox" : "production"} API`);

    const authString = btoa(`${mpesaConfig.consumer_key}:${mpesaConfig.consumer_secret}`);
    const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get OAuth token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("✅ OAuth token obtained");

    // Query transaction status from M-PESA
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14);

    const password = btoa(`${mpesaConfig.paybill_number}${mpesaConfig.passkey}${timestamp}`);

    const queryPayload = {
      BusinessShortCode: mpesaConfig.paybill_number,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    console.log("Querying M-PESA for transaction status:", checkoutRequestId);

    const queryResponse = await fetch(
      `${baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queryPayload),
      }
    );

    const queryResult = await queryResponse.json();
    console.log("M-PESA query response:", JSON.stringify(queryResult, null, 2));

    // Process the response
    const resultCode = queryResult.ResultCode;
    console.log(`Result Code: ${resultCode} (${queryResult.ResultDesc})`);

    let txStatus = "pending";
    let errorReason = null;

    if (resultCode === "0") {
      // Transaction completed successfully
      txStatus = "completed";
      console.log("✅ M-PESA indicates transaction was successful");
    } else if (resultCode === "1") {
      // User cancelled
      txStatus = "cancelled";
      errorReason = "User cancelled the payment";
      console.log("❌ User cancelled payment");
    } else if (resultCode === "1032") {
      // Request timeout - still waiting
      txStatus = "stk_sent";
      console.log("⏳ Request still pending - STK prompt may be showing");
    } else {
      // Various failure codes
      txStatus = "failed";
      errorReason = queryResult.ResultDesc || "Payment failed";
      console.log("❌ Payment failed:", errorReason);
    }

    // Get current transaction status to ensure idempotency
    // Update transaction in database
    const updateData: any = {
      status: txStatus,
      updated_at: new Date().toISOString(),
    };

    if (errorReason) {
      updateData.error_reason = errorReason;
    }

    console.log(`Updating transaction ${transactionId} to status: ${txStatus}`);

    const { error: updateError, data: updatedRows } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", transactionId)
      .neq("status", "completed")
      .select();

    if (updateError) {
      console.error("❌ Failed to update transaction:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Transaction updated:", updatedRows?.[0]);

    // Handle completion only once
    const updatedCount = updatedRows?.length || 0;
    if (txStatus === "completed" && updatedCount > 0) {
      const { data: transaction } = await supabase
        .from("transactions")
        .select("type, coin_id, user_id, amount, price_per_coin, total_value")
        .eq("id", transactionId)
        .single();

      if (transaction?.type === "coin_creation") {
        console.log("Marking coin creation as fee paid");
        await supabase
          .from("coins")
          .update({
            creation_fee_paid: true,
            approval_status: "pending",
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.coin_id);
      } else if (transaction?.type === "deposit") {
        console.log("Processing deposit transaction - updating wallet balance");
        
        // Update wallet fiat balance
        const { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("fiat_balance")
          .eq("user_id", transaction.user_id)
          .single();

        if (walletError) {
          console.error("Wallet not found for user:", transaction.user_id);
          // Create wallet if it doesn't exist
          await supabase
            .from("wallets")
            .insert({
              user_id: transaction.user_id,
              fiat_balance: transaction.total_value || transaction.amount,
            });
        } else if (wallet) {
          const newBalance = wallet.fiat_balance + (transaction.total_value || transaction.amount);
          await supabase
            .from("wallets")
            .update({
              fiat_balance: newBalance,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", transaction.user_id);
          console.log(`✅ Wallet updated: +${transaction.total_value || transaction.amount} KES`);
        }
      } else if (transaction?.type === "buy") {
        console.log("Buy transaction completed - holdings allocated by DB trigger");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        status: txStatus,
        errorReason,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
