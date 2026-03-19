"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import type { StudentPerformanceResponse } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { FileText } from "lucide-react";
import StudentHeatmap from "@/components/charts/StudentHeatmap";
import HeatmapDrilldownDialog from "@/components/charts/HeatmapDrilldownDialog";

export default function ReportsPage() {
  const [performanceData, setPerformanceData] = useState<StudentPerformanceResponse | null>(null);
  const [storyAnalysis, setStoryAnalysis] = useState<Record<string, unknown> | null>(null);
  const [progress, setProgress] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState<"standard" | "question_type">("standard");
  const [drilldown, setDrilldown] = useState<{
    open: boolean;
    studentIndex: number;
    studentLabel: string;
    columnKey: string;
    columnType: "standard" | "question_type";
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [perf, sa, pg] = await Promise.allSettled([
          analyticsApi.studentPerformance(),
          analyticsApi.storyProblemAnalysis(),
          analyticsApi.progressOverTime(),
        ]);
        if (perf.status === "fulfilled") {
          const parsed = perf.value as unknown as StudentPerformanceResponse;
          setPerformanceData(parsed);
        }
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

  const handleCellClick = (studentIndex: number, studentLabel: string, columnKey: string) => {
    setDrilldown({
      open: true,
      studentIndex,
      studentLabel,
      columnKey,
      columnType: heatmapMode,
    });
  };

  const hasHeatmapData = performanceData && !performanceData.suppressed && performanceData.students.length > 0;

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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle>
                    {heatmapMode === "standard"
                      ? "Student \u00D7 Standard Heatmap"
                      : "Student \u00D7 Question Type Heatmap"}
                  </CardTitle>
                  <CardDescription>
                    {heatmapMode === "standard"
                      ? "Each cell shows a student\u2019s proficiency on a given standard."
                      : "Each cell shows a student\u2019s proficiency on a given question type."}
                  </CardDescription>
                </div>
                {hasHeatmapData && (
                  <div className="flex rounded-lg border p-0.5 bg-muted/50">
                    <button
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        heatmapMode === "standard"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setHeatmapMode("standard")}
                    >
                      By Standard
                    </button>
                    <button
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        heatmapMode === "question_type"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setHeatmapMode("question_type")}
                    >
                      By Question Type
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : hasHeatmapData ? (
                <StudentHeatmap
                  students={performanceData.students}
                  mode={heatmapMode}
                  onCellClick={handleCellClick}
                />
              ) : performanceData?.suppressed ? (
                <EmptyState
                  icon={FileText}
                  title="Data suppressed"
                  description="Fewer than 5 students — data is suppressed to protect privacy."
                />
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
                  <StatCard label="Avg Computation" value={`${storyAnalysis.avg_computation ?? "\u2014"}%`} />
                  <StatCard label="Avg Story Problem" value={`${storyAnalysis.avg_story ?? "\u2014"}%`} />
                  <StatCard label="Gap" value={`${storyAnalysis.gap ?? "\u2014"}pp`} />
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

      {/* Drilldown Dialog */}
      {drilldown && (
        <HeatmapDrilldownDialog
          open={drilldown.open}
          onClose={() => setDrilldown(null)}
          studentLabel={drilldown.studentLabel}
          columnKey={drilldown.columnKey}
          columnType={drilldown.columnType}
          studentIndex={drilldown.studentIndex}
        />
      )}
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
