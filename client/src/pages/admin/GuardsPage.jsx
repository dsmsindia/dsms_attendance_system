import { useState, useEffect } from "react";
import api from "../../api/axios";
import { getProjects } from "../../api/projects";
import { getGuards } from "../../api/guards";
import EditGuardModal from "../../components/EditGuardModal";
import {
  UserPlus,
  Search,
  Shield,
  Pencil,
  Power,
  PowerOff,
  Building2,
  Eye,
  CreditCard,
  Hash,
  Building,
  Users,
  AlertTriangle,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const DEPARTMENTS = [
  "SECURITY GUARD",
  "HEAD GUARD",
  "SUPERVISOR",
  "NANNY",
  "GUNMAN",
  "BOUNCER",
  "LADY GUARD",
  "CARE TAKER",
  "HOUSEKEEPING",
  "OFFICE",
];
export const INDIAN_BANKS = [
  "Airtel Payments Bank",
  "Au Small Finance Bank",
  "Axis Bank",
  "Balageria Central Co-operative Bank",
  "Bandhan Bank",
  "Bank of Baroda (BOB)",
  "Bank of India (BOI)",
  "Bank of Maharashtra",
  "Barclays",
  "Baroda UP Bank",
  "CSB Bank",
  "Canara Bank",
  "Capital Small Finance Bank",
  "Central Bank of India",
  "Citibank",
  "City Union Bank",
  "Contai Co-operative Bank",
  "Cosmos Co-operative Bank",
  "DBS Bank",
  "Deutsche Bank",
  "Dhanlaxmi Bank",
  "ESAF Small Finance Bank",
  "Equitas Small Finance Bank",
  "Federal Bank",
  "Fincare Small Finance Bank",
  "Fino Payments Bank",
  "HDFC Bank",
  "HSBC",
  "ICICI Bank",
  "IDFC FIRST Bank",
  "India Post Payments Bank",
  "Indian Bank",
  "Indian Overseas Bank",
  "IndusInd Bank",
  "Jammu & Kashmir Bank",
  "Jana Small Finance Bank",
  "Jio Payments Bank",
  "Karnataka Bank",
  "Karur Vysya Bank",
  "Kerala Gramin Bank",
  "Kotak Mahindra Bank",
  "NSDL Payments Bank",
  "Nainital Bank",
  "Paytm Payments Bank",
  "Prathama UP Gramin Bank",
  "Punjab & Sind Bank",
  "Punjab National Bank (PNB)",
  "RBL Bank",
  "Saraswat Co-operative Bank",
  "Shamrao Vithal Co-operative Bank",
  "Shivalik Small Finance Bank",
  "Slice Small Finance Bank",
  "South Indian Bank",
  "Standard Chartered Bank",
  "State Bank of India (SBI)",
  "Suryoday Small Finance Bank",
  "Tamilnad Mercantile Bank",
  "The West Bengal State Co-operative Bank",
  "UCO Bank",
  "Ujjivan Small Finance Bank",
  "Union Bank of India",
  "Utkarsh Small Finance Bank",
  "Yes Bank",
];

export default function GuardsPage() {
  const [guards, setGuards] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("all");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState(null);
  const [viewingGuard, setViewingGuard] = useState(null);

  const [name, setName] = useState("");
  const [fathersName, setFathersName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [department, setDepartment] = useState("SECURITY GUARD");
  const [projectId, setProjectId] = useState("");
  const [isReliever, setIsReliever] = useState(false);
  const [salary, setSalary] = useState("");
  const [pfNumber, setPfNumber] = useState("");
  const [esicNumber, setEsicNumber] = useState("");

  const [adhar, setAdhar] = useState("");
  const [pan, setPan] = useState("");
  const [doj, setDoj] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [gData, pData] = await Promise.all([getGuards(), getProjects()]);
      setGuards(Array.isArray(gData) ? gData : []);
      setProjects(Array.isArray(pData) ? pData : []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }

  const handleAddGuard = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      await api.post("/guards", {
        name,
        fathersName,
        address,
        contact,
        department,
        projectId: isReliever ? null : projectId,
        isReliever,
        salary,
        pfNumber,
        esicNumber,
        adhar,
        pan,
        doj,
        bloodGroup,
        bankName,
        accountNumber,
        ifscCode,
        branchName,
      });
      setIsAddModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          "Failed to add guard due to a server error.",
      );
    }
    setLoading(false);
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      if (currentStatus) await api.patch(`/guards/${id}/deactivate`);
      else await api.patch(`/guards/${id}/reactivate`);
      loadData();
    } catch (error) {
      alert("Failed to update status");
    }
  };

  const resetForm = () => {
    setName("");
    setFathersName("");
    setAddress("");
    setContact("");
    setDepartment("SECURITY GUARD");
    setProjectId("");
    setIsReliever(false);
    setSalary("");
    setPfNumber("");
    setEsicNumber("");
    setAdhar("");
    setPan("");
    setDoj("");
    setBloodGroup("");
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
    setBranchName("");
    setFormError("");
  };

  const filteredGuards = guards.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.contact.includes(searchQuery) ||
      (g.employeeCode &&
        g.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesProject = true;
    if (filterProjectId !== "all") {
      if (filterProjectId === "relievers") matchesProject = g.isReliever;
      else if (filterProjectId === "office")
        matchesProject = g.department === "OFFICE";
      else
        matchesProject = !g.isReliever && g.projectId?._id === filterProjectId;
    }
    return matchesSearch && matchesProject;
  });

  const showAdvancedFields = !isReliever && projectId !== "";

  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-6 min-h-0">
      <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" /> Guard Roster
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage personnel, assignments, and records.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="bg-white rounded-xl border shadow-sm flex items-center w-full sm:w-[320px] shrink-0 h-11 px-3">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <Input
              type="text"
              placeholder="Search guards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 shadow-none h-full w-full p-0 text-sm font-medium"
            />
          </div>

          <div className="bg-white rounded-xl border shadow-sm flex items-center w-full sm:w-[280px] shrink-0 h-11 px-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="border-0 focus:ring-0 shadow-none h-full bg-transparent w-full text-sm font-bold text-slate-700 px-1">
                <SelectValue>
                  {filterProjectId === "all"
                    ? "ALL PERSONNEL"
                    : filterProjectId === "relievers"
                      ? "RELIEVER POOL"
                      : filterProjectId === "office"
                        ? "OFFICE PERSONNEL"
                        : projects.find(
                            (p) => String(p._id) === String(filterProjectId),
                          )?.name || "Project"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold text-xs">
                  ALL PERSONNEL
                </SelectItem>
                <SelectItem
                  value="relievers"
                  className="font-bold text-amber-700 text-xs"
                >
                  RELIEVER POOL
                </SelectItem>
                <SelectItem
                  value="office"
                  className="font-bold text-blue-700 text-xs"
                >
                  OFFICE PERSONNEL
                </SelectItem>
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t mt-1">
                  Active Projects
                </div>
                {projects
                  .filter((p) => p.active)
                  .map((p) => (
                    <SelectItem
                      key={p._id}
                      value={p._id}
                      className="font-medium text-xs truncate max-w-[200px]"
                    >
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shrink-0 w-full sm:w-auto px-6"
          >
            <UserPlus className="w-5 h-5 mr-2" /> Add Guard
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[300px]">
        <div className="flex-1 overflow-auto w-full relative">
          <table className="w-full text-sm min-w-max text-left border-collapse">
            <TableHeader className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="font-bold text-slate-700 px-6 py-4">
                  Employee
                </TableHead>
                <TableHead className="font-bold text-slate-700">
                  Project / Role
                </TableHead>
                <TableHead className="font-bold text-slate-700">
                  Credentials
                </TableHead>
                <TableHead className="font-bold text-slate-700">
                  Status
                </TableHead>
                <TableHead className="text-right font-bold text-slate-700 px-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && guards.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-slate-500 font-medium"
                  >
                    Loading roster...
                  </TableCell>
                </TableRow>
              ) : filteredGuards.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-slate-500 font-medium"
                  >
                    No personnel found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGuards.map((g) => (
                  <TableRow
                    key={g._id}
                    className={`transition-colors group ${!g.active ? "bg-slate-100 opacity-60" : "hover:bg-slate-50/50"}`}
                  >
                    <TableCell className="px-6 py-4 max-w-[180px] sm:max-w-[250px]">
                      <div className="flex flex-col min-w-0">
                        <span
                          className="font-bold text-slate-900 text-base truncate block"
                          title={g.name}
                        >
                          {g.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 truncate block">
                          {g.department}
                        </span>
                        {g.employeeCode && (
                          <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md mt-1 w-max border border-indigo-100 truncate block max-w-full">
                            {g.employeeCode}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px] sm:max-w-[250px]">
                      <div className="flex flex-col min-w-0">
                        {g.isReliever ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 font-bold w-max"
                          >
                            <Users className="w-3 h-3 mr-1.5 shrink-0" />{" "}
                            Reliever Pool
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span
                              className={`font-semibold truncate block ${!g.projectId?.active ? "text-red-500" : "text-slate-700"}`}
                              title={g.projectId?.name || "Unassigned"}
                            >
                              {g.projectId?.name || "Unassigned"}{" "}
                              {g.department === "OFFICE" && "(Office)"}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-medium text-slate-600 truncate block">
                          <span className="text-slate-400">PH:</span>{" "}
                          {g.contact}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {g.active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-none shadow-none font-bold">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-none shadow-none font-bold">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingGuard(g)}
                          className="h-8 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-bold"
                        >
                          <Eye className="w-4 h-4 mr-1.5 shrink-0" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingGuard(g)}
                          className="h-8 bg-white text-slate-700 hover:bg-slate-100 font-bold"
                        >
                          <Pencil className="w-4 h-4 mr-1.5 shrink-0" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatus(g._id, g.active)}
                          className={`h-8 font-bold ${g.active ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"}`}
                        >
                          {g.active ? (
                            <PowerOff className="w-4 h-4 mr-1.5 shrink-0" />
                          ) : (
                            <Power className="w-4 h-4 mr-1.5 shrink-0" />
                          )}
                          {g.active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </div>

      <Dialog
        open={!!viewingGuard}
        onOpenChange={(open) => !open && setViewingGuard(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-white p-0 overflow-hidden rounded-xl">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2
                className="text-2xl font-black truncate block"
                title={viewingGuard?.name}
              >
                {viewingGuard?.name}
              </h2>
              <p className="text-slate-400 font-medium truncate block">
                {viewingGuard?.department}
              </p>
              {viewingGuard?.employeeCode && (
                <Badge className="mt-2 bg-indigo-500 hover:bg-indigo-600 truncate max-w-full block">
                  {viewingGuard.employeeCode}
                </Badge>
              )}
            </div>
            <div className="shrink-0">
              {viewingGuard?.active ? (
                <Badge className="bg-emerald-500">Active</Badge>
              ) : (
                <Badge className="bg-red-500">Inactive</Badge>
              )}
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 border-b pb-2 mb-3">
                  <UserPlus className="w-4 h-4" /> Personal Info
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-slate-500 font-medium">Contact</div>
                  <div className="font-bold text-slate-900">
                    {viewingGuard?.contact}
                  </div>
                  <div className="text-slate-500 font-medium">
                    Father's Name
                  </div>
                  <div className="font-bold text-slate-900">
                    {viewingGuard?.fathersName || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">DOJ</div>
                  <div className="font-bold text-slate-900">
                    {viewingGuard?.doj || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">Blood Grp</div>
                  <div className="font-bold text-rose-600">
                    {viewingGuard?.bloodGroup || "-"}
                  </div>
                  <div className="text-slate-500 font-medium col-span-2 border-t pt-2 mt-1">
                    Address
                  </div>
                  <div className="font-bold text-slate-900 col-span-2">
                    {viewingGuard?.address || "-"}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 border-b pb-2 mb-3">
                  <Hash className="w-4 h-4" /> Identification
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-slate-500 font-medium">Aadhar</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.adhar || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">PAN</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.pan || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">UAN / PF</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.pfNumber || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">ESIC</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.esicNumber || "-"}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 border-b pb-2 mb-3">
                  <Building2 className="w-4 h-4" /> Assignment
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-slate-500 font-medium">Role Type</div>
                  <div className="font-bold text-slate-900">
                    {viewingGuard?.isReliever ? "Reliever" : "Permanent"}
                  </div>
                  <div className="text-slate-500 font-medium">Project</div>
                  <div className="font-bold text-indigo-700">
                    {viewingGuard?.isReliever
                      ? "N/A"
                      : viewingGuard?.projectId?.name || "Unassigned"}
                  </div>
                  <div className="text-slate-500 font-medium">App Username</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.username}
                  </div>
                </div>

                {/* Restored Project Transfer History */}
                {viewingGuard?.projectHistory &&
                  viewingGuard.projectHistory.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <h4 className="text-[10px] font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5 mb-2">
                        <History className="w-3 h-3" /> Project Transfer History
                      </h4>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {viewingGuard.projectHistory.map((h, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center bg-slate-50 p-2 rounded-md border border-slate-100 text-xs"
                          >
                            <span className="font-bold text-slate-700 truncate mr-2">
                              {h.projectId
                                ? h.projectId.name
                                : "Reliever / Unassigned"}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200">
                              {h.startDate} → {h.endDate || "Present"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 border-b pb-2 mb-3">
                  <CreditCard className="w-4 h-4" /> Bank & Salary
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-slate-500 font-medium">Min Wages</div>
                  <div className="font-bold text-emerald-600">
                    ₹ {viewingGuard?.salary || "0"}
                  </div>
                  <div className="text-slate-500 font-medium">Bank</div>
                  <div className="font-bold text-slate-900">
                    {viewingGuard?.bankName || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">A/C No.</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.accountNumber || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">IFSC</div>
                  <div className="font-bold font-mono text-slate-900">
                    {viewingGuard?.ifscCode || "-"}
                  </div>
                  <div className="text-slate-500 font-medium">Branch</div>
                  <div className="font-bold text-slate-900">
                    {viewingGuard?.branchName || "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => !open && setIsAddModalOpen(false)}
      >
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-white rounded-xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-indigo-600" /> Register New
              Employee
            </DialogTitle>
            <DialogDescription className="font-medium">
              Provide basic details first. Full details are required only for
              active site deployments.
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="mx-6 mt-4 bg-red-50 text-red-700 p-3 rounded-md text-sm font-semibold border border-red-200 flex items-center gap-2 shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}
          <form onSubmit={handleAddGuard} className="flex-1 overflow-y-auto">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-4 md:col-span-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-indigo-600" /> Core Employment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Full Name *
                    </Label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      className="h-11 font-bold uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Father's Name
                    </Label>
                    <Input
                      value={fathersName}
                      onChange={(e) =>
                        setFathersName(e.target.value.toUpperCase())
                      }
                      className="h-11 font-bold uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Mobile No * (Login ID)
                    </Label>
                    <Input
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="h-11 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Address
                    </Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value.toUpperCase())}
                      className="h-11 font-bold uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Department
                    </Label>
                    <Select
                      required
                      value={department}
                      onValueChange={(val) => {
                        setDepartment(val);
                        if (val === "OFFICE") setIsReliever(false);
                      }}
                    >
                      <SelectTrigger className="h-11 bg-white font-bold">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d} className="font-bold">
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Date of Joining
                    </Label>
                    <Input
                      type="date"
                      value={doj}
                      onChange={(e) => setDoj(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4 md:col-span-2 border-b pb-6">
                <div className="flex items-center gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-4">
                  <Checkbox
                    id="reliever"
                    disabled={department === "OFFICE"}
                    checked={isReliever}
                    onCheckedChange={(c) => {
                      setIsReliever(c);
                      if (c) setProjectId("");
                    }}
                    className="data-[state=checked]:bg-indigo-600 border-indigo-300 w-5 h-5 rounded-md"
                  />
                  <div className="grid gap-0.5">
                    <label
                      htmlFor="reliever"
                      className={`text-sm font-bold leading-none ${department === "OFFICE" ? "text-indigo-400" : "cursor-pointer text-indigo-900"}`}
                    >
                      Mark as Reliever Guard
                    </label>
                    <p className="text-xs text-indigo-700 font-medium">
                      Relievers float between sites. Selecting this allows you
                      to save instantly without entering Bank/Salary details.
                    </p>
                  </div>
                </div>
                {!isReliever && (
                  <div className="space-y-1.5 mt-4">
                    <Label className="text-xs font-bold text-slate-700 uppercase">
                      Project Assignment *
                    </Label>
                    <Select
                      required
                      value={projectId}
                      onValueChange={setProjectId}
                    >
                      <SelectTrigger className="h-11 font-bold text-indigo-900 bg-white">
                        <SelectValue>
                          {projectId
                            ? projects.find(
                                (p) => String(p._id) === String(projectId),
                              )?.name
                            : "Select a project to unlock remaining fields..."}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projects
                          .filter((p) => p.active)
                          .map((p) => (
                            <SelectItem
                              key={p._id}
                              value={p._id}
                              className="font-bold"
                            >
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {showAdvancedFields && (
                <>
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <Hash className="w-4 h-4 text-emerald-600" />{" "}
                      Identification
                    </h3>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 uppercase">
                        Aadhar Number (Used for Emp Code)
                      </Label>
                      <Input
                        value={adhar}
                        onChange={(e) => setAdhar(e.target.value)}
                        className="h-11 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 uppercase">
                        PAN Number
                      </Label>
                      <Input
                        value={pan}
                        onChange={(e) => setPan(e.target.value.toUpperCase())}
                        className="h-11 font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 uppercase">
                        Blood Group
                      </Label>
                      <Input
                        value={bloodGroup}
                        onChange={(e) =>
                          setBloodGroup(e.target.value.toUpperCase())
                        }
                        className="h-11 uppercase"
                        placeholder="e.g. O+, A-"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" /> Salary
                      & Compliance
                    </h3>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 uppercase">
                        Minimum Wages (Monthly)
                      </Label>
                      <Input
                        type="number"
                        required
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        className="h-11 font-bold text-emerald-700"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 uppercase">
                          UAN / PF No.
                        </Label>
                        <Input
                          value={pfNumber}
                          onChange={(e) =>
                            setPfNumber(e.target.value.toUpperCase())
                          }
                          className="h-11 font-mono uppercase"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 uppercase">
                          ESIC No.
                        </Label>
                        <Input
                          value={esicNumber}
                          onChange={(e) =>
                            setEsicNumber(e.target.value.toUpperCase())
                          }
                          className="h-11 font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <Building className="w-4 h-4 text-slate-600" /> Bank
                      Account Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 uppercase">
                          Bank Name
                        </Label>
                        <Input
                          list="indian-banks-list"
                          value={bankName}
                          onChange={(e) =>
                            setBankName(e.target.value.toUpperCase())
                          }
                          className="h-11 bg-white uppercase"
                          placeholder="Type to search..."
                        />
                        <datalist id="indian-banks-list">
                          {INDIAN_BANKS.map((bank) => (
                            <option key={bank} value={bank.toUpperCase()} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 uppercase">
                          Account Number
                        </Label>
                        <Input
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="h-11 font-mono bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 uppercase">
                          IFSC Code
                        </Label>
                        <Input
                          value={ifscCode}
                          onChange={(e) =>
                            setIfscCode(e.target.value.toUpperCase())
                          }
                          className="h-11 font-mono uppercase bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 uppercase">
                          Branch
                        </Label>
                        <Input
                          value={branchName}
                          onChange={(e) =>
                            setBranchName(e.target.value.toUpperCase())
                          }
                          className="h-11 bg-white uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-4 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="h-12 px-6 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {loading ? "Registering..." : "Complete Registration"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {editingGuard && (
        <EditGuardModal
          guard={editingGuard}
          projects={projects}
          onClose={() => setEditingGuard(null)}
          onSuccess={() => {
            setEditingGuard(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
