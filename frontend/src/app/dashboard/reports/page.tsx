"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  const [heatmap, setHeatmap] = useState<Record<string, unknown>[] | null>(null);
  const [storyAnalysis, setStoryAnalysis] = useState<Record<string, unknown> | null>(null);
  const [progress, setProgress] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [hm, sa, pg] = await Promise.allSettled([
          analyticsApi.studentHeatmap(),
          analyticsApi.storyProblemAnalysis(),
          analyticsApi.progressOverTime(),
        ]);
        setHeatmap(hm.status === "fulfilled" ? hm.value : null);
        setStoryAnalysis(sa.status === "fulfilled" ? sa.value : null);
        setProgress(pg.status === "fulfilled" ? pg.value : null);
      } catch {
        // handled per tab
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Detailed analytics and exportable reports.
        </p>
      </div>

      <Tabs defaultValue="heatmap">
        <TabsList>
          <TabsTrigger value="heatmap">Student Heatmap</TabsTrigger>
          <TabsTrigger value="story">Story vs Computation</TabsTrigger>
          <TabsTrigger value="progress">Progress Over Time</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Student × Standard Heatmap</CardTitle>
              <CardDescription>
                Each cell shows a student&apos;s proficiency on a given standard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : heatmap && heatmap.length > 0 ? (
                <HeatmapTable data={heatmap} />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No heatmap data"
                  description="Upload assessments to generate the student heatmap."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="story" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Story Problem vs Computation Analysis</CardTitle>
              <CardDescription>
                Compare student performance on word problems vs pure computation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : storyAnalysis ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="Avg Computation" value={`${storyAnalysis.avg_computation ?? "—"}%`} />
                  <StatCard label="Avg Story Problem" value={`${storyAnalysis.avg_story ?? "—"}%`} />
                  <StatCard label="Gap" value={`${storyAnalysis.gap ?? "—"}pp`} />
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No analysis data"
                  description="Upload assessment data to see story problem analysis."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Progress Over Time</CardTitle>
              <CardDescription>
                Track proficiency trends across assessment windows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : progress && progress.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  {/* Progress chart placeholder - implement with Recharts LineChart */}
                  <div className="flex h-[300px] items-center justify-center">
                    Line chart with {progress.length} data points will render here.
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No progress data"
                  description="Need multiple assessments to show progress over time."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeatmapTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return null;
  const standards = Object.keys(data[0]).filter((k) => k !== "student_xid");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Student</th>
            {standards.map((s) => (
              <th key={s} className="px-3 py-2 text-center font-medium text-xs">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b">
              <td className="px-3 py-2 font-medium">{String(row.student_xid)}</td>
              {standards.map((s) => {
                const val = Number(row[s]) || 0;
                const bg =
                  val >= 70
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : val >= 40
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
                return (
                  <td key={s} className={`px-3 py-2 text-center text-xs font-medium ${bg}`}>
                    {Math.round(val)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
