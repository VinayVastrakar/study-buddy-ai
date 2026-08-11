import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DETAIL_PROMPTS: Record<string, string> = {
  "1": `LEVEL 1 – Short Notes: 5–6 bullet points. Only definitions and keywords. Very concise.`,
  "2": `LEVEL 2 – Exam Ready: 8–12 bullet points. Definitions + explanation. Examples included. Suitable for 5–8 mark answers.`,
  "3": `LEVEL 3 – Deep Explanation: Long detailed explanation. Step-by-step breakdown. Advantages, limitations, use cases. Suitable for 10–15 mark answers.`,
  "4": `LEVEL 4 – Teaching Mode: Classroom teacher style. Extremely simple language. Analogies and real-life examples. Beginner-friendly.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topicName, subject, course, unitName, detailLevel, language, userApiKey } = await req.json();
    if (!topicName || !detailLevel || !language) {
      return new Response(JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const useUserKey = !!userApiKey;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!useUserKey && !LOVABLE_API_KEY) throw new Error("No API key available. Add your Gemini API key in settings.");

    const detailInstruction = DETAIL_PROMPTS[String(detailLevel)] || DETAIL_PROMPTS["2"];

    const systemPrompt = `You are an AI Academic Notes Generation Engine. Generate exam-oriented study notes for a SINGLE topic.

CONTEXT:
- Subject: ${subject || "N/A"}
- Course: ${course || "N/A"}
- Unit: ${unitName || "N/A"}
- Topic: ${topicName}

RULES:
- Start with a clear definition.
- Point-wise format, simple language.
- Include key points, examples, step-by-step explanation where relevant.
- Add advantages/limitations for theoretical topics; process/flow for technical.
- Highlight important terms using **bold**.
- TTS-friendly: avoid symbols that break speech flow.

DETAIL LEVEL: ${detailInstruction}
LANGUAGE: ${language}. Short clear sentences. Human, natural, exam-focused tone.

OUTPUT: Return ONLY valid JSON: {"content": "..."} — no markdown fences, no extra text. The content string may contain \\n for line breaks.`;

    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${useUserKey ? userApiKey : LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3.1-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate notes for topic: "${topicName}".` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI generation failed", details: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    let content = "";
    try {
      const parsed = JSON.parse(raw);
      content = parsed.content ?? "";
    } catch {
      // Fallback: strip fences
      content = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      try { content = JSON.parse(content).content ?? content; } catch { /* keep as text */ }
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-topic error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
