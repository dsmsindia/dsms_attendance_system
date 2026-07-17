import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ManageProjectModal({ project, onClose }) {
  if (!project) return null;

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center mb-1">
            <span className="font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-md tracking-tight">
              {project.name}
            </span>
          </DialogTitle>
          <DialogDescription>
            Project site configuration. Weekly-off rules have been deprecated in
            favor of manual explicit tracking.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
