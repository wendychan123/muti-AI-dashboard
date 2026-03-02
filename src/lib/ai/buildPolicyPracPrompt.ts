// buildPolicyPracPrompt.ts

export type PolicyExplainTarget =
  | "overview"         // 總覽練習概況
  | "development_index"         // 學力發展指標（四象限）
  | "regional_gap"          // 區域學習差距（排名/比較）
  | "gap_trend"        // 平均差距趨勢
  | "practice_trend"   // 練習投入趨勢
  | "effect_trend";     // 學習成效趨勢

const POLICY_CHART_LABEL_MAP: Record<PolicyExplainTarget, string> = {
  overview: "總覽練習概況（整體投入與表現）",
  development_index: "學力發展指標（投入 × 成效四象限）",
  regional_gap: "區域學習差距（橫向比較）",
  gap_trend: "平均差距趨勢（公平性變動）",
  practice_trend: "練習投入趨勢",
  effect_trend: "學習成效趨勢",
};


export interface BuildPolicyPracPromptParams {
  city: string;
  subject: string;
  period: string;
  startDate: string | null;
  endDate: string | null;

  selectedCharts: PolicyExplainTarget[];

  stats: {
    totalStudents: number;
    avgScore: number;            // 百分比 (0-100)
    avgPracPerStudent: number;   // 人均練習
    schoolGap: number | null;    // 平均校際差距
  };
}

function fmtInt(n: number) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";
}
function fmt1(n: number) {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}
function fmt2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

export function buildPolicyPracPrompt(params: BuildPolicyPracPromptParams): string {
  const {
    city,
    subject,
    period,
    startDate,
    endDate,
    selectedCharts,
    stats,
  } = params;

  const subjectLabel =
    subject === "全部科目" ? "跨科目整體分析" : subject;

  const dateLabel =
    startDate && endDate ? `${startDate} ～ ${endDate}` : "—";

  const schoolGapLabel =
    typeof stats.schoolGap === "number" && Number.isFinite(stats.schoolGap)
      ? fmt2(stats.schoolGap)
      : "—";

  const chartsText = selectedCharts
    .map((c) => `- ${POLICY_CHART_LABEL_MAP[c] ?? c}`)
    .join("\n");

  return `
你是一位「教育政策分析顧問」，正在協助教育局管理者解讀區域學習分析儀表板。
請使用「專業、客觀、具策略思維」的語氣，避免口語與情緒化措辭。

【分析範圍】
行政區域：${city}
科目範圍：${subjectLabel}
資料期間：${period || dateLabel}

【區域整體概況（摘要）】
學生人數：${fmtInt(stats.totalStudents)}
平均答題正確率：${fmt1(stats.avgScore)}%
人均練習次數：${fmt2(stats.avgPracPerStudent)}
平均校際差距：${schoolGapLabel}

【本次需要解讀的圖表】
${chartsText}

【輸出規範（務必遵守）】
- 主項目使用「•」
- 子說明使用「◦」
- 每個段落請空一行
- 請勿使用敘述段落，全部以列點呈現
- 僅提供「政策/管理層」建議：不得給學生個別學習建議、不得假設個別學校真實情境、不得捏造未提供的數據

｜區域整體發展判讀
•（列出 3–4 點，每點 1 句）
◦ 說明本次分析的範圍與條件（需包含行政區域、科目、期間）
◦ 判讀整體學習成效水準（例如：穩定、改善、波動、需關注）
◦ 判讀投入與成效是否呈現合理關聯（是否可能存在高投入低成效/低投入高成效）
◦ 判讀校際差距是否具政策關注必要（若無資料請改以資料缺口風險表述）

｜圖表重點解讀
•（依使用者選擇順序，每張圖表 1 點）
◦ 說明該圖表主要反映的重點意義
◦ 說明目前呈現出的趨勢或風險訊號（含可能原因，但不得臆測超出資料範圍）

｜決策提醒與優勢分析
• 區域優勢：
◦ 指出 1 項值得維持或擴散的策略方向（以政策語言描述）
• 潛在風險：
◦ 指出 1 項需提前監測或干預的現象（並說明「監測指標」或「警戒訊號」）

｜具體行動建議
•（列出 3 點）
◦ 每一點需包含「策略動作 + 目的 + 對象」
◦ 例如：「加強教師專業支持，以提升＿＿學校之教學成效」
◦ 建議需具政策層級思維（資源配置、支持方案、監測機制、分層輔導），不可給學生個別建議

請保留上述標題格式，不要新增其他段落或結語，直接輸出內容。
`;
}