interface BuildPracPromptParams {
  date: string | null;
  subject: string;
  indicator: string;
  selectedCharts: string[];

  stats: {
    avgScore: number;
    avgSpeedSec: number;
    totalCount: number;
    belowClassCount: number;
    reachedGoal: boolean;
  };

  chartData?: {
    indicatorEffect?: any;
    learningProcess?: any;
    indicatorGap?: any;
  };
}

export function buildStudentPracPrompt(params: BuildPracPromptParams): string {
  const {
    date,
    subject,
    indicator,
    selectedCharts,
    stats,
    chartData,
  } = params;

  const chartCount = selectedCharts.length;

  const chartDescriptions = selectedCharts
    .map(c => {
      if (c === "daily_overview")
        return "總覽練習概況（投入時間與正確率整體表現）";
      if (c === "indicator_effect")
        return "能力指標投入成效（練習次數與表現分布）";
      if (c === "learning_process")
        return "學習歷程表現（速度 × 正確率四象限）";
      if (c === "indicator_gap")
        return "能力指標差距分析（與班級平均差距）";
      return c;
    })
    .map(t => `- ${t}`)
    .join("\n");

  const analysisInstruction =
    chartCount === 1
      ? `
【分析模式說明】
本次只指定 1 張圖表。
請專注解析這張圖所呈現的重點現象，說明它代表你的學習狀況與可能原因。
請不要強行進行跨圖推論。
`
      : `
【分析模式說明】
本次指定了 ${chartCount} 張圖表。
請進行跨圖整合分析，說明圖與圖之間的關聯。
嚴禁逐張圖分開解釋。
每一個重點都必須同時引用至少兩張圖的資訊。
`;

  return `
你是一位「學習助教」，正在對使用者說明他的學習分析結果。
請全程使用第二人稱（你），避免使用「學生」這個詞。
請使用清楚、溫和、具體、不使用專業術語的語氣，根據所有提供的數據進行判斷。


【分析背景】
分析期間：${date ?? "整體期間"}
科目：${subject === "all" ? "跨科目" : subject}
能力指標：${indicator === "all" ? "多項能力指標" : indicator}

【你的整體數據摘要】
平均正確率：${stats.avgScore}%
平均作答時間：${stats.avgSpeedSec} 秒
練習次數：${stats.totalCount}
低於班級平均的能力指標數：${stats.belowClassCount}
是否已達學習目標：${stats.reachedGoal ? "是" : "否"}

【本次納入分析的圖表】
${chartDescriptions}

${analysisInstruction}

【各圖表數據摘要（供推論使用）】
${JSON.stringify(chartData ?? {}, null, 2)}

---------------------------------------------------
重要任務提醒：
- 若只選 1 張圖，請專注深入解析該圖的意義與你的學習現象。
- 若選 2 張以上圖表，請務必說明圖與圖之間的關係，而非單圖描述。
- 所有判斷都必須根據提供的數據，不可憑空推測。
---------------------------------------------------

【輸出格式規則】

請使用以下符號規則：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行
- 全文必須使用第二人稱「你」
- 請勿使用段落敘述

｜學習狀態說明
•（1 句話總結你的學習狀況）
◦ 根據數據說明原因

｜圖表重點發現
•（列出 2–3 點）

${chartCount === 1
  ? "◦ 請深入說明這張圖呈現的學習現象與原因"
  : "◦ 每一點都必須同時提及至少兩張圖的關聯"}

｜學習優勢與需要注意的地方
學習優勢：
◦ 說明你目前較好的表現與原因
需要注意的地方：
◦ 明確指出你可以再加強的地方

｜具體行動建議
•（列出 2–3 點）
◦ 使用「動作 + 目的」句型
◦ 必須對應前面提到的分析發現

請保留標題格式，直接輸出內容。
`;
}