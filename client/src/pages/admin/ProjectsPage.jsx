import { useState, useEffect } from "react";
import api from "../../api/axios";
import { getProjects } from "../../api/projects";
import {
  Building2, Pencil, Check, X, Search, Power, PowerOff, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function ManageProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newProject, setNewProject] = useState("");
  const [newProjectType, setNewProjectType] = useState("WEEKLY OFF");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  // FIX: Re-added state for editing the project type
  const [editType, setEditType] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setProjects([]);
    }
    setLoading(false);
  }

  const handleAddProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      await api.post("/projects", { name: newProject, type: newProjectType });
      setNewProject("");
      setNewProjectType("WEEKLY OFF");
      setIsAddModalOpen(false);
      loadProjects();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Failed to create project");
    }
    setLoading(false);
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/projects/${id}`, { name: editName, type: editType });
      setEditingId(null);
      loadProjects();
    } catch (err) {
      alert("Failed to update project");
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await api.put(`/projects/${id}`, { active: !currentStatus });
      loadProjects();
    } catch (error) {
      if (error.response?.status === 400) {
        alert(error.response.data.message);
      } else {
        alert("Failed to update status");
      }
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-6 min-h-0">
      
      <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-600" /> Project Sites
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your deployment locations and tracking types.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="bg-white rounded-xl border shadow-sm flex items-center w-full sm:w-[320px] shrink-0 h-11 px-3">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <Input
              type="text"
              placeholder="Search project sites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 shadow-none h-full w-full p-0 text-sm font-medium"
            />
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shrink-0 w-full sm:w-auto px-6"
          >
            <Building2 className="w-5 h-5 mr-2" /> Add Project
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[300px]">
        <div className="flex-1 overflow-auto w-full relative">
          <table className="w-full text-sm min-w-max text-left border-collapse">
            <TableHeader className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="font-bold text-slate-700 px-6 py-4">Project Site Name</TableHead>
                <TableHead className="font-bold text-slate-700">Type</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-bold text-slate-700 px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && projects.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500 font-medium">Loading projects...</TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500 font-medium">No projects found.</TableCell></TableRow>
              ) : (
                filteredProjects.map((p) => (
                  <TableRow
                    key={p._id}
                    className={`transition-colors group ${!p.active ? "bg-slate-100 opacity-60" : "hover:bg-slate-50/50"}`}
                  >
                    <TableCell className="px-6 py-4 w-[40%]">
                      {editingId === p._id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value.toUpperCase())}
                          className="h-9 font-bold bg-white uppercase"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold text-slate-900 text-base">{p.name}</span>
                      )}
                    </TableCell>
                    
                    <TableCell className="w-[30%]">
                      {editingId === p._id ? (
                        // FIX: Added the Type Edit Dropdown back in
                        <Select value={editType} onValueChange={setEditType}>
                          <SelectTrigger className="h-9 font-bold bg-white w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WEEKLY OFF" className="font-bold">Weekly Off System</SelectItem>
                            <SelectItem value="ALL DAY" className="font-bold text-indigo-700">All Day Duty</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        p.type === "ALL DAY" ? (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">All Day Duty</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-bold">Weekly Off System</Badge>
                        )
                      )}
                    </TableCell>
                    
                    <TableCell>
                      {p.active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none font-bold">Active</Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-none shadow-none font-bold">Inactive</Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {editingId === p._id ? (
                          // FIX: Moved Save/Cancel inside Actions for cleaner UI layout
                          <>
                            <Button size="sm" onClick={() => saveEdit(p._id)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"><Check className="w-4 h-4 mr-1.5" /> Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-8 font-bold"><X className="w-4 h-4 mr-1.5" /> Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => { setEditingId(p._id); setEditName(p.name); setEditType(p.type || "WEEKLY OFF"); }} className="h-8 bg-white text-slate-700 hover:bg-slate-100 font-bold">
                              <Pencil className="w-4 h-4 mr-1.5" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => toggleStatus(p._id, p.active)} className={`h-8 font-bold ${p.active ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"}`}>
                              {p.active ? <PowerOff className="w-4 h-4 mr-1.5" /> : <Power className="w-4 h-4 mr-1.5" />}
                              {p.active ? "Deactivate" : "Activate"}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={(open) => { if (!open) setIsAddModalOpen(false); setErrorMessage(""); }}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">Add New Project Site</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">Create a new tracking location for your personnel.</DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm font-semibold border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {errorMessage}
            </div>
          )}

          <form onSubmit={handleAddProject} className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase">Project Name</Label>
              <Input required value={newProject} onChange={(e) => setNewProject(e.target.value.toUpperCase())} placeholder="e.g. CITY MALL" className="h-11 font-bold text-base uppercase" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase">Tracking Type</Label>
              <Select value={newProjectType} onValueChange={setNewProjectType}>
                <SelectTrigger className="h-11 bg-white font-bold text-left"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" className="w-auto min-w-max">
                  <SelectItem value="WEEKLY OFF" className="font-medium py-2 pr-4">Weekly Off (1 off per 6 working days)</SelectItem>
                  <SelectItem value="ALL DAY" className="font-medium py-2 pr-4">All Day (Strict 1-to-1 mapping)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t flex justify-end gap-3 mt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="h-11 px-5 font-bold">Cancel</Button>
              <Button type="submit" disabled={loading || !newProject.trim()} className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{loading ? "Adding..." : "Add Project"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}