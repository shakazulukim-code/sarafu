import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("supabase connection", () => {
  it("can query site_settings", async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
