import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPasswordResetTemplate, getWelcomeTemplate, getAdminNotificationTemplate } from "./templates.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
    to: string;
    type: "welcome" | "password_reset" | "admin_notification";
    data?: any;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) {
            console.error("RESEND_API_KEY is not set");
            return new Response(
                JSON.stringify({ error: "Email service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { to, type, data } = await req.json() as EmailRequest;

        if (!to || !type) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: to, type" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let html = "";
        let subject = "";

        switch (type) {
            case "welcome":
                subject = "Welcome to Noble Coin Launch!";
                html = getWelcomeTemplate(data?.name || "there");
                break;
            case "password_reset":
                subject = "Reset Your Password - Noble Coin Launch";
                html = getPasswordResetTemplate(data?.resetLink || "#");
                break;
            case "admin_notification":
                subject = `Admin Alert: ${data?.notificationType || "Activity"}`;
                html = getAdminNotificationTemplate(data?.notificationType || "Activity", data?.details || "");
                break;
            default:
                throw new Error("Invalid email type");
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Noble Coin Launch <noreply@noblecoinlaunch.com>",
                to: [to],
                subject,
                html,
            }),
        });

        const result = await res.json();
        console.log("Resend API response:", result);

        if (res.ok) {
            return new Response(
                JSON.stringify({ success: true, id: result.id }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else {
            return new Response(
                JSON.stringify({ error: result.message || "Failed to send email" }),
                { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
    } catch (error: any) {
        console.error("Send email error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
