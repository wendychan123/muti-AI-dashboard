export type TeacherPracChartTarget = 
  | "teacher_overview"   // 總覽
  | "diagnostic"         // 教學診斷指標 (四象限)
  | "participation"      // 作答參與度
  | "practice_trend"     // 練習投入走勢
  | "performance_trend"  // 學習成效走勢
  | "proficiency"        // 能力指標精熟度
  | "student_risk";      // 待關注學生

const TEACHER_CHART_LABEL_MAP: Record<TeacherPracChartTarget, string> = {
  teacher_overview: "總覽練習表現",
  diagnostic: "教學診斷指標",
  participation: "作答參與度",
  practice_trend: "練習投入走勢",
  performance_trend: "學習成效走勢",
  proficiency: "能力指標精熟度",
  student_risk: "高風險學生與弱點指標",
};

export interface BuildTeacherPracPromptParams {
  city: string;
  organization_id: string;
  grade: string;
  subject: string;
  period: string;
  selectedCharts: TeacherPracChartTarget[];

  stats: {
    totalStudents: number;         // 班級總人數
    avgScore: number;              // 平均正確率
    avgPracPerStudent: number;     // 人均練習次數
    notMasteredStudents: number;   // 未精熟學生人數
    notMasteredIndicators: number; // 未精熟指標總數
  };
}

// 格式化輔助函數
function fmtInt(n: number) { return Number.isFinite(n) ? Math.round(n).toLocaleString() : "—"; }
function fmt1(n: number) { return Number.isFinite(n) ? n.toFixed(1) : "—"; }

export function buildTeacherPracPrompt(params: BuildTeacherPracPromptParams): string {
  const { city, organization_id, grade, subject, period, selectedCharts, stats } = params;

  const subjectLabel = subject === "全部科目" ? "跨科目綜合表現" : subject;
  const chartsText = selectedCharts.map((c) => `- ${TEACHER_CHART_LABEL_MAP[c]}`).join("\n");
  const isSingle = selectedCharts.length === 1;

  return `
你是一位專業的「教學輔導專家」，協助 「${city} ${organization_id}」 國小老師判讀該學校學習大數據儀表板
你的目標是透過數據識別該校的學習痛點與教學斷點，提供精準的教學調整建議。
請使用「專業、具同理心、實務導向」的語氣，，不得使用口語化表達或對話式語句，且避免過度僵硬的行政用語。

⚠️ 所有判斷必須嚴格依據提供的數據。
⚠️ 不得臆測未提供的數據。
⚠️ 不得假設學校個別情境。
⚠️ 不得給學生個別學習建議。
⚠️ 所有的建議必須是教學現場可執行的動作。

【分析背景】
• 縣市：${city}
• 學校：${organization_id}
• 對象：${grade} 年級
• 科目：${subjectLabel}
• 分析區間：${period}

【班級關鍵 KPI】
• 參與學生數：${fmtInt(stats.totalStudents)} 位
• 全校平均正確率：${fmt1(stats.avgScore)}%
• 每人平均練習次數：${fmt1(stats.avgPracPerStudent)} 次
• 未精熟學生數：${fmtInt(stats.notMasteredStudents)} 位（需優先關注）
• 未精熟能力指標數：${fmtInt(stats.notMasteredIndicators)} 項

【本次納入診斷之圖表】
${chartsText}

---------------------------------------------------
重要任務說明：

${
  isSingle
    ? `
本次僅選擇 1 張圖表：
- 請進行「深入解析」。
- 分析該數據背後隱藏的教學意義。
- 識別出該維度下的優勢學生群或弱勢指標。
- 說明這對接下來的教學進度有何影響。`
    : `

本次選擇 2 張以上圖表：
- 必須進行「跨圖整合分析」。
- 不得逐張圖分開解釋。
- 分析整合分析背後隱藏的教學意義。
- 必須關聯投入度（練習次數）與成效（正確率）。
- 必須結合能力指標精熟度與待關注學生進行交叉比對。
- 找出是否存在高投入但低成效的瓶頸單元，或低參與導致低成效的進度遺漏。`
}

所有判讀需依據：
- 提供之摘要數據
- 所選圖表內容
- 圖表所呈現之趨勢、差距或分布

---------------------------------------------------


【輸出格式規範（嚴格遵守）】

請務必將回覆分為兩個部分，中間用「===詳細分析===」隔開：

第一部分：
(此處請勿出現「｜快讀總結」字樣)
這部分請控制在 3 句話內。
- 第一句：總結該學校目前的教學健康狀態（如：進度穩定、出現分化、投入不足等）。
- 第二句：指出最迫切需要老師介入的「指標」或「學生群體」。
- 第三句：給出一個最核心的教學建議動作。

第二部分：詳細分析內容
請用以下結構，並確保：
- 主項目請使用「•」
- 子說明請使用「  ◦」(縮排兩空格)
- 每個段落請空一行
- 請勿使用「粗體」文字
- 請勿使用敘述段落，確保老師能快速掃描重點

===詳細分析===

｜整體練習狀況
•（列出 3–4 點，每點 1 句）
◦ 必須清楚說明本次分析條件（學校、年級、科目）
◦ 說明整體學習狀態（超前 / 穩定 / 嚴重落後 / 分化嚴重）
◦ 判讀練習強度是否足以支撐該單元的精熟要求
◦ 針對「未精熟人數」比例進行預警分析

｜圖表重點解讀
${
  isSingle
    ? `
  •（針對該圖表提出 3 點解析）
  ◦ 描述數據分布呈現的學習特徵
  ◦ 指出特定需要補救的單元或學生類型
  ◦ 識別出教學上的盲點或學生普遍的誤區`
  : `
•（提出 3 點跨圖整合發現）
  ◦ 每一點必須結合至少 2 張圖表的資訊（例如：參與度下降是否導致了正確率走勢下滑）
  ◦ 必須說明圖與圖之間的因果或結構關聯，不得僅做單圖描述
  ◦ 識別出哪些指標是全班性弱點，哪些是少數學生瓶頸`
}

｜教學介入策略建議
優勢：
  ◦ 找出 1 個值得表揚或維持的學習表現（如：某指標精熟度高、參與度穩定）

風險：
  ◦ 指出當前最需立即干預的單元或高風險學生群體
  ◦ 說明若不處理，可能對後續單元造成的影響或警戒訊號

｜行動建議
•（提出 3 點教學行動方案）
◦ 必須包含「教學動作 + 針對對象 + 預期效果」，用一句話描述。
◦ 必須屬於教學層級（分層教學、補救練習、同儕輔導、課堂複習策略、個別面談）
◦ 必須具備教學實務上的操作性
◦ 不可假設未提供之數據

請保留上述標題格式，直接輸出內容。
`;
}