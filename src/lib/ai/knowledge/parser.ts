// 如果您的專案編譯時這裡報錯，請把 .md 檔案改成 .ts 檔案，並用 export const MathText = `內容` 的方式匯出。
import mathText from './Math.md?raw'; 
import englishText from './English.md?raw';
import chineseText from './Chinese.md?raw';

export function extractKnowledgeContext(subject: string, indicators: string[]): string {
  // 1. 根據科目選擇對應的文本庫
  let textDb = "";
  if (subject.includes("數學")) textDb = mathText;
  else if (subject.includes("英語") || subject.includes("英文")) textDb = englishText;
  else if (subject.includes("國語") || subject.includes("語文")) textDb = chineseText;

  if (!textDb) return "";

  // ==========================================
  // 有指定特定知識節點 (教師端 / 學生端)
  // ==========================================
  if (indicators && indicators.length > 0) {
    let result = "";
    for (const ind of indicators) {
      if (!ind || ind === "全部知識節點") continue;

      // 避開特殊字元造成的正則錯誤
      const safeInd = ind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); 
      
      // 匹配「指標代碼」或「節點名稱」的區塊
      const regexCode = new RegExp(`### \\[(?:指標代碼：)?${safeInd}\\][\\s\\S]*?(?=\\n---|$)`, 'g');
      const matchCode = textDb.match(regexCode);
      
      if (matchCode) {
        result += matchCode[0] + "\n\n";
      } else {
        // 如果代碼找不到，嘗試找節點名稱
        const regexName = new RegExp(`\\*\\*節點名稱\\*\\*：${safeInd}[\\s\\S]*?(?=\\n---|$)`, 'g');
        const matchName = textDb.match(regexName);
        if (matchName) result += matchName[0] + "\n\n";
      }
    }
    return result.trim();
  }

  // ==========================================
  // 沒有指定節點，看全科總覽 (管理者/教育局端 Policy)
  // ==========================================
  // 掃描整個檔案，把所有 `> **管理者建議 (Policy)**：` 後面的文字抽出來
  const policyRegex = /> \*\*管理者建議 \(Policy\)\*\*：(.*)/g;
  const policyMatches = [...textDb.matchAll(policyRegex)].map(m => m[1].trim());

  if (policyMatches.length > 0) {
    // 核心邏輯：因為很多單元會共用同一條政策建議，所以我們用 Set 來「去除重複」
    const uniquePolicies = Array.from(new Set(policyMatches));
    
    return `以下是本科目（${subject}）專屬的政策調度與行政建議清單，請優先從中挑選最適合當前圖表數據異常狀況的策略來回答：\n` +
           uniquePolicies.map(p => `- ${p}`).join("\n");
  }

  return "";
}