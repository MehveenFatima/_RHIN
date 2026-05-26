import { useState } from "react";
import { type Role } from "@/lib/store";
import AshaWorkerView from "@/components/AshaWorkerView";
import DistrictOfficerView from "@/components/DistrictOfficerView";
import StateOfficerView from "@/components/StateOfficerView";
import { Activity, User, Building2, Landmark } from "lucide-react";

const ROLES: { value: Role; label: string; icon: typeof User; description: string }[] = [
  { value: "asha", label: "ASHA Worker", icon: User, description: "Field Health Worker" },
  { value: "district", label: "District Officer", icon: Building2, description: "District Health Authority" },
  { value: "state", label: "State Officer", icon: Landmark, description: "State Health Command" },
];

export default function Index() {
  const [role, setRole] = useState<Role>("asha");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-header-foreground/10">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">RHIN</h1>
              <p className="text-xs text-header-foreground/70">Rural Health Intelligence Network</p>
            </div>
          </div>
          <div className="text-xs text-header-foreground/60 hidden sm:block">
            Outbreak Surveillance System
          </div>
        </div>
      </header>

      {/* Role Switcher */}
      <div className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {ROLES.map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                onClick={() => setRole(value)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  role === value
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {role === "asha" && <AshaWorkerView />}
        {role === "district" && <DistrictOfficerView />}
        {role === "state" && <StateOfficerView />}
      </main>
    </div>
  );
}
