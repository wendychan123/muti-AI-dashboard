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
export type UserRole = "student" | "teacher" | "policymaker";

export interface UserInfo {
  user_sn: string;
  user_id: string;
  OpenID_sub: string;
  role: UserRole;
  city: string;
  organization_id: number;
  grade?: number | null;
  class?: number | null;
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


  /* === UI 狀態 === */
  dateRange: {
    start: string;
    end: string;
  };

  /* === setters === */
  setUserSn: (sn: string | null) => void;
  setRole: (role: UserRole | null) => void;
  setUserInfo: (info: UserInfo | null) => void;
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


  /* === UI 狀態 === */
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });


  /* === 登出 === */
  const logout = () => {
    setUserSn(null);
    setRole(null);
    setUserInfo(null);
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
        dateRange,

        setUserSn,
        setRole,
        setUserInfo,
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
