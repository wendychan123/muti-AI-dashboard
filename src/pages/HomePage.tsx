import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, BookOpen, Maximize, Minimize } from "lucide-react";
import { useState } from "react";
import educationBg from "@/assets/education-bg.jpg";
import PolicyIP from "@/assets/policyIP.jpg";
import TeacherIP from "@/assets/teacherIP.jpg";
import StudentIP from "@/assets/studentIP.jpg";

const HomePage = () => {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const roles = [
  {
    id: "policymaker",
    title: "管理者",
    description: "總覽校務數據\n輔助教學策略與資源配置",
    icon: (
      <div 
        style={{ backgroundImage: `url(${PolicyIP})` }}
        className="w-25 h-25 md:w-40 md:h-40 bg-contain bg-center bg-no-repeat transition-transform group-hover:scale-110"
        role="img"
        aria-label="管理者"
      />
    ),
    color: "bg-gradient-to-br from-teal-500 to-teal-700",
    path: "/policymaker/practice",
    requiresLogin: false,
  },
  {
    id: "teacher",
    title: "教師",
    description: "作答練習狀況\n掌握校內學習成效與進度",
    icon: (
      <div 
        style={{ backgroundImage: `url(${TeacherIP})` }}
        className="w-25 h-25 md:w-40 md:h-40 bg-contain bg-center bg-no-repeat transition-transform group-hover:scale-110"
        role="img"
        aria-label="教師"
      />
    ),
    color: "bg-gradient-to-br from-indigo-500 to-indigo-700",
    path: "/teacher/login",
    requiresLogin: true
    // isComingSoon: true,
  },
  {
    id: "student",
    title: "學生",
    description: "個人練習表現\n獲取個人學習診斷與建議",
    icon: (
      <div 
        style={{ backgroundImage: `url(${StudentIP})` }}
        className="w-25 h-25 md:w-40 md:h-40 bg-contain bg-center bg-no-repeat transition-transform group-hover:scale-110"
        role="img"
        aria-label="學生"
      />
    ),
    color: "bg-gradient-to-br from-blue-400 to-sky-600",
    path: "/student/login",
    requiresLogin: true,
  },
];


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("無法進入全螢幕:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  

const handleRoleClick = (role) => {
  // 核心邏輯：判斷是否為開發中
  if (role.isComingSoon) {
    alert("此頁面尚未開發完成！");
    return; // 攔截，不執行後續導航
  }

  // 原本的跳轉邏輯
  navigate(role.path);
};

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${educationBg})` }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-sm"></div>

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 shadow-sm px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-700">多層級教育智慧儀表板</h1>
              </div>

              {/* Header Buttons */}
              <div className="flex items-center space-x-3 sm:space-x-4 self-end sm:self-auto">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-gray-100 transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>

                <button className="p-2 sm:p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-gray-100 transition-colors">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-8 py-16 ">
          <div className="max-w-5xl mx-auto">
            <div className="mb-10 sm:mb-12 text-center sm:text-left">
              {/* <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">
                多層級身份
              </h2>
              <div className="w-20 sm:w-24 h-1 bg-primary mx-auto sm:mx-0"></div> */}
            </div>

            {/* Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-12">
              {roles.map((role) => (
                <Card
                    key={role.id}
                    onClick={() => handleRoleClick(role)}
                    className="group cursor-pointer hover:shadow-xl active:scale-[0.98] transition-all duration-400 hover:-translate-y-1 sm:hover:-translate-y-2 overflow-hidden bg-white/90 backdrop-blur-sm rounded-2xl border-none"
                  >
                    {/* 上端改為白色背景 */}
                    <div className="bg-white p-5 sm:p-6 text-center relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="mb-3 sm:mb-2 flex justify-center ">
                          {role.icon}
                        </div>
                        {/* 標題改為深色文字，以配合白色背景 */}
                        <h3 className="relative top-1 text-xl sm:text-2xl font-bold text-slate-800 mb-1 sm:mb-0">
                          {role.title}
                        </h3>
                      </div>
                      
                      {/* 裝飾圓圈改為淺灰色/淡色系
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-full -z-0"></div>
                      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 w-6 h-6 sm:w-8 sm:h-8 bg-slate-50 rounded-full -z-0"></div>  */}
                    </div>

                    {/* 下方 CardContent 帶入角色顏色 */}
                    <CardContent className={`p-5 sm:p-5 ${role.color} transition-colors duration-300`}>
                      <div className="flex items-center justify-between">
                        {/* 描述文字改為白色，以在深色背景上清楚顯示 */}
                        <p className="text-white/90 whitespace-pre-line text-sm sm:text-base leading-relaxed text-left font-medium">
                          {role.description}
                        </p>
                        <div className="ml-3 sm:ml-4 text-white group-hover:translate-x-1 transition-transform">
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;
