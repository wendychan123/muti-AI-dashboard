// src/pages/StudentThemeB.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "@/contexts/UserContext";
import { Card } from "@/components/ui/card";

export default function TeacherThemeB() {
  const navigate = useNavigate();
  const { userSn, rows } = useUserContext();

  /* =========================
     Render
     ========================= */
  return (
    <div className="space-y-6">
      
    </div>
  );
}
