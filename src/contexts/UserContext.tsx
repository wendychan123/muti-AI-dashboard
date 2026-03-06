import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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
  
  /* === 關鍵：載入狀態 === */
  isLoading: boolean; 

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

const UserContext = createContext<UserContextValue | null>(null);

/* =====================
   Provider
   ===================== */
export function UserProvider({ children }: { children: ReactNode }) {
  
  const [userSn, setUserSn] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  
  // 直接在初始值階段讀取，這樣 isLoading 在第一時間就能拿到資料
  const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
    const saved = localStorage.getItem("app_user_info");
    return saved ? JSON.parse(saved) : null;
  });

  const [isLoading, setIsLoading] = useState(false); // 因為上面直接讀了，這裡可以預設為 false

  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });

  /* === 2. 初始化：從 localStorage 恢復數據 === */
  useEffect(() => {
    const saved = localStorage.getItem("app_user_info");
    if (saved) {
      try {
        const parsed: UserInfo = JSON.parse(saved);
        setUserInfo(parsed);
        setUserSn(parsed.user_sn);
        setRole(parsed.role);
      } catch (err) {
        console.error("解析 LocalStorage 失敗", err);
        localStorage.removeItem("app_user_info");
      }
    }
    // 恢復完成後，關閉載入狀態
    setIsLoading(false);
  }, []);

  /* === 3. 自動同步：當 userInfo 變更時，更新 localStorage 與衍生欄位 === */
  useEffect(() => {
    if (userInfo) {
      localStorage.setItem("app_user_info", JSON.stringify(userInfo));
      setUserSn(userInfo.user_sn);
      setRole(userInfo.role);
    } else {
      // 如果 userInfo 為 null，通常是登出或初始狀態
      localStorage.removeItem("app_user_info");
      setUserSn(null);
      setRole(null);
    }
  }, [userInfo]);

  /* === 衍生欄位 (Derived State) === */
  const organizationId = userInfo?.organization_id ?? null;
  const gradeId = userInfo?.grade ?? null;
  const classId = userInfo?.class ?? null;

  /* === 登出 === */
  const logout = () => {
    setUserInfo(null);
    setDateRange({ start: "", end: "" });
  };

  return (
    <UserContext.Provider
      value={{
        userSn,
        role,
        userInfo,
        isLoading, // 務必回傳此狀態

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

export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUserContext must be used within UserProvider");
  }
  return ctx;
}