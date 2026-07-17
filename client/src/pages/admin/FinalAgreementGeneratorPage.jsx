import { FileCheck, Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function FinalAgreementGeneratorPage() {
  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-6 min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
          <FileCheck className="w-8 h-8 text-rose-600" />
          Final Agreement Generator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Draft and issue finalized binding contracts securely.
        </p>
      </div>

      <div className="flex-1 overflow-auto w-full">
        <Card className="border shadow-sm bg-white overflow-hidden rounded-xl border-dashed h-full">
          <CardContent className="flex flex-col items-center justify-center h-full py-24 text-center px-4">
            <div className="bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center mb-6">
              <Construction className="w-10 h-10 text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Coming Soon
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              We are building an advanced final agreement generator. This feature
              will allow you to securely generate, export, and lock final
              execution copies of your agreements.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}