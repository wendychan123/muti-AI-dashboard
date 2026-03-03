import { useEffect, useState } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";

interface TeacherRow {
  user_sn: string;
  organization_id: number;
  grade: number | null;
  class: number | null;
}

export default function TeacherPrac() {
  const { userInfo } = useUserContext();

  const [students, setStudents] = useState<TeacherRow[]>([]);
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
      
    </div>
  );
}
