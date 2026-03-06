// src/pages/StudentLogin.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot } from "lucide-react";

import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const { setUserSn, setRole, setUserInfo } = useUserContext();

  // 1. 預設填入第一個常用 ID
  const [userSnInput, setUserSnInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 2. 存放從資料庫抓取的學生 ID 列表
  const [studentList, setStudentList] = useState<string[]>([]);
  const [fetchingList, setFetchingList] = useState(false);

  /* =====================
     自動抓取學生列表
     ===================== */
  useEffect(() => {
    const fetchStudentIds = async () => {
      setFetchingList(true);
      try {
        const { data, error } = await supabase
          .from("user_data")
          .select("user_id")
          .eq("role", "student"); 

        if (!error && data) {
          // 提取 user_id 並過濾掉重複或空值
          const ids = data.map((item: any) => item.user_id).filter(Boolean);
          setStudentList(ids);
        }
      } catch (err) {
        console.error("無法取得學生列表:", err);
      } finally {
        setFetchingList(false);
      }
    };

    fetchStudentIds();
  }, []);

  /* =====================
     登入處理（Supabase）
     ===================== */
  const handleLogin = async () => {
    const sn = userSnInput.trim();
    if (!sn || loading) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("user_data")
        .select("*")
        .eq("user_id", sn);

      if (error) {
        console.error("user 查詢失敗:", error);
        alert("系統錯誤，請稍後再試");
        return;
      }

      if (!data || data.length === 0) {
        alert("查無此使用者 (user_id)");
        return;
      }

      const user = data[0];
      setUserSn(user.user_sn);
      setRole(user.role);
      setUserInfo(user);

      if (user.role === "student") {
        navigate("/student", { replace: true });
      } else {
        alert("使用者角色錯誤");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#d0f0f2] flex flex-col items-center justify-center p-4 font-sans">
      
      {/* 背景裝飾線條 */}
      {/* --- 背景裝飾 (模擬截圖中的白色線條) --- */}
      <div className="absolute inset-0 pointer-events-none">
         {/* 大 V 形線條 1 */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[100vh] border-r-2 border-white/40 transform -skew-x-[20deg]" />
        <div className="absolute top-[-20%] left-[10%] w-[50vw] h-[100vh] border-r-2 border-white/30 transform -skew-x-[20deg]" />
        
        {/* 右側線條 */}
        <div className="absolute top-[-10%] right-[20%] w-[1px] h-[120vh] bg-white/40 transform skew-x-[25deg]" />
        <div className="absolute top-[-10%] right-[15%] w-[1px] h-[120vh] bg-white/30 transform skew-x-[25deg]" />
      </div>


      {/* 標題區 */}
      <div className="relative z-10 mb-6 flex flex-col items-center gap-2">
        <div className="text-[#3c6e71] font-bold text-center">
          <h1 className="text-2xl sm:text-3xl tracking-wide drop-shadow-sm">多層級教育智慧儀表板</h1>
          <p className="text-sm sm:text-base text-[#3c6e71]/70 tracking-wider mt-1 uppercase">AI-Powered Multi-LOD Dashboard</p>
        </div>
      </div>

      {/* 登入卡片 */}
      <Card className="relative z-10 w-full max-w-[450px] border-none bg-white/40 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-6 pt-8 text-center">
          <CardTitle className="ext-center text-2xl sm:text-3xl font-bold text-[#2c5c60] drop-shadow-sm">
            學生系統登入
          </CardTitle>
          <div className="mt-4 px-8 text-sm text-red-600/80 text-center font-medium">
            請輸入或選擇測試帳號進入系統
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8 pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="userid" className="sm:w-25 sm:text-right font-bold text-[#2c5c60]">
                  學生帳號
                </Label>
                <Input
                  id="userSn"
                  type="text"
                  placeholder="請輸入 user_id"
                  className="flex-1 bg-white/80 border-slate-200 focus-visible:ring-[#4ecdc4] h-11"
                  value={userSnInput}
                  onChange={(e) => setUserSnInput(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 ">
              <Button
                type="submit"
                disabled={!userSnInput.trim() || loading}
                className="w-full bg-[#45c7c1] hover:bg-[#3bbeb8] text-white font-bold py-4 text-base rounded-lg shadow-md transition-all active:scale-[0.98]"
              >
                {loading ? "登入中…" : "登入"}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white/50 hover:bg-white text-[#45c7c1] border border-[#45c7c1] font-bold py-4 text-base rounded-lg"
                onClick={() => navigate("/")}
              >
                返回首頁
              </Button>
            </div>

            {/* 可滾動的測試帳號 ID 列表 */}
            <div className="mt-6 pt-4 border-t border-[#3c6e71]/20">
              <p className="text-xs text-[#2c5c60] font-bold text-center mb-3 flex items-center justify-center gap-1">
                 ｜ 測試帳號列表 (點擊可填入) ｜
              </p>
              
              <div className="
                max-h-[150px] 
                overflow-y-auto 
                bg-white/40 
                rounded-xl 
                p-3
                border border-[#3c6e71]/10
                scrollbar-thin scrollbar-thumb-slate-300
              ">
                {fetchingList ? (
                  <div className="text-center py-4 text-xs text-slate-400 animate-pulse">正在讀取學生名單...</div>
                ) : studentList.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {studentList.map((id) => (
                      <div
                        key={id}
                        onClick={() => setUserSnInput(id)}
                        className={`
                          text-[12px] font-mono p-1 rounded-md cursor-pointer transition-all text-center
                          ${userSnInput === id 
                            ? "bg-[#45c7c1]/90 text-white shadow-sm" 
                            : "text-[#2c5c60]/80 hover:bg-[#45c7c1]/10 hover:text-[#2c5c60]"}
                        `}
                      >
                        {id}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400">尚無學生資料</div>
                )}
              </div>
              <p className="text-[10px] text-[#2c5c60]/40 text-center mt-2 font-medium">
                目前共有 {studentList.length} 位學生測試帳號
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}