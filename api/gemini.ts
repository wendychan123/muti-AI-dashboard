import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ===== Simple rate limit =====
const rateLimitMap = new Map<
  string,
  { count: number; timestamp: number }
>();

const WINDOW_MS = 30 * 1000;
const MAX_REQUESTS = 5;

function checkRateLimit(ip: string) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (now - record.timestamp > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count += 1;
  return true;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error: "Too many requests",
        message: "AI 分析請求過於頻繁，請稍候再試",
      });
    }

    // ===== 取得 role =====
    const { prompt, role } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // ===== 根據角色選擇 API KEY =====
    let apiKey: string | undefined;

    if (role === "policy") {
      apiKey = process.env.GEMINI_API_KEY_1;
    } else {
      // student
      apiKey = process.env.GEMINI_API_KEY_3;
    }

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing Gemini API key for role",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return res.status(200).json({ text });
  } catch (err: any) {
    console.error("Gemini API error:", err);
    return res.status(500).json({
      error: "Gemini API error",
      detail: err.message,
    });
  }
}