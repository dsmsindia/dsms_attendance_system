import { useState, useEffect } from "react";
import { getGuards } from "../../api/guards";
import { getProjects } from "../../api/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Shield, UserCheck, Briefcase } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalGuards: 0,
    relievers: 0,
    assigned: 0,
    byDepartment: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [guardsData, projectsData] = await Promise.all([
          getGuards(),
          getProjects(),
        ]);

        const activeProjects = (projectsData || []).filter(
          (p) => p.active !== false,
        );
        const activeGuards = (guardsData || []).filter(
          (g) => g.active !== false,
        );

        const relievers = activeGuards.filter((g) => g.isReliever).length;
        const assigned = activeGuards.length - relievers;

        const byDepartment = activeGuards.reduce((acc, g) => {
          const dept = g.department || "Unspecified";
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        }, {});

        setStats({
          totalProjects: activeProjects.length,
          totalGuards: activeGuards.length,
          relievers,
          assigned,
          byDepartment,
        });
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-6 min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of active guards and project site metrics.
        </p>
      </div>

      <div className="flex-1 overflow-auto w-full">
        <div className="space-y-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-5">
                <div className="bg-emerald-100 p-4 rounded-xl">
                  <Building2 className="h-8 w-8 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    Active Projects
                  </p>
                  <h3 className="text-4xl font-extrabold text-slate-900">
                    {stats.totalProjects}
                  </h3>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-5">
                <div className="bg-indigo-100 p-4 rounded-xl">
                  <Users className="h-8 w-8 text-indigo-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    Total Active Guards
                  </p>
                  <h3 className="text-4xl font-extrabold text-slate-900">
                    {stats.totalGuards}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border shadow-sm bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-600" />
                  Guard Category Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-700">
                      Assigned to Projects
                    </span>
                    <span className="text-lg font-bold text-indigo-700">
                      {stats.assigned}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-700">
                      Reliever Guards
                    </span>
                    <span className="text-lg font-bold text-purple-700">
                      {stats.relievers}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-white">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                  Department Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {Object.keys(stats.byDepartment).length === 0 ? (
                  <p className="text-slate-500 text-center py-4">
                    No active guards found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.byDepartment)
                      .sort((a, b) => b[1] - a[1]) 
                      .map(([dept, count]) => (
                        <div
                          key={dept}
                          className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-slate-700">
                              {dept}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-emerald-700">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}