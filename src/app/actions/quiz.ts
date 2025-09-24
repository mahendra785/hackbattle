// src/app/actions/quiz.ts
"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeneratedMCQ = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type GeneratedTextQ = {
  prompt: string;
  context?: string;
};

export type GeneratedPractice = {
  mcqs: GeneratedMCQ[];
  texts: GeneratedTextQ[];
};

type GeneratePracticeInput = {
  topic: string;
  subtopic: string;
  // Keep this loose to avoid import cycles; we only stringify it.
  roadmap: any;
  // Optional: user level or count knobs if you want later
  numMcqs?: number;   // default 3
  numTexts?: number;  // default 2
};

export async function generatePractice(
  input: GeneratePracticeInput
): Promise<GeneratedPractice> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // Fail open with empty results (UI will show fallback cards)
    return { mcqs: [], texts: [] };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const numMcqs = Math.max(1, Math.min(input.numMcqs ?? 3, 6));
  const numTexts = Math.max(1, Math.min(input.numTexts ?? 2, 4));

  const instruction = `
You are a tutor. Create ${numMcqs} multiple-choice questions and ${numTexts} short-answer prompts
for the given TOPIC and SUBTOPIC. Use the ROADMAP context to keep phrasing aligned with what's being studied.
Return STRICT JSON only, with this shape:

{
  "mcqs": [
    { "question": "...", "options": ["A","B","C","D"], "correctIndex": 1, "explanation": "..." }
  ],
  "texts": [
    { "prompt": "...", "context": "optional extra guidance" }
  ]
}

Rules:
- MCQs must have 4 options (A–D) and exactly one correct answer.
- Keep questions concise and unambiguous.
- Avoid code that cannot be rendered as plain text.
- No prose outside of the JSON.
`.trim();

  const payload = {
    topic: input.topic,
    subtopic: input.subtopic,
    roadmap: input.roadmap ?? [],
  };

  // The @google/generative-ai SDK expects a simple array of parts or a string.
  const resp = await model.generateContent([
    { text: instruction + "\n\nINPUT:\n" + JSON.stringify(payload) },
  ]);

  const raw = resp.response.text().trim();

  try {
    const parsed = JSON.parse(raw);
    // Light validation
    const mcqs: GeneratedMCQ[] = Array.isArray(parsed?.mcqs)
      ? parsed.mcqs
          .filter(
            (q: any) =>
              typeof q?.question === "string" &&
              Array.isArray(q?.options) &&
              q.options.length === 4 &&
              Number.isInteger(q?.correctIndex) &&
              q.correctIndex >= 0 &&
              q.correctIndex < 4
          )
          .slice(0, numMcqs)
      : [];

    const texts: GeneratedTextQ[] = Array.isArray(parsed?.texts)
      ? parsed.texts
          .filter((t: any) => typeof t?.prompt === "string")
          .slice(0, numTexts)
      : [];

    return { mcqs, texts };
  } catch {
    // If model didn't return valid JSON, fail open
    return { mcqs: [], texts: [] };
  }
}
