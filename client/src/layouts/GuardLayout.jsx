import { useState } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CalendarCheck, ClipboardList, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "../components/Footer"; // NEW: Import the Footer

// Removed Dashboard from the navigation
const navItems = [
  {
    to: "/guard/mark-attendance",
    icon: CalendarCheck,
    label: "Mark Attendance",
  },
  { to: "/guard/my-record", icon: ClipboardList, label: "My Record" },
];

export default function GuardLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // If a guard lands on the base /guard or old dashboard url, force them to mark-attendance
  if (
    location.pathname === "/guard" ||
    location.pathname === "/guard/dashboard"
  ) {
    return <Navigate to="/guard/mark-attendance" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeSidebar = () => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  // Fetch guard's display name
  const displayName = user?.name || user?.username || "Guard";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 text-slate-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          {/* FIXED: Added min-w-0 and flex-1 so the flex box allows internal truncation */}
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <div className="bg-emerald-600 rounded-md w-8 h-8 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xl leading-none">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Show Guard Name Here */}
            <span
              className="text-slate-900 text-lg font-bold tracking-tight truncate block"
              title={displayName}
            >
              {displayName}
            </span>
          </div>

          <button
            onClick={closeSidebar}
            className="lg:hidden text-slate-500 hover:text-slate-900 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 scrollbar-hide">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          {/* FIXED: Added min-w-0 to the wrapper */}
          <div className="mb-4 px-2 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Logged in as
            </p>
            {/* Show Guard Name at the bottom as well */}
            <p
              className="text-sm font-bold text-slate-900 truncate block"
              title={displayName}
            >
              {displayName}
            </p>
          </div>

          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 h-10 px-3"
          >
            <LogOut className="w-5 h-5 mr-3" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 h-16 bg-white border-b shadow-sm shrink-0">
          {/* FIXED: Added min-w-0 and flex-1 to the mobile header */}
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-4">
            <div className="bg-emerald-600 rounded-md w-7 h-7 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg leading-none">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span
              className="text-slate-900 text-lg font-bold tracking-tight truncate block max-w-[150px] sm:max-w-full"
              title={displayName}
            >
              {displayName}
            </span>
          </div>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -mr-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50">
          <Outlet />
        </div>
        <Footer />{" "}
        {/* FIXED: Added Footer at the bottom of the scrolling area */}
      </main>
    </div>
  );
}
