import { Activity, Bot, Building2, Landmark, ListChecks, User } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useHealth } from "@/hooks/queries";
import { cn } from "@/lib/utils";

const ROLES = [
  { to: "/asha", label: "ASHA Worker", short: "ASHA", icon: User, description: "Field reporting" },
  { to: "/district", label: "District Officer", short: "District", icon: Building2, description: "Alerts & dispatch" },
  { to: "/state", label: "State Officer", short: "State", icon: Landmark, description: "Trends & resources" },
];

function AiStatus() {
  const health = useHealth();
  if (!health.data) return null;
  const { configured, model } = health.data.llm;
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-header-foreground/10 px-3 py-1 text-xs sm:inline-flex"
      title={configured ? `AI requests go to Groq (${model})` : "GROQ_API_KEY is not set on the server; AI features use rule-based fallbacks"}
    >
      {configured ? <Bot className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
      {configured ? `AI: ${model} via Groq` : "AI: rule-based mode"}
    </span>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-header-foreground/10 p-2">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">RHIN</h1>
              <p className="text-xs text-header-foreground/70">Rural Health Intelligence Network</p>
            </div>
          </div>
          <AiStatus />
        </div>
      </header>

      <nav className="border-b bg-card shadow-sm" aria-label="Role">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 py-2">
          {ROLES.map(({ to, label, short, icon: Icon, description }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
              <span className="hidden text-xs font-normal opacity-70 lg:inline">· {description}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-muted-foreground">
        Prototype for demonstration. AI output is decision support, not a diagnosis. Demo data is fictional.
      </footer>
    </div>
  );
}
