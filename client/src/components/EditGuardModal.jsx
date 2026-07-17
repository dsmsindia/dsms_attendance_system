import { useState } from "react";
import api from "../api/axios";
import { INDIAN_BANKS, DEPARTMENTS } from "../pages/admin/GuardsPage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Save, History, Shield, Hash, CreditCard, Building } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function EditGuardModal({ guard, projects = [], onClose, onSuccess }) {
  const [name, setName] = useState(guard.name || "");
  // FIX: Edit modal mapping for the new fields
  const [fathersName, setFathersName] = useState(guard.fathersName || "");
  const [address, setAddress] = useState(guard.address || "");
  const [contact, setContact] = useState(guard.contact || "");
  const [department, setDepartment] = useState(guard.department || "SECURITY GUARD");
  const [salary, setSalary] = useState(guard.salary || "");
  const [pfNumber, setPfNumber] = useState(guard.pfNumber || "");
  const [esicNumber, setEsicNumber] = useState(guard.esicNumber || "");
  
  const [adhar, setAdhar] = useState(guard.adhar || "");
  const [pan, setPan] = useState(guard.pan || "");
  const [doj, setDoj] = useState(guard.doj || "");
  const [bloodGroup, setBloodGroup] = useState(guard.bloodGroup || "");
  const [bankName, setBankName] = useState(guard.bankName || "");
  const [accountNumber, setAccountNumber] = useState(guard.accountNumber || "");
  const [ifscCode, setIfscCode] = useState(guard.ifscCode || "");
  const [branchName, setBranchName] = useState(guard.branchName || "");

  const originalIsReliever = guard.isReliever;
  const originalProjectId = guard.projectId?._id || guard.projectId || "";
  
  const [isRelieverState, setIsRelieverState] = useState(originalIsReliever);
  const [projectIdState, setProjectIdState] = useState(originalProjectId);
  
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const isAssignmentChanged = isRelieverState !== originalIsReliever || (!isRelieverState && projectIdState !== originalProjectId);

  const showAdvancedFields = department === "OFFICE" || (!isRelieverState && projectIdState !== "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/guards/${guard._id}`, {
        // Pushing the new fields during the Edit Update
        name, fathersName, address, contact, department, salary, pfNumber, esicNumber,
        adhar, pan, doj, bloodGroup, bankName, accountNumber, ifscCode, branchName,
        projectId: isRelieverState ? null : projectIdState,
        isReliever: isRelieverState,
        effectiveDate: isAssignmentChanged ? effectiveDate : null,
      });
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update guard");
    }
    setLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-white rounded-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
          <DialogTitle className="text-2xl font-black text-slate-900">Edit Personnel Profile</DialogTitle>
          <DialogDescription className="font-medium text-slate-500">Update information or process a site transfer.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-600"/> Core Employment</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Full Name *</Label><Input required value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className="h-11 font-bold uppercase" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Father's Name</Label><Input value={fathersName} onChange={(e) => setFathersName(e.target.value.toUpperCase())} className="h-11 font-bold uppercase" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Mobile No *</Label><Input required value={contact} onChange={(e) => setContact(e.target.value)} className="h-11 font-bold" /></div>
                
                <div className="space-y-1.5 md:col-span-3"><Label className="text-xs font-bold text-slate-700 uppercase">Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value.toUpperCase())} className="h-11 font-bold uppercase" /></div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase">Department</Label>
                  <Select required value={department} onValueChange={(val) => { setDepartment(val); if (val === "OFFICE") setIsRelieverState(false); }}>
                    <SelectTrigger className="h-11 bg-white font-bold"><SelectValue placeholder="Select Role" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Date of Joining</Label><Input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} className="h-11" /></div>
              </div>
            </div>

            <div className="space-y-4 md:col-span-2 border-y py-6 my-2">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><History className="w-4 h-4 text-indigo-600"/> Assignment & Transfer</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border shadow-sm flex-1">
                  <Checkbox id="edit-reliever" disabled={department === "OFFICE"} checked={isRelieverState} onCheckedChange={(c) => { setIsRelieverState(c); if(c) setProjectIdState(""); }} className="data-[state=checked]:bg-indigo-600 w-5 h-5" />
                  <label htmlFor="edit-reliever" className={`text-sm font-bold ${department === "OFFICE" ? "text-indigo-400" : "text-slate-900 cursor-pointer"}`}>Pool Reliever</label>
                </div>
                {!isRelieverState && (
                  <div className="flex-1 w-full">
                    <Select value={projectIdState} onValueChange={setProjectIdState}>
                      <SelectTrigger className="h-12 bg-white font-bold text-indigo-900 shadow-sm">
                        <SelectValue>
                          {projectIdState 
                            ? projects.find((p) => String(p._id) === String(projectIdState))?.name || "Select Project" 
                            : "Select Project"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>{projects.filter(p => p.active).map(p => <SelectItem key={p._id} value={p._id} className="font-bold">{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {isAssignmentChanged && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
                  <div>
                    <Label className="text-emerald-900 font-bold uppercase text-xs flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> Transfer Effective Date</Label>
                    <p className="text-xs text-emerald-700 mt-1">When does this site change take effect in reports?</p>
                  </div>
                  <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-11 w-full sm:w-48 bg-white font-bold text-emerald-900" />
                </div>
              )}
            </div>
            
            {showAdvancedFields && (
              <>
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Hash className="w-4 h-4 text-emerald-600"/> Identification</h3>
                  <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Aadhar Number</Label><Input value={adhar} onChange={(e) => setAdhar(e.target.value)} className="h-11 font-mono" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">PAN Number</Label><Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} className="h-11 font-mono uppercase" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Blood Group</Label><Input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value.toUpperCase())} className="h-11 uppercase" /></div>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-600"/> Salary & Compliance</h3>
                  <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Minimum Wages</Label><Input type="number" required value={salary} onChange={(e) => setSalary(e.target.value)} className="h-11 font-bold text-emerald-700" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">UAN / PF No.</Label><Input value={pfNumber} onChange={(e) => setPfNumber(e.target.value.toUpperCase())} className="h-11 font-mono uppercase" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">ESIC No.</Label><Input value={esicNumber} onChange={(e) => setEsicNumber(e.target.value.toUpperCase())} className="h-11 font-mono uppercase" /></div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Building className="w-4 h-4 text-slate-600"/> Bank Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 uppercase">Bank Name</Label>
                      <Input 
                        list="indian-banks-list-edit"
                        value={bankName} 
                        onChange={(e) => setBankName(e.target.value.toUpperCase())} 
                        className="h-11 bg-white uppercase" 
                        placeholder="Type to search..."
                      />
                      <datalist id="indian-banks-list-edit">
                        {INDIAN_BANKS.map(bank => <option key={bank} value={bank.toUpperCase()} />)}
                      </datalist>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Account Number</Label><Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="h-11 font-mono bg-white" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">IFSC</Label><Input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} className="h-11 font-mono uppercase bg-white" /></div>
                    <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700 uppercase">Branch</Label><Input value={branchName} onChange={(e) => setBranchName(e.target.value.toUpperCase())} className="h-11 bg-white uppercase" /></div>
                  </div>
                </div>
              </>
            )}

          </div>
          <div className="p-6 border-t bg-slate-50 flex justify-end gap-4 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} className="h-12 px-6 font-bold">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}