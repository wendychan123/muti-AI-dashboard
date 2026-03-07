// src/pages/TeacherLogin.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";

export default function TeacherLogin() {
  const navigate = useNavigate();
  const { setUserSn, setRole, setUserInfo } = useUserContext();

  const [cityList, setCityList] = useState<string[]>([]);
  const [schoolList, setSchoolList] = useState<any[]>([]);

  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");

  const [loading, setLoading] = useState(false);

  /* =====================
     初始化縣市（僅教師）
     ===================== */
  useEffect(() => {
    const loadCities = async () => {
      const { data, error } = await supabase
        .from("user_data")
        .select("city")
        .eq("role", "teacher");

      if (error) {
        console.error(error);
        return;
      }

      const uniq = Array.from(
        new Set(data?.map((d: any) => d.city))
      ).filter(Boolean).sort();

      setCityList(uniq as string[]);
    };

    loadCities();
  }, []);

  /* =====================
     載入該縣市學校（僅教師）
     ===================== */
  useEffect(() => {
    if (!selectedCity) return;

    const loadSchools = async () => {
      const { data, error } = await supabase
        .from("user_data")
        .select("organization_id")
        .eq("role", "teacher")
        .eq("city", selectedCity);

      if (error) {
        console.error(error);
        return;
      }

      const uniqSchools = Array.from(
        new Map(
          data?.map((item: any) => [
            item.organization_id,
            item,
          ])
        ).values()
      );

      setSchoolList(uniqSchools);
      setSelectedSchool("");
    };

    loadSchools();
  }, [selectedCity]);

  /* =====================
     真正登入驗證
     ===================== */
  const handleLogin = async () => {
    if (!selectedCity || !selectedSchool || loading) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("user_data")
        .select("*")
        .eq("role", "teacher")
        .eq("city", selectedCity)
        .eq("organization_id", selectedSchool)
        .limit(1);

      if (error) {
        console.error(error);
        alert("登入失敗，請稍後再試");
        return;
      }

      if (!data || data.length === 0) {
        alert("查無教師帳號，請確認資料設定");
        return;
      }

      const teacher = data[0];

      // 寫入 context
      setUserSn(teacher.user_sn);
      setRole("teacher");
      setUserInfo(teacher);

      navigate("/teacher", { replace: true });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#ece6f4]/50 flex flex-col items-center justify-center p-4">

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
      <div className="relative z-10 mb-5 flex flex-col items-center gap-2">
        {/* 標題 */}
        <div className="flex items-center gap-3">
            <div className="text-[#3f0c5e] font-bold text-center sm:text-center">
                <h1 className="text-2xl sm:text-3xl tracking-wide drop-shadow-sm">多層級教育智慧儀表板</h1>
                <p className="text-base sm:text-lg text-[#3f0c5e]/80 tracking-wider mt-1">AI-Powered Multi-LOD Dashboard</p>
            </div> 
        </div>
      </div>

      

      <Card className="relative z-10 w-full max-w-[450px] border-none bg-white/50 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
        <CardHeader className="pt-8 pb-8">
          <CardTitle className="text-center text-2xl sm:text-3xl font-bold  text-[#3f0c5e] drop-shadow-sm">
            教師系統登入
          </CardTitle>

        {/* 提示語 */}
        <div className="mt-4 px-8 text-sm sm:text-base text-red-600/80 text-center font-medium">
        請選取所屬縣市與學校以進入系統
        </div>
          
    
        </CardHeader>

        <CardContent className="px-8 pb-10 space-y-4">

          {/* 所屬縣市 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Label className="w-24 text-center font-medium text-[#3f0c5e] text-base">
              所屬縣市
            </Label>
            <Select
              value={selectedCity}
              onValueChange={setSelectedCity}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="請選擇縣市" />
              </SelectTrigger>
              <SelectContent>
                {cityList.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 所屬學校 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Label className="w-24 text-center font-medium text-[#3f0c5e] text-base">
              所屬學校
            </Label>
            <Select
              value={selectedSchool}
              onValueChange={setSelectedSchool}
              disabled={!selectedCity}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="請選擇學校" />
              </SelectTrigger>
              <SelectContent>
                {schoolList.map((school: any) => (
                  <SelectItem
                    key={school.organization_id}
                    value={school.organization_id}
                  >
                    {school.organization_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 按鈕 */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleLogin}
              disabled={!selectedCity || !selectedSchool || loading}
              className="w-full bg-[#58339e] hover:bg-[#743bbe] text-white font-bold py-5 text-lg rounded shadow-md transition-all active:scale-[0.98]"
            >
              {loading ? "登入中…" : "登入"}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="w-full bg-white hover:bg-gray-50 text-[#7245c7] border border-[#7245c7] font-bold py-5 text-lg rounded shadow-sm"
            >
              返回首頁
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}