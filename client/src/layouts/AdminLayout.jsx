import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer"; 
import {
  LayoutDashboard, Users, Building2, FileText, CalendarDays, LogOut, Menu, X, FileSpreadsheet, Calculator, FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/guards", icon: Users, label: "Guards" },
  { to: "/admin/projects", icon: Building2, label: "Projects" },
  { to: "/admin/report", icon: FileText, label: "Attendance Report" },
  { to: "/admin/edit-attendance", icon: CalendarDays, label: "Edit Attendance" },
  { to: "/admin/salary-sheet", icon: FileSpreadsheet, label: "Salary Sheet" },
  { to: "/admin/quotation-generator", icon: Calculator, label: "Quotation Generator" },
  { to: "/admin/final-agreement", icon: FileCheck, label: "Final Agreement Generator" },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const applyScale = () => {
      if (window.innerWidth >= 1024) {
        document.documentElement.style.fontSize = "12.8px"; 
      } else {
        document.documentElement.style.fontSize = "16px"; 
      }
    };
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => {
      window.removeEventListener("resize", applyScale);
      document.documentElement.style.fontSize = "16px";
    };
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };
  const closeSidebar = () => { if (window.innerWidth < 1024) setIsSidebarOpen(false); };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      {/* FIX: Bumped overlay to z-[100] to cover frozen table elements */}
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-[100] lg:hidden transition-opacity" onClick={closeSidebar} />}

      {/* FIX: Bumped sidebar to z-[110] so it sits permanently on top of everything */}
      <aside className={`fixed inset-y-0 left-0 z-[110] w-64 bg-white border-r border-slate-200 text-slate-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 rounded-md w-8 h-8 flex items-center justify-center"><span className="text-white font-bold text-xl leading-none">D</span></div>
            <span className="text-slate-900 text-xl font-bold tracking-tight">DSMS Admin</span>
          </div>
          <button onClick={closeSidebar} className="lg:hidden text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 scrollbar-hide">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={closeSidebar} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <item.icon className="w-5 h-5 shrink-0" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="mb-4 px-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Logged in as</p>
            <p className="text-sm font-bold text-slate-900 truncate uppercase">{user?.name || user?.username || "ADMIN"}</p>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 h-10 px-3"><LogOut className="w-5 h-5 mr-3" /> Logout</Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* FIX: Header bumped to z-[90] to sit above standard content but below mobile menu */}
        <header className="lg:hidden flex items-center justify-between px-4 h-16 bg-white border-b shadow-sm shrink-0 z-[90]">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 rounded-md w-7 h-7 flex items-center justify-center"><span className="text-white font-bold text-lg leading-none">D</span></div>
            <span className="text-slate-900 text-lg font-bold tracking-tight">DSMS Admin</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"><Menu className="w-6 h-6" /></button>
        </header>

        <div className="flex-1 overflow-hidden bg-slate-50/50 p-4 sm:p-6 lg:p-8 flex flex-col w-full max-w-full">
          <Outlet />
        </div>
        
        <Footer />
      </main>
    </div>
  );
}