// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";

import HomePage from "./pages/HomePage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

/* ===== Student ===== */
import StudentLayout from "./pages/Student/StudentLayout";
import StudentThemeA from "./pages/Student/StudentOverview"; 
import StudentPrac from "./pages/Student/StudentPrac"; 
import StudentExam from "./pages/Student/StudentExam";
import StudentMath from "./pages/Student/StudentMath";
import PracDaily from "./pages/Student/PracDaily";



/* ===== Teacher ===== */
import TeacherLayout from "./pages/Teacher/TeacherLayout";
import TeacherThemeA from "./pages/Teacher/TeacherThemeA";
import TeacherThemeB from "./pages/Teacher/TeacherThemeB";
import TeacherThemeC from "./pages/Teacher/TeacherThemeC";


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

              {/* ===== 首頁 ===== */}
              <Route path="/" element={<Login />} />

              {/* ===== Login ===== */}
              

              {/* ===== Student 區 ===== */}
              <Route path="/student" element={<StudentLayout />}>
                <Route index element={<Navigate to="practice" replace />} />

                {/* ===== Practice（dp001_prac） ===== */}
                <Route path="practice">

                  {/* LOD1：練習總覽 */}
                  <Route index element={<StudentPrac />} />

                  {/* LOD2：單日練習 */}
                  <Route path="daily/:date" element={<PracDaily />} />

                </Route>

                {/* 其他模組分析 */}
                <Route path="math" element={<StudentMath />} />
                <Route path="exam" element={<StudentExam />} />


              </Route>

              {/* ===== Teacher 區 ===== */}
              <Route path="/teacher" element={<TeacherLayout />}>
                <Route index element={<Navigate to="theme-a" replace />} />
                <Route path="theme-a" element={<TeacherThemeA />} />
                <Route path="theme-b" element={<TeacherThemeB />} />
                <Route path="theme-c" element={<TeacherThemeC />} />
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
