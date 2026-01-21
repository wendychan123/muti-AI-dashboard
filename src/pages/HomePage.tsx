import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, BookOpen, Maximize, Minimize } from "lucide-react";
import { useState } from "react";
import educationBg from "@/assets/education-bg.jpg";

const HomePage = () => {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const roles = [
    {
      id: "manager",
      title: "管理者",
      description: "總覽校務數據\n輔助決策與資源分配",
      icon: <Users className="w-10 h-10 md:w-12 md:h-12 text-white" />,
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
      onClick: () => alert("管理者功能開發中"),
    },
    {
      id: "teacher",
      title: "教師",
      description: "平台學習狀況\n提供教學調整建議",
      icon: <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-white" />,
      color: "bg-gradient-to-br from-teal-500 to-teal-600",
      onClick: () => navigate("/login"),
    },
    {
      id: "student",
      title: "學生",
      description: "個人學習進度\n獲取個人化建議",
      icon: <GraduationCap className="w-10 h-10 md:w-12 md:h-12 text-white" />,
      color: "bg-gradient-to-br from-cyan-500 to-cyan-600",
      onClick: () => navigate("/login"),
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

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${educationBg})` }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-sm"></div>

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-sm">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-sm"></div>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  多層級教育智慧儀表板
                </h1>
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
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 md:py-24">
          <div className="max-w-5xl mx-auto">
            <div className="mb-10 sm:mb-12 text-center sm:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">
                多層級身份
              </h2>
              <div className="w-20 sm:w-24 h-1 bg-primary mx-auto sm:mx-0"></div>
            </div>

            {/* Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-12">
              {roles.map((role) => (
                <Card
                  key={role.id}
                  onClick={role.onClick}
                  className="group cursor-pointer hover:shadow-xl active:scale-[0.98] transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 overflow-hidden bg-white/95 backdrop-blur-sm rounded-2xl"
                >
                  <div
                    className={`${role.color} p-6 sm:p-8 text-center relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="relative z-10">
                      <div className="mb-3 sm:mb-4 flex justify-center">
                        {role.icon}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                        {role.title}
                      </h3>
                    </div>
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full"></div>
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 w-6 h-6 sm:w-8 sm:h-8 bg-white/10 rounded-full"></div>
                  </div>

                  <CardContent className="p-5 sm:p-6 bg-white/95">
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground whitespace-pre-line text-sm sm:text-base leading-relaxed text-left">
                        {role.description}
                      </p>
                      <div className="ml-3 sm:ml-4 text-muted-foreground group-hover:text-primary transition-colors">
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
