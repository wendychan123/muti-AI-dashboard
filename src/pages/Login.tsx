// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, User  } from "lucide-react";

import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import educationBg from "@/assets/education-bg.jpg";

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
      // 查 users table（不用 single，避免異常資料直接 throw）
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

      // 寫入 UserContext（一次完成）
      setUserSn(user.user_sn);
      setRole(user.role);
      setUserInfo(user);

      // 依角色導向正確的 Layout
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
      {/* --- 背景裝飾 (模擬截圖中的白色線條) --- */}
      <div className="absolute inset-0 pointer-events-none">
         {/* 大 V 形線條 1 */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[100vh] border-r-2 border-white/40 transform -skew-x-[20deg]" />
        <div className="absolute top-[-20%] left-[10%] w-[50vw] h-[100vh] border-r-2 border-white/30 transform -skew-x-[20deg]" />
        
        {/* 右側線條 */}
        <div className="absolute top-[-10%] right-[20%] w-[1px] h-[120vh] bg-white/40 transform skew-x-[25deg]" />
        <div className="absolute top-[-10%] right-[15%] w-[1px] h-[120vh] bg-white/30 transform skew-x-[25deg]" />
      </div>

      {/* --- 頂部 Logo 區 (模擬) --- */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        {/* 這裡模擬截圖中的 V 型 Logo */}
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-400 to-green-500 rounded flex items-center justify-center text-white shadow-sm">
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="text-[#3c6e71] font-bold">
                <h1 className="text-lg sm:text-xl tracking-wide">多層級教育智慧儀表板</h1>
                <p className="text-xs sm:text-sm text-[#3c6e71]/80 tracking-wider">AI-Powered Multi-LOD Dashboard</p>
            </div>
        </div>
      </div>

      {/* --- 主要登入卡片 --- */}
      <Card className="relative z-10 w-full max-w-[400px] border-none bg-white/40 shadow-xl backdrop-blur-md rounded-xl overflow-hidden">
        <CardHeader className="pb-2 pt-6">
          <CardTitle className="text-center text-2xl font-bold tracking-widest text-[#2c5c60] drop-shadow-sm">
            系統登入
          </CardTitle>
          
          {/* 模擬紅色警告文字 (保留你的提示功能) */}
          <div className="mt-2 px-2 py-1 text-xs text-red-600/90 text-center leading-relaxed font-medium">
            已有舊系統帳號者，因本計畫於系統整併及版本升級，請直接輸入下方測試編號登入。
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8 pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-6"
          >
            {/* 模仿截圖的表單樣式：Label 在左，Input 在右 */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <Label 
                        htmlFor="userSn" 
                        className="w-16 text-right font-medium text-[#2c5c60] text-base"
                    >
                        使用者帳號
                    </Label>
                    <Input
                        id="userSn"
                        type="text"
                        placeholder="請輸入 user_sn"
                        className="flex-1 bg-white/90 border-0 focus-visible:ring-2 focus-visible:ring-[#4ecdc4] h-10 shadow-inner"
                        value={userSnInput}
                        onChange={(e) => setUserSnInput(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3 pt-2">
                <Button
                type="submit"
                disabled={!userSnInput.trim() || loading}
                className="w-full bg-[#45c7c1] hover:bg-[#3bbeb8] text-white font-bold py-5 text-lg rounded shadow-md transition-all active:scale-[0.98]"
                >
                {loading ? "登入中…" : "登入"}
                </Button>
                
                <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white hover:bg-gray-50 text-[#45c7c1] border border-[#45c7c1] font-bold py-5 text-lg rounded shadow-sm"
                    onClick={() => alert("目前僅開放測試帳號登入")}
                >
                    註冊
                </Button>
            </div>

            {/* 測試帳號提示區 */}
            <div className="mt-4 pt-4 border-t border-white/30 space-y-1 text-center">
                <p className="text-xs text-[#2c5c60]/80 font-bold mb-1">｜測試流水號｜</p>
                <div className="flex justify-center gap-4 text-xs text-[#2c5c60]/70">
                    <span className="font-mono">學生：4561, 312031</span>
                    <span className="font-mono">教師：97352, 374057</span>
                </div>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
