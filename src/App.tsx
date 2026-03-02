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
              
              {/* ===== 登入路由拆分 ===== */}
              {/* 原本的 /login 可以保留作為預設（導向學生）或直接移除 */}
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/teacher/login" element={<TeacherLogin />} />

              {/* ============================= */}
              {/* ===== Student 區（需登入） ===== */}
              {/* ============================= */}
              <Route path="/student" element={<StudentLayout />}>
                <Route index element={<Navigate to="practice" replace />} />
                <Route path="practice" element={<StudentPrac />} />
                {/* 如果在 StudentLayout 內沒登入，應導向 /student/login */}
              </Route>

              {/* ============================= */}
              {/* ===== Teacher 區（需登入） ===== */}
              {/* ============================= */}
              <Route path="/teacher" element={<TeacherLayout />}>
                <Route index element={<Navigate to="practice" replace />} />
                <Route path="practice" element={<TeacherPrac />} />
                {/* 如果在 TeacherLayout 內沒登入，應導向 /teacher/login */}
              </Route>

              {/* ============================= */}
              {/* ===== PolicyMaker 區（不變） ===== */}
              {/* ============================= */}
              <Route path="/policymaker" element={<PolicyLayout />}>
                <Route index element={<Navigate to="practice" replace />} />
                <Route path="practice" element={<PolicyPrac />} />
              </Route>

              {/* ===== 404 ===== */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>

        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
