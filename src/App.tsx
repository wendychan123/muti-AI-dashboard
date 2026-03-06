// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";

import HomePage from "./pages/HomePage";
import StudentLogin from "./pages/StudentLogin";
import TeacherLogin from "./pages/TeacherLogin";
import NotFound from "./pages/NotFound";

/* ===== Student ===== */
import StudentLayout from "./pages/Student/StudentLayout";
import StudentPrac from "./pages/Student/StudentPrac";

/* ===== Teacher ===== */
import TeacherLayout from "./pages/Teacher/TeacherLayout";
import TeacherPrac from "./pages/Teacher/TeacherPrac";

/* ===== PolicyMaker ===== */
import PolicyLayout from "./pages/Policy/PolicyLayout";
import PolicyPrac from "./pages/Policy/PolicyPrac";

const queryClient = new QueryClient();


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter>
            <Routes>
              {/* ===== 公共入口 ===== */}
              <Route path="/" element={<HomePage />} />
              
              {/* ===== 登入路由優化 ===== */}
              {/* 解決你截圖中出現 /login 導致 404 的問題 */}
              <Route path="/login" element={<Navigate to="/student/login" replace />} />
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/teacher/login" element={<TeacherLogin />} />

              {/* ============================= */}
              {/* ===== Student 區（需登入） ===== */}
              {/* ============================= */}
              <Route path="/student" element={<StudentLayout />}>
                {/* 使用 relative path 導向子路由 */}
                <Route index element={<Navigate to="practice" replace />} />
                <Route path="practice" element={<StudentPrac />} />
              </Route>

              {/* ============================= */}
              {/* ===== Teacher 區（需登入） ===== */}
              {/* ============================= */}
              <Route path="/teacher" element={<TeacherLayout />}>
                <Route index element={<Navigate to="practice" replace />} />
                <Route path="practice" element={<TeacherPrac />} />
              </Route>

              {/* ============================= */}
              {/* ===== PolicyMaker 區 ===== */}
              {/* ============================= */}
              <Route path="/policymaker" element={<PolicyLayout />}>
                <Route index element={<Navigate to="practice" replace />} />
                <Route path="practice" element={<PolicyPrac />} />
              </Route>

              {/* ===== 404 捕獲 ===== */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>

        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
