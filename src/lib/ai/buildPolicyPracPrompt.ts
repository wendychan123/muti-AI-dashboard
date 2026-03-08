export type PolicyExplainTarget =
  | "policy_overview"         // 總覽練習概況
  | "development_index"         // 練習診斷指標
  | "regional_gap"          // 區域學習差距
  | "gap_trend"        // 平均差距走勢
  | "practice_trend"   // 練習投入走勢
  | "effect_trend";     // 學習成效走勢

const POLICY_CHART_LABEL_MAP: Record<PolicyExplainTarget, string> = {
  policy_overview: "總覽練習概況",
  development_index: "練習診斷指標",
  regional_gap: "區域學習差距",
  gap_trend: "平均差距走勢",
  practice_trend: "練習投入走勢",
  effect_trend: "學習成效走勢",
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

export function buildPolicyPracPrompt(
  params: BuildPolicyPracPromptParams
): string {
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
    .map((c) => `- ${POLICY_CHART_LABEL_MAP[c]}`)
    .join("\n");

  const isSingle = selectedCharts.length === 1;

  return `
你是一位「教育政策分析顧問」，針對「${city} 教育管理者」之區域學習分析儀表板進行專業判讀。
請使用「專業、客觀、審慎、策略導向」語氣，不得使用口語化表達或對話式語句。

⚠️ 所有判斷必須嚴格依據提供的數據。
⚠️ 不得臆測未提供的數據。
⚠️ 不得假設學校個別情境。
⚠️ 不得給學生個別學習建議。

【分析範圍】
行政區域：${city}
科目範圍：${subjectLabel}
資料期間：${period || dateLabel}

【區域整體摘要數據】
學生人數：${fmtInt(stats.totalStudents)}
平均答題正確率：${fmt1(stats.avgScore)}%
人均練習次數：${fmt2(stats.avgPracPerStudent)}
平均校際差距：${schoolGapLabel}

【本次納入分析的圖表】
${chartsText}

---------------------------------------------------
重要任務說明：

${
  isSingle
    ? `
本次僅選擇 1 張圖表：
- 請進行「深入解析」。
- 必須說明該圖表的政策意涵。
- 必須說明其所反映的區域發展現象。
- 不可延伸至未選圖表。
`
    : `
本次選擇 2 張以上圖表：
- 必須進行「跨圖整合分析」。
- 不得逐張圖分開解釋。
- 必須說明圖與圖之間的關聯。
- 必須回答：
  1. 投入與成效是否一致？
  2. 成效差距是否與投入強度相關？
  3. 趨勢變化是否與區域結構有關？
  4. 是否存在結構性風險訊號？
`
}

所有判讀需依據：
- 提供之摘要數據
- 所選圖表內容
- 圖表所呈現之趨勢、差距或分布

---------------------------------------------------

【輸出格式規範】

【輸出格式規範（嚴格遵守）】

請務必將回覆分為兩個部分，中間用「===詳細分析===」隔開：

第一部分：
(此處請勿出現「｜快讀總結」字樣)
請提供 2-3 句極其精簡的宏觀判讀：
1. 描述區域整體教育發展的健康度（穩定/失衡/成長）。
2. 指出最顯著的結構性風險或區域資源缺口。
3. 給出一項具備「政策資源調度」意義的最高優先級動作。

第二部分：詳細分析報告內容
請用以下結構：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行
- 請勿使用敘述段落
- 確保建議屬於「行政與資源配置」層級，而非個別學生指導

===詳細分析===

｜整體練習狀況
•（列出 3–4 點，每點 1 句）
◦ 必須清楚說明本次分析條件（行政區域、科目、期間）
◦ 判讀整體學習發展狀態（穩定 / 改善 / 波動 / 需關注）
◦ 判讀投入與成效是否呈現合理關聯
◦ 若校際差距數據存在，說明其政策關注意義；若無資料，請說明資料缺口風險

｜圖表重點解讀
${
  isSingle
    ? `
•（針對該圖表提出 3 點解析）
◦ 說明圖表反映的教育狀況意義
◦ 說明數據呈現出的結構現象
◦ 說明可能的制度層面影響（不得超出數據）
`
    : `
•（列出 3 點跨圖整合發現）
◦ 每一點必須同時引用至少 2 張圖
◦ 必須說明圖與圖之間的因果或結構關聯
◦ 不得僅做單圖描述
`
}

｜決策提醒與優勢分析
區域優勢：
◦ 指出 1 項具政策價值之發展優勢（以系統層級表述）

潛在風險：
◦ 指出 1 項需監測之結構性風險
◦ 說明建議監測之指標或警戒訊號

｜具體行動建議
•（列出 3 點）
◦ 每一點需包含「策略動作 + 目的 + 針對對象」
◦ 必須屬於政策層級（資源配置、支持方案、分層輔導、監測機制）
◦ 不可給學生個別建議
◦ 不可假設未提供之數據

請保留上述標題格式，直接輸出內容。
`;
}