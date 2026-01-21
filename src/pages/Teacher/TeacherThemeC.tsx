import { useMemo } from "react";
import { useUserContext } from "@/contexts/UserContext";



export default function TeacherThemeC() {
  const { filteredRows } = useUserContext();



  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">
        學習歷程紀錄
      </h2>

    
    </div>
  );
}
