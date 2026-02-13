import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("M-PESA Callback received:", JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      console.error("Invalid callback structure");
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    console.log(`Callback - MerchantRequestID: ${MerchantRequestID}, CheckoutRequestID: ${CheckoutRequestID}, ResultCode: ${ResultCode}`);

    // Find the transaction by checkout request ID
    console.log(`Looking for transaction with checkout_request_id = '${CheckoutRequestID}'`);
    
    const { data: transactionData, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .limit(1);

    if (txError) {
      console.error("Error querying transactions:", txError);
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Query returned ${transactionData?.length || 0} transaction(s)`);
    const transaction = transactionData && transactionData.length > 0 ? transactionData[0] : null;

    if (!transaction) {
      console.warn("❌ Transaction not found for CheckoutRequestID:", CheckoutRequestID);
      console.warn("This callback may not match any transaction ID. Checking recent transactions...");
      
      // Log recent transactions for debugging
      const { data: recentTx } = await supabase
        .from("transactions")
        .select("id, mpesa_receipt, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      
      console.warn("Recent transactions:", recentTx);
      
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Transaction found:", transaction.id, "Type:", transaction.type);
    const oldStatus = transaction.status;

    // Determine transaction outcome based on ResultCode
    let newStatus = "failed";
    let errorReason = ResultDesc || "Payment failed";

    if (ResultCode === 0) {
      // Payment successful
      newStatus = "completed";
      errorReason = null;
      console.log("Payment successful");
    } else if (ResultCode === 1) {
      // User cancelled
      newStatus = "cancelled";
      errorReason = "User cancelled the payment";
      console.log("Payment cancelled by user");
    } else {
      // Other failures
      newStatus = "failed";
      errorReason = ResultDesc || "Payment failed";
      console.log("Payment failed:", ResultDesc);
    }

    // Extract M-PESA metadata for successful payments
    let mpesaReceiptNumber = "";
    if (ResultCode === 0 && CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Name === "MpesaReceiptNumber") {
          mpesaReceiptNumber = item.Value;
          break;
        }
      }
    }

    // Update transaction status and error info
    const updateData: any = {
      status: newStatus,
      merchant_request_id: MerchantRequestID,
      updated_at: new Date().toISOString(),
    };

    if (mpesaReceiptNumber) {
      updateData.mpesa_receipt = mpesaReceiptNumber;
    }
    if (errorReason) {
      updateData.error_reason = errorReason;
    }

    console.log("Updating transaction:", transaction.id, "with data:", updateData);

    const { error: updateError, data: updatedRows } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", transaction.id)
      .neq("status", "completed")
      .select();

    if (updateError) {
      console.error("❌ Failed to update transaction:", updateError);
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Transaction updated successfully. Updated rows:", updatedRows?.length || 0);

    const updatedCount = updatedRows?.length || 0;
    if (newStatus === "completed" && updatedCount > 0) {
      // Handle coin_creation type payments
      if (transaction.type === "coin_creation") {
        console.log("Coin creation payment completed - marking creation_fee_paid");
        const { error: coinError } = await supabase
          .from("coins")
          .update({
            creation_fee_paid: true,
            approval_status: "pending",
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.coin_id);

        if (coinError) {
          console.error("Failed to update coin:", coinError);
        } else {
          console.log("Coin marked with creation_fee_paid = true");
        }
      }

      // Handle deposit type payments
      if (transaction.type === "deposit") {
        console.log("Deposit payment completed - updating wallet");

        const { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("fiat_balance")
          .eq("user_id", transaction.user_id)
          .single();

        if (walletError) {
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
      }

      // Buy transactions are allocated via DB triggers on status=completed
    }

    // Return success to M-PESA
    const responsePayload = {
      ResultCode: 0,
      ResultDesc: "Accepted",
      MerchantRequestID: MerchantRequestID,
      CheckoutRequestID: CheckoutRequestID,
    };

    console.log("Sending response to M-PESA:", responsePayload);

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Callback processing error:", error);
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
