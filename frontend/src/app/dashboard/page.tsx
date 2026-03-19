"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, BarChart3, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { useAuth } from "@/lib/providers";
import { analyticsApi } from "@/lib/api";
import { KPICard } from "@/components/app/KPICard";
import { DashboardSkeleton } from "@/components/app/LoadingSkeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProficiencyBarChart from "@/components/charts/ProficiencyBarChart";
import TierDrilldownDialog from "@/components/charts/TierDrilldownDialog";

interface DashboardData {
  proficiency: Record<string, unknown>[] | null;
  interventionGroups: Record<string, { count: number; avg_score: number; suppressed: boolean }> | null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ proficiency: null, interventionGroups: null });
  const [loading, setLoading] = useState(true);
  const [tierDrilldown, setTierDrilldown] = useState<{
    open: boolean;
    label: string;
    min: number;
    max: number;
    color: string;
  } | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [profResult, groupsResult] = await Promise.allSettled([
          analyticsApi.proficiencyByStandard(),
          analyticsApi.interventionGroups(),
        ]);

        const profResp = profResult.status === "fulfilled" ? profResult.value : null;
        const groupsResp = groupsResult.status === "fulfilled" ? groupsResult.value : null;

        setData({
          proficiency: (profResp as any)?.data || null,
          interventionGroups: (groupsResp as any)?.data || null,
        });
      } catch {
        // Errors handled per-card
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const groups = data.interventionGroups;
  const tier1 = groups?.["Tier 1 - Proficient"]?.count ?? 0;
  const tier2 = groups?.["Tier 2 - Partially Proficient"]?.count ?? 0;
  const tier3 = groups?.["Tier 3 - Not Proficient"]?.count ?? 0;
  const totalStudents = tier1 + tier2 + tier3;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.full_name || "Teacher"}. Here&apos;s your classroom overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Total Students"
          value={totalStudents || "—"}
          subtitle="Across all assessments"
          icon={Users}
          href="/dashboard/reports"
        />
        <KPICard
          title="Standards Assessed"
          value={data.proficiency?.length || "—"}
          subtitle="Unique standards"
          icon={BarChart3}
          href="/dashboard/standards"
        />
        <KPICard
          title="Tier 1 (Proficient)"
          value={tier1 || "—"}
          subtitle="80–100%"
          icon={TrendingUp}
        />
        <KPICard
          title="Tier 2 (Partial)"
          value={tier2 || "—"}
          subtitle="60–79.9%"
          icon={Target}
        />
        <KPICard
          title="Tier 3 (Not Proficient)"
          value={tier3 || "—"}
          subtitle="0–59.9%"
          icon={AlertTriangle}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proficiency by Standard</CardTitle>
            <CardDescription>
              Class average proficiency for each assessed standard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.proficiency && data.proficiency.length > 0 ? (
              <ProficiencyBarChart
                data={data.proficiency as any}
                onBarClick={() => router.push("/dashboard/standards")}
              />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                No assessment data yet. Upload data to see results.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intervention Groups</CardTitle>
            <CardDescription>
              Student distribution across support tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups ? (
              <div className="space-y-4 pt-4">
                <TierBar label="Tier 1 — Proficient" count={tier1} total={totalStudents} color="bg-green-500"
                  onClick={() => setTierDrilldown({ open: true, label: "Tier 1 — Proficient", min: 80, max: 101, color: "bg-green-500" })} />
                <TierBar label="Tier 2 — Partially Proficient" count={tier2} total={totalStudents} color="bg-amber-500"
                  onClick={() => setTierDrilldown({ open: true, label: "Tier 2 — Partially Proficient", min: 60, max: 80, color: "bg-amber-500" })} />
                <TierBar label="Tier 3 — Not Proficient" count={tier3} total={totalStudents} color="bg-red-500"
                  onClick={() => setTierDrilldown({ open: true, label: "Tier 3 — Not Proficient", min: 0, max: 60, color: "bg-red-500" })} />
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier Drilldown Dialog */}
      {tierDrilldown && (
        <TierDrilldownDialog
          open={tierDrilldown.open}
          onClose={() => setTierDrilldown(null)}
          tierLabel={tierDrilldown.label}
          tierMin={tierDrilldown.min}
          tierMax={tierDrilldown.max}
          tierColor={tierDrilldown.color}
        />
      )}
    </div>
  );
}

function TierBar({ label, count, total, color, onClick }: { label: string; count: number; total: number; color: string; onClick?: () => void }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      className="w-full space-y-1 text-left rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{count} ({pct}%)</span>
      </div>
      <div className="h-3 rounded-full bg-muted">
        <div
          className={`h-3 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
