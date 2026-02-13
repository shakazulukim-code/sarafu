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

    const { transactionId } = await req.json();

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "transactionId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Checking transaction status:", transactionId);

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (error) {
      console.error("Transaction lookup error:", error);
      return new Response(
        JSON.stringify({ error: error.message, transactionId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: "Transaction not found", transactionId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transaction found:", {
      id: transaction.id,
      status: transaction.status,
      mpesa_receipt: transaction.mpesa_receipt,
      error_reason: transaction.error_reason,
      type: transaction.type,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    });

    return new Response(
      JSON.stringify({
        id: transaction.id,
        status: transaction.status,
        mpesa_receipt: transaction.mpesa_receipt,
        error_reason: transaction.error_reason,
        type: transaction.type,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
