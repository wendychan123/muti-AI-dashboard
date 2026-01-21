// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react"; // 若沒有此icon可移除或換成其他

import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const { setUserSn, setRole, setUserInfo } = useUserContext();

  const [userSnInput, setUserSnInput] = useState("");
  const [loading, setLoading] = useState(false);

  /* =====================
     登入處理（Supabase）
     ===================== */
  const handleLogin = async () => {
    const sn = userSnInput.trim();
    if (!sn || loading) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_sn", sn);

      if (error) {
        console.error("users 查詢失敗:", error);
        alert("系統錯誤，請稍後再試");
        return;
      }

      if (!data || data.length === 0) {
        alert("查無此使用者編號（user_sn）");
        return;
      }

      const user = data[0];

      setUserSn(user.user_sn);
      setRole(user.role);
      setUserInfo(user);

      switch (user.role) {
        case "student":
          navigate("/student", { replace: true });
          break;
        case "teacher":
          navigate("/teacher", { replace: true });
          break;
        case "policy_maker":
          navigate("/policy", { replace: true });
          break;
        default:
          console.warn("未知角色:", user.role);
          alert("使用者角色異常，請聯絡管理者");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#d0f0f2] flex flex-col items-center justify-center p-4">
      {/* --- 背景裝飾 (放大線條比例) --- */}
      <div className="absolute inset-0 pointer-events-none">
         {/* 大 V 形線條 1 */}
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[120vh] border-r-[3px] border-white/40 transform -skew-x-[20deg]" />
        <div className="absolute top-[-20%] left-[10%] w-[60vw] h-[120vh] border-r-[3px] border-white/30 transform -skew-x-[20deg]" />
        
        {/* 右側線條 */}
        <div className="absolute top-[-10%] right-[20%] w-[2px] h-[120vh] bg-white/40 transform skew-x-[25deg]" />
        <div className="absolute top-[-10%] right-[15%] w-[2px] h-[120vh] bg-white/30 transform skew-x-[25deg]" />
      </div>

      {/* --- 頂部 Logo 區 (放大) --- */}
      <div className="relative z-10 mb-10 flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="text-[#3c6e71] font-bold text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl tracking-wide drop-shadow-sm">多層級教育智慧儀表板</h1>
                <p className="text-base sm:text-lg text-[#3c6e71]/80 tracking-wider mt-1">AI-Powered Multi-LOD Dashboard</p>
            </div>
        </div>
      </div>

      {/* --- 主要登入卡片 (寬度加大至 600px) --- */}
      <Card className="relative z-10 w-full max-w-[500px] border-none bg-white/50 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 pt-10">
          <CardTitle className="text-center text-3xl sm:text-4xl font-bold tracking-widest text-[#2c5c60] drop-shadow-sm">
            系統登入
          </CardTitle>
           {/* 提示語 */}
           <div className="mt-4 px-8 text-sm sm:text-base text-red-600/80 text-center font-medium">
            請輸入測試帳號以進入系統
          </div>
        </CardHeader>

        <CardContent className="px-8 sm:px-12 pb-12 pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-8"
          >
            {/* 表單區域 */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                    <Label 
                        htmlFor="userSn" 
                        className="w-full sm:w-24 text-left sm:text-right font-bold text-[#2c5c60] text-xl"
                    >
                        使用者
                    </Label>
                    <Input
                        id="userSn"
                        type="text"
                        placeholder="請輸入 user_sn"
                        // 高度改為 h-14，文字加大 text-xl
                        className="flex-1 bg-white/90 border-0 focus-visible:ring-2 focus-visible:ring-[#4ecdc4] h-14 text-xl px-4 shadow-inner rounded-lg"
                        value={userSnInput}
                        onChange={(e) => setUserSnInput(e.target.value)}
                    />
                </div>
                
            </div>

            {/* 按鈕區域 (加大) */}
            <div className="space-y-4 pt-4">
                <Button
                type="submit"
                disabled={!userSnInput.trim() || loading}
                // 高度改為 h-16 (py-8), 文字加大 text-2xl
                className="w-full bg-[#45c7c1] hover:bg-[#3bbeb8] text-white font-bold h-12 text-xl rounded-xl shadow-lg transition-all active:scale-[0.98]"
                >
                {loading ? "登入中…" : "登入"}
                </Button>
                
                <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white/80 hover:bg-white text-[#45c7c1] border-2 border-[#45c7c1] font-bold h-12 text-xl rounded-xl shadow-sm"
                    onClick={() => alert("目前僅開放測試帳號登入")}
                >
                    註冊
                </Button>
            </div>

            {/* 測試帳號提示區 (字體放大) */}
            <div className="mt-6 pt-6 border-t border-white/40 text-center">
                <p className="text-sm sm:text-base text-[#2c5c60]/90 font-bold mb-2">｜ 測試帳號 ｜</p>
                <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-8 text-sm sm:text-base text-[#2c5c60]/80">
                    <span className="font-mono px-2 py-1 rounded">
                    學生：4561, 312031 <br/>
                    教師：97352, 374057 <br/>
                    管理者：頁面開發中
                    </span>
                </div>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}