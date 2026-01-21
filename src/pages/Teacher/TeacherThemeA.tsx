// src/pages/Teacher/TeacherThemeA.tsx
import { useEffect, useState } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";

interface StudentRow {
  user_sn: string;
  organization_id: number;
  grade: number | null;
  class: number | null;
}

export default function TeacherThemeA() {
  const { userInfo } = useUserContext();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  /* =========================
     載入該老師班級的學生名單
     ========================= */
  useEffect(() => {
    if (!userInfo) return;
    if (userInfo.role !== "teacher") return;

    const loadStudents = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("users")
        .select("user_sn, organization_id, grade, class")
        .eq("organization_id", userInfo.organization_id)
        .eq("grade", userInfo.grade)
        .eq("class", userInfo.class)
        .eq("role", "student")
        .order("user_sn", { ascending: true });

      if (error) {
        console.error("讀取學生名單失敗:", error);
        setLoading(false);
        return;
      }

      setStudents(data ?? []);
      setLoading(false);
    };

    loadStudents();
  }, [userInfo]);

  /* =========================
     Render
     ========================= */
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">
        班級學生名單
      </h2>

      <p className="text-sm text-slate-500">
        班級：{userInfo?.grade} 年 {userInfo?.class} 班
      </p>

      {loading && (
        <div className="text-slate-500 text-sm">
          載入學生名單中…
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="text-slate-400 text-sm">
          目前尚無學生資料
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((stu) => (
          <Card key={stu.user_sn} className="p-4">
            <div className="text-sm text-slate-500">學生編號</div>
            <div className="text-xl font-bold text-slate-800">
              {stu.user_sn}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
