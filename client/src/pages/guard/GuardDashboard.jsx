import { useAuth } from "../../context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function GuardDashboard() {
  const { logout } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <Card className="w-full max-w-sm text-center shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Guard Dashboard</CardTitle>
          <CardDescription>Welcome to your control panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm font-medium border border-green-200">
            Logged in successfully as guard.
          </div>

          <Button
            onClick={logout}
            variant="destructive"
            size="lg"
            className="w-full font-semibold"
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
