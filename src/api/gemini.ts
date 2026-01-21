import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req, res) {
  const { question, context } = req.body;

  const prompt = `
你是一位學習分析輔助 AI。
你只能根據以下 JSON 的學習分析結果進行回應，
不得假設任何未提供的資訊。

學習分析資料：
${JSON.stringify(context, null, 2)}

使用者問題：
${question}

請提供：
1. 一段解釋目前學習狀況的描述
2. 一個最值得注意的學習現象
3. 1–2 個具體可執行的學習建議
`;

  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent(prompt);

  res.json({ text: result.response.text() });
}
