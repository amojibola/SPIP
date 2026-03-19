"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import type { StudentQuestionDetailResponse } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROFICIENCY_THRESHOLD_PCT,
  PARTIAL_PROFICIENCY_THRESHOLD_PCT,
} from "@/lib/constants";

interface HeatmapDrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  studentLabel: string;
  columnKey: string;
  columnType: "standard" | "question_type";
  studentIndex: number;
  assessmentId?: string;
}

function getScoreColor(pct: number) {
  if (pct >= PROFICIENCY_THRESHOLD_PCT) return "text-green-600 dark:text-green-400";
  if (pct >= PARTIAL_PROFICIENCY_THRESHOLD_PCT) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getSummaryBg(pct: number) {
  if (pct >= PROFICIENCY_THRESHOLD_PCT) return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  if (pct >= PARTIAL_PROFICIENCY_THRESHOLD_PCT) return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
}

export default function HeatmapDrilldownDialog({
  open,
  onClose,
  studentLabel,
  columnKey,
  columnType,
  studentIndex,
  assessmentId,
}: HeatmapDrilldownDialogProps) {
  const [data, setData] = useState<StudentQuestionDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setData(null);
      return;
    }

    async function fetchDetail() {
      setLoading(true);
      try {
        const standard = columnType === "standard" ? columnKey : undefined;
        const questionType = columnType === "question_type" ? columnKey : undefined;
        const resp = await analyticsApi.studentQuestionDetail(
          studentIndex,
          assessmentId,
          standard,
          questionType,
        );
        setData(resp as unknown as StudentQuestionDetailResponse);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [open, studentIndex, columnKey, columnType, assessmentId]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{studentLabel} — Question Detail</DialogTitle>
          <DialogDescription>
            {columnType === "standard"
              ? `Standard: ${columnKey}`
              : `Question Type: ${columnKey}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : data && data.questions.length > 0 ? (
          <div className="space-y-4">
            {/* Summary */}
            {data.summary && (
              <div className={`rounded-lg border p-3 ${getSummaryBg(data.summary.pct_score)}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Score</span>
                  <span className={`text-lg font-bold ${getScoreColor(data.summary.pct_score)}`}>
                    {data.summary.pct_score}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.total_earned} / {data.summary.total_possible} points
                </p>
              </div>
            )}

            {/* Questions table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Q#</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    {columnType !== "standard" && (
                      <th className="py-2 pr-3 font-medium">Standard</th>
                    )}
                    <th className="py-2 pr-3 font-medium">DOK</th>
                    <th className="py-2 pr-3 font-medium text-right">Earned</th>
                    <th className="py-2 pr-3 font-medium text-right">Max</th>
                    <th className="py-2 font-medium text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.questions.map((q) => (
                    <tr key={q.question_number} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">Q{q.question_number}</td>
                      <td className="py-2 pr-3 text-xs">{q.question_type}</td>
                      {columnType !== "standard" && (
                        <td className="py-2 pr-3 text-xs">{q.standard || "—"}</td>
                      )}
                      <td className="py-2 pr-3">
                        {q.dok_level ? (
                          <Badge variant="outline" className="text-xs">
                            DOK {q.dok_level.replace(/Level\s*/i, "")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">{q.points_earned}</td>
                      <td className="py-2 pr-3 text-right">{q.max_points}</td>
                      <td className={`py-2 text-right font-semibold ${getScoreColor(q.pct_score)}`}>
                        {q.pct_score}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No question data available.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
