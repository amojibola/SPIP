"use client";

import { useEffect, useState } from "react";
import { Users, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/providers";
import { analyticsApi } from "@/lib/api";
import { KPICard } from "@/components/app/KPICard";
import { DashboardSkeleton } from "@/components/app/LoadingSkeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProficiencyBarChart from "@/components/charts/ProficiencyBarChart";

interface DashboardData {
  proficiency: Record<string, unknown>[] | null;
  interventionGroups: Record<string, { count: number; avg_score: number; suppressed: boolean }> | null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({ proficiency: null, interventionGroups: null });
  const [loading, setLoading] = useState(true);

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
  const tier1 = groups?.["Tier 1 - Enrichment"]?.count ?? 0;
  const tier2 = groups?.["Tier 2 - Strategic"]?.count ?? 0;
  const tier3 = groups?.["Tier 3 - Intensive"]?.count ?? 0;
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Students"
          value={totalStudents || "—"}
          subtitle="Across all assessments"
          icon={Users}
        />
        <KPICard
          title="Standards Assessed"
          value={data.proficiency?.length || "—"}
          subtitle="Unique standards"
          icon={BarChart3}
        />
        <KPICard
          title="Tier 1 (On Track)"
          value={tier1 || "—"}
          subtitle="≥70% proficiency"
          icon={TrendingUp}
        />
        <KPICard
          title="Tier 3 (Intensive)"
          value={tier3 || "—"}
          subtitle="<40% proficiency"
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
              <ProficiencyBarChart data={data.proficiency as any} />
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
                <TierBar label="Tier 1 — On Track" count={tier1} total={totalStudents} color="bg-green-500" />
                <TierBar label="Tier 2 — Strategic" count={tier2} total={totalStudents} color="bg-amber-500" />
                <TierBar label="Tier 3 — Intensive" count={tier3} total={totalStudents} color="bg-red-500" />
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
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
    </div>
  );
}
