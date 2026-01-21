import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

/* =====================
   型別定義
   ===================== */
export type UserRole = "student" | "teacher" | "policy_maker";

export interface UserInfo {
  user_sn: string;
  role: UserRole;
  organization_id: number;
  grade?: number | null;
  class?: number | null;
}

/* === daily summary row === */
export interface DailySummaryRow {
  user_sn: string;
  activity_date: string;
  platform: "dp001" | "dp002" | "dp003";
  learning_time_sec: number;
  activity_count: number;
  attempt_count: number;
  correct_count: number;
  incorrect_count: number;
  correct_rate: number | null;
}

/* =====================
   Context Value
   ===================== */
export interface UserContextValue {
  /* === 登入身分 === */
  userSn: string | null;
  role: UserRole | null;
  userInfo: UserInfo | null;

  /* === 資訊 === */
  organizationId: number | null;
  gradeId: number | null;
  classId: number | null;

  /* === 學習資料（LOD-0） === */
  rows: DailySummaryRow[];
  filteredRows: DailySummaryRow[];

  /* === UI 狀態 === */
  dateRange: {
    start: string;
    end: string;
  };

  /* === setters === */
  setUserSn: (sn: string | null) => void;
  setRole: (role: UserRole | null) => void;
  setUserInfo: (info: UserInfo | null) => void;
  setRows: React.Dispatch<React.SetStateAction<DailySummaryRow[]>>;
  setFilteredRows: React.Dispatch<
    React.SetStateAction<DailySummaryRow[]>
  >;
  setDateRange: React.Dispatch<
    React.SetStateAction<{ start: string; end: string }>
  >;

  /* === 登出 === */
  logout: () => void;
}

/* =====================
   Context
   ===================== */
const UserContext = createContext<UserContextValue | null>(null);

/* =====================
   Provider
   ===================== */
export function UserProvider({ children }: { children: ReactNode }) {
  const [userSn, setUserSn] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  /* === 攤平後欄位 === */
  const organizationId = userInfo?.organization_id ?? null;
  const gradeId = userInfo?.grade ?? null;
  const classId = userInfo?.class ?? null;

  /* === 學習資料 === */
  const [rows, setRows] = useState<DailySummaryRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<DailySummaryRow[]>([]);

  /* === UI 狀態 === */
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });

  /* =====================
     抓 daily_summary（保留）
     ===================== */
  useEffect(() => {
    if (!userSn) return;

    async function fetchDailySummary() {
      const { data, error } = await supabase
        .from("daily_summary")
        .select("*")
        .eq("user_sn", userSn)
        .order("activity_date", { ascending: true });

      if (error) {
        console.error("[UserContext] fetchDailySummary error:", error);
        setRows([]);
        setFilteredRows([]);
        return;
      }

      const result = data || [];
      setRows(result);
      setFilteredRows(result);

      if (result.length > 0) {
        setDateRange({
          start: result[0].activity_date,
          end: result[result.length - 1].activity_date,
        });
      }
    }

    fetchDailySummary();
  }, [userSn]);

  /* === 登出 === */
  const logout = () => {
    setUserSn(null);
    setRole(null);
    setUserInfo(null);
    setRows([]);
    setFilteredRows([]);
    setDateRange({ start: "", end: "" });
  };

  return (
    <UserContext.Provider
      value={{
        userSn,
        role,
        userInfo,

        organizationId,
        gradeId,
        classId,

        rows,
        filteredRows,
        dateRange,

        setUserSn,
        setRole,
        setUserInfo,
        setRows,
        setFilteredRows,
        setDateRange,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

/* =====================
   Hook
   ===================== */
export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUserContext must be used within UserProvider");
  }
  return ctx;
}
