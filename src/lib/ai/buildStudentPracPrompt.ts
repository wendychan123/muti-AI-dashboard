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
    practiceTrend?: any;    // 練習投入走勢 (時間與次數)
    scoreTrend?: any;       // 學習成效走勢 (正確率變化)
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
        return "總覽練習概況";
      if (c === "indicator_effect")
        return "能力指標投入";
      if (c === "learning_process")
        return "學習歷程表現";
      if (c === "indicator_gap")
        return "能力指標差距）";
      if (c === "practice_trend")
        return "練習投入走勢）";
      if (c === "score_trend")
        return "學習成效走勢";
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

【輸出格式規則（嚴格遵守）】



請務必將回覆分為兩個部分，中間用「===詳細分析===」隔開：

第一部分：
(此處請勿出現「｜快讀總結」字樣)
這部分必須極度簡短（2-3 句話），整合所有數據給出一個最具代表性的學習現況描述。

第二部分：詳細分析內容
請使用以下符號規則：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行
- 全文必須使用第二人稱「你」
- 請勿使用「粗體」文字
- 請勿使用段落敘述

--- 輸出樣版範例 ---

｜快讀總結
（在這裡寫下 2-3 句的綜合摘要，例如：你在 ${subject} 的表現趨於穩定，雖然正確率有所提升，但作答速度仍有進步空間，建議針對特定弱項指標加強練習。）

===詳細分析===

｜學習狀態說明
•（1 句話總結你的學習狀況）
◦ 根據數據說明原因

｜圖表重點發現
•（列出 2–3 點）
（發現一：關於趨勢或規律）
${chartCount === 1 ? "  ◦ 深入解析此圖表的關鍵數據點" : "  ◦ 結合兩張圖表說明其中的關聯或因果"}
（發現二：關於表現或落差）
  ◦ 說明數據反映出的具體現象

｜學習優勢與需要注意的地方
學習優勢：
◦ 根據數據指出表現最穩定或優於平均的地方並說明原因
需要注意的地方：
◦ 指出數據中波動較大或低於預期的部分，明確指出可以再加強的地方

｜具體行動建議
•（列出 2–3 點）
◦ 使用「行動 + 目的」句型
（建議一：針對學習規律）
  ◦ 動作 + 目的（例如：固定在週二增加練習，以穩定正確率）
（建議二：針對弱項加強）
  ◦ 動作 + 目的（例如：針對差距較大的能力指標進行複習）
◦ 必須對應前面提到的分析發現

請保留標題格式，直接輸出內容。
`;
}