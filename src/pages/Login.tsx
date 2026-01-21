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
    <div
      className="min-h-screen bg-cover bg-center relative flex items-center justify-center"
      style={{ backgroundImage: `url(${educationBg})` }}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />

      <Card className="relative z-10 w-full max-w-md bg-white/95 shadow-xl rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-cyan-600 rounded-full flex items-center justify-center mb-3">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            使用者登入
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="userSn" className="flex items-center gap-1">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>使用者</span>
              </Label>
              <Input
                id="userSn"
                type="text"
                placeholder="請輸入您的 user_sn"
                value={userSnInput}
                onChange={(e) => setUserSnInput(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={!userSnInput.trim() || loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-medium py-2 sm:py-3 text-sm sm:text-base rounded-lg"
            >
              {loading ? "登入中…" : "進入系統"}
            </Button>

            <div className="mt-4 pt-3 border-t border-border/20 space-y-1 text-center">
                    <p className="text-[9px] sm:text-xs text-muted-foreground/70">
                      ｜測試流水號｜
                    </p>
                    <p className="text-[8px] sm:text-xs text-muted-foreground/60">
                      學生：4561、312031
                    </p>
                    <p className="text-[8px] sm:text-xs text-muted-foreground/60">
                      教師：97352、374057
                    </p>
                  </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
