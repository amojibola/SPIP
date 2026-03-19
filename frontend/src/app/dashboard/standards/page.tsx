"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { analyticsApi } from "@/lib/api";
import type { StudentPerformanceResponse } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { BarChart3, X, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProficiencyBarChart from "@/components/charts/ProficiencyBarChart";
import StudentPerformanceTable from "@/components/charts/StudentPerformanceTable";

interface StandardDetail {
  standard: string;
  proficiency: number;
  student_count: number;
  suppressed: boolean;
  question_types: string[];
}

interface QuestionTypeData {
  question_type: string;
  proficiency: number;
  student_count: number;
  question_count: number;
  suppressed: boolean;
}

interface QuestionBreakdown {
  question_number: number;
  question_type: string;
  dok_level: string;
  max_points: number;
  avg_score: number;
  pct_full_credit: number;
  students_answered: number;
}

interface DistBucket {
  range: string;
  count: number;
}

interface StandardBreakdownData {
  standard: string;
  proficiency: number;
  student_count: number;
  suppressed: boolean;
  questions: QuestionBreakdown[];
  distribution: DistBucket[];
  median_score: number;
}

export default function StandardsPage() {
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessment_id") ?? undefined;
  const [standards, setStandards] = useState<StandardDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<StandardBreakdownData | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeData[]>([]);
  const [studentData, setStudentData] = useState<StudentPerformanceResponse | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentFilterStandard, setStudentFilterStandard] = useState<string | undefined>(undefined);
  const [studentFilterQType, setStudentFilterQType] = useState<string | undefined>(undefined);
  const [selectedQuestionType, setSelectedQuestionType] = useState<string | null>(null);
  const breakdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [stdResp, qtResp] = await Promise.all([
          analyticsApi.proficiencyByStandard(assessmentId),
          analyticsApi.proficiencyByQuestionType(assessmentId),
        ]);
        const parsedStd = stdResp as unknown as { data: StandardDetail[] };
        setStandards(parsedStd?.data || []);
        const parsedQt = qtResp as unknown as { data: QuestionTypeData[] };
        setQuestionTypes(parsedQt?.data || []);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assessmentId]);

  const fetchStudentData = useCallback(async (standard?: string, questionType?: string) => {
    setStudentLoading(true);
    setStudentData(null);
    try {
      const resp = await analyticsApi.studentPerformance(assessmentId, standard, questionType);
      const parsed = resp as unknown as StudentPerformanceResponse;
      setStudentData(parsed || null);
      setStudentFilterStandard(standard);
      setStudentFilterQType(questionType);
    } catch {
      setStudentData(null);
    } finally {
      setStudentLoading(false);
    }
  }, [assessmentId]);

  const scrollToBreakdown = useCallback(() => {
    setTimeout(() => {
      breakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const handleBarClick = async (standard: string) => {
    setSelectedStandard(standard);
    setSelectedQuestionType(null);
    setBreakdownLoading(true);
    setBreakdown(null);
    scrollToBreakdown();
    try {
      const resp = await analyticsApi.standardBreakdown(standard, assessmentId);
      const parsed = resp as unknown as { data: StandardBreakdownData };
      setBreakdown(parsed?.data || null);
    } catch {
      setBreakdown(null);
    } finally {
      setBreakdownLoading(false);
    }
    fetchStudentData(standard, undefined);
  };

  const handleQuestionTypeClick = (questionType: string) => {
    setSelectedQuestionType(questionType);
    setSelectedStandard(null);
    setBreakdown(null);
    scrollToBreakdown();
    fetchStudentData(undefined, questionType);
  };

  const handleCloseBreakdown = () => {
    setSelectedStandard(null);
    setSelectedQuestionType(null);
    setBreakdown(null);
    setStudentData(null);
  };

  const handleStudentFilterChange = (standard?: string, questionType?: string) => {
    setStudentFilterStandard(standard);
    setStudentFilterQType(questionType);
    if (standard) {
      setSelectedStandard(standard);
      setSelectedQuestionType(null);
    } else if (questionType) {
      setSelectedQuestionType(questionType);
      setSelectedStandard(null);
    }
    fetchStudentData(standard, questionType);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (standards.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Standards Analysis</h1>
          <p className="text-muted-foreground">Deep dive into proficiency by standard.</p>
        </div>
        <EmptyState
          icon={BarChart3}
          title="No standards data"
          description="Upload an assessment to see standards-level proficiency analysis."
        />
      </div>
    );
  }

  const getProficiencyVariant = (pct: number) => {
    if (pct >= 80) return "proficient" as const;
    if (pct >= 60) return "approaching" as const;
    return "below" as const;
  };

  const getDokLabel = (dok: string) => {
    if (!dok) return "";
    // Shorten long DOK strings
    const match = dok.match(/Level\s*(\d)/i);
    if (match) return `DOK ${match[1]}`;
    if (dok.length <= 5) return dok;
    return dok;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Standards Analysis</h1>
        <p className="text-muted-foreground">
          Proficiency breakdown across {standards.length} assessed standards.
        </p>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Proficiency by Standard</CardTitle>
          <CardDescription>Average proficiency per standard across all students</CardDescription>
        </CardHeader>
        <CardContent>
          <ProficiencyBarChart
            data={standards as any}
            onBarClick={handleBarClick}
          />
        </CardContent>
      </Card>

      {/* Proficiency by Question Type */}
      {questionTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Proficiency by Question Type</CardTitle>
            <CardDescription>
              How students perform across different question formats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {questionTypes.map((qt) => {
                const color =
                  qt.suppressed ? "bg-gray-300" :
                  qt.proficiency >= 80 ? "bg-green-500" :
                  qt.proficiency >= 60 ? "bg-yellow-400" :
                  "bg-red-400";
                return (
                  <div
                    key={qt.question_type}
                    className={`space-y-1 cursor-pointer rounded-lg p-2 -mx-2 transition-all hover:bg-muted/50 ${
                      selectedQuestionType === qt.question_type ? "ring-2 ring-primary bg-muted/30" : ""
                    }`}
                    onClick={() => !qt.suppressed && handleQuestionTypeClick(qt.question_type)}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{qt.question_type}</span>
                        <span className="text-xs text-muted-foreground">
                          ({qt.question_count} {qt.question_count === 1 ? "question" : "questions"})
                        </span>
                      </div>
                      {qt.suppressed ? (
                        <span className="text-xs text-muted-foreground italic">N&lt;5 suppressed</span>
                      ) : (
                        <span className={
                          qt.proficiency >= 80 ? "font-semibold text-green-600" :
                          qt.proficiency >= 60 ? "font-semibold text-yellow-600" :
                          "font-semibold text-red-600"
                        }>
                          {qt.proficiency}%
                        </span>
                      )}
                    </div>
                    <div className="h-2.5 rounded-full bg-muted">
                      <div
                        className={`h-2.5 rounded-full ${color} transition-all`}
                        style={{ width: `${qt.suppressed ? 0 : Math.min(qt.proficiency, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">Click a question type to see individual student performance</p>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Panel — appears when a bar is clicked */}
      <div ref={breakdownRef} />
      {selectedStandard && (
        <Card className="border-primary/50 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedStandard}
                </CardTitle>
                <CardDescription>Detailed breakdown of this standard</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseBreakdown}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading breakdown…</span>
              </div>
            ) : breakdown ? (
              <div className="space-y-6">
                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{breakdown.proficiency}%</p>
                    <p className="text-xs text-muted-foreground">Avg Proficiency</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{breakdown.median_score}%</p>
                    <p className="text-xs text-muted-foreground">Median Score</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{breakdown.student_count}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{breakdown.questions.length}</p>
                    <p className="text-xs text-muted-foreground">Questions</p>
                  </div>
                </div>

                {/* Questions table */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Questions Aligned to This Standard</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Q#</th>
                          <th className="py-2 pr-4 font-medium">Type</th>
                          <th className="py-2 pr-4 font-medium">DOK</th>
                          <th className="py-2 pr-4 font-medium">Max Pts</th>
                          <th className="py-2 pr-4 font-medium">Avg Score</th>
                          <th className="py-2 pr-4 font-medium">% Full Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.questions.map((q) => (
                          <tr key={q.question_number} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium">Q{q.question_number}</td>
                            <td className="py-2 pr-4">{q.question_type || "—"}</td>
                            <td className="py-2 pr-4">
                              {q.dok_level ? (
                                <Badge variant="outline" className="text-xs">
                                  {getDokLabel(q.dok_level)}
                                </Badge>
                              ) : "—"}
                            </td>
                            <td className="py-2 pr-4">{q.max_points}</td>
                            <td className="py-2 pr-4">{q.avg_score}</td>
                            <td className="py-2 pr-4">
                              <span className={
                                q.pct_full_credit >= 80 ? "text-green-600 font-medium" :
                                q.pct_full_credit >= 60 ? "text-yellow-600 font-medium" :
                                "text-red-600 font-medium"
                              }>
                                {q.pct_full_credit}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Score distribution */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Student Score Distribution</h4>
                  <div className="flex gap-2 items-end h-24">
                    {breakdown.distribution.map((bucket) => {
                      const maxCount = Math.max(...breakdown.distribution.map(d => d.count), 1);
                      const heightPct = Math.max((bucket.count / maxCount) * 100, 4);
                      const color =
                        bucket.range === "90-100" || bucket.range === "80-89" ? "bg-green-500" :
                        bucket.range === "60-79" ? "bg-yellow-400" :
                        "bg-red-400";
                      return (
                        <div key={bucket.range} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {bucket.count}
                          </span>
                          <div
                            className={`w-full rounded-t ${color} transition-all`}
                            style={{ height: `${heightPct}%`, minHeight: "4px" }}
                          />
                          <span className="text-xs text-muted-foreground">{bucket.range}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No breakdown data available for this standard.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student Performance Table — appears when a standard or question type is selected */}
      {(selectedStandard || selectedQuestionType) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Student Performance
                </CardTitle>
                <CardDescription>
                  {selectedStandard
                    ? `Individual student scores for ${selectedStandard}`
                    : `Individual student scores for ${selectedQuestionType} questions`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseBreakdown}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {studentLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading student data…</span>
              </div>
            ) : studentData?.suppressed ? (
              <p className="text-sm text-muted-foreground py-4 italic">
                N&lt;5 — student data suppressed to protect privacy.
              </p>
            ) : studentData && studentData.students.length > 0 ? (
              <StudentPerformanceTable
                students={studentData.students}
                availableStandards={studentData.filters.available_standards}
                availableQuestionTypes={studentData.filters.available_question_types}
                activeStandard={studentFilterStandard}
                activeQuestionType={studentFilterQType}
                onFilterChange={handleStudentFilterChange}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4">No student data available.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {standards.map((s) => (
          <Card
            key={s.standard}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedStandard === s.standard ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleBarClick(s.standard)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{s.standard}</CardTitle>
                <Badge variant={getProficiencyVariant(s.proficiency)}>
                  {Math.round(s.proficiency)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Students assessed</span>
                  <span className="font-medium text-foreground">{s.student_count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted mt-2">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(s.proficiency, 100)}%` }}
                  />
                </div>
                {s.question_types && s.question_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {s.question_types.map((qt) => (
                      <Badge key={qt} variant="outline" className="text-xs font-normal">
                        {qt}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
