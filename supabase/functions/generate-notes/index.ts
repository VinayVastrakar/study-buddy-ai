import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DETAIL_PROMPTS: Record<string, string> = {
  "1": `LEVEL 1 – Short Notes: 5–6 bullet points per topic. Only definitions and keywords. Very concise.`,
  "2": `LEVEL 2 – Exam Ready: 8–12 bullet points per topic. Definitions + explanation. Examples included. Suitable for 5–8 mark answers.`,
  "3": `LEVEL 3 – Deep Explanation: Long and detailed explanation. Step-by-step breakdown. Advantages, limitations, use cases. Suitable for 10–15 mark answers.`,
  "4": `LEVEL 4 – Teaching Mode: Explain like a classroom teacher. Extremely simple language. Use analogies and real-life examples. Beginner-friendly.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { syllabusText, detailLevel, language, userApiKey } = await req.json();

    if (!syllabusText || !detailLevel || !language) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: syllabusText, detailLevel, language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which API to use
    const useUserKey = !!userApiKey;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!useUserKey && !LOVABLE_API_KEY) throw new Error("No API key available. Please add your Gemini API key in settings.");

    const detailInstruction = DETAIL_PROMPTS[String(detailLevel)] || DETAIL_PROMPTS["2"];

    const systemPrompt = `You are an AI Academic Notes Generation Engine. You receive extracted syllabus text and generate complete, structured, exam-oriented study notes.

SYLLABUS ANALYSIS (STRICT):
- Identify subject name, course/semester, units/modules, topics and subtopics
- Preserve the original hierarchy exactly as in the syllabus
- Do NOT add, remove, rename, or merge topics
- NEVER hallucinate topics

NOTES GENERATION:
For EACH topic and subtopic:
- Start with a clear definition
- Explain in simple language using point-wise format
- Include key points, examples, step-by-step explanations
- For theoretical topics: add advantages and limitations
- For technical topics: add process, flow, or algorithm explanation
- Highlight important terms using **bold**

DETAIL LEVEL: ${detailInstruction}

LANGUAGE: ${language}. Keep sentences short and clear. Avoid complex academic words. Tone must be human, natural, and exam-focused.

Write content suitable for natural speech (TTS-friendly). Avoid symbols that break TTS. Use clear sentence flow.

OUTPUT: Return ONLY valid JSON with this structure:
{
  "subject": "",
  "course": "",
  "language": "${language}",
  "detailLevel": "${detailLevel}",
  "units": [
    {
      "unitNumber": "",
      "unitName": "",
      "topics": [
        {
          "topicName": "",
          "content": ""
        }
      ]
    }
  ]
}

Do NOT include markdown outside JSON. Do NOT include explanations outside JSON. JSON must be parseable.`;

    // Call either Google Gemini directly or Lovable AI gateway
    const apiUrl = useUserKey
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    const authHeader = useUserKey
      ? `Bearer ${userApiKey}`
      : `Bearer ${LOVABLE_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: useUserKey ? "gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the syllabus text:\n\n${syllabusText}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
