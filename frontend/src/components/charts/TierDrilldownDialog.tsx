"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import type { StudentPerformanceResponse } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROFICIENCY_THRESHOLD_PCT,
  PARTIAL_PROFICIENCY_THRESHOLD_PCT,
} from "@/lib/constants";

interface TierDrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  tierLabel: string;
  tierMin: number;
  tierMax: number;
  tierColor: string;
}

function getScoreColor(pct: number) {
  if (pct >= PROFICIENCY_THRESHOLD_PCT) return "text-green-600 dark:text-green-400";
  if (pct >= PARTIAL_PROFICIENCY_THRESHOLD_PCT) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getBadgeStyle(pct: number) {
  if (pct >= PROFICIENCY_THRESHOLD_PCT)
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  if (pct >= PARTIAL_PROFICIENCY_THRESHOLD_PCT)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
}

export default function TierDrilldownDialog({
  open,
  onClose,
  tierLabel,
  tierMin,
  tierMax,
  tierColor,
}: TierDrilldownDialogProps) {
  const [students, setStudents] = useState<
    { label: string; overall_score: number; scores_by_standard: Record<string, number> }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStudents([]);
      return;
    }

    async function fetchStudents() {
      setLoading(true);
      try {
        const resp = (await analyticsApi.studentPerformance()) as unknown as StudentPerformanceResponse;
        if (resp.suppressed) {
          setStudents([]);
          return;
        }
        const filtered = resp.students.filter((s) => {
          return s.overall_score >= tierMin && s.overall_score < tierMax;
        });
        // Sort by overall score ascending (lowest first so teacher sees who needs most help)
        filtered.sort((a, b) => a.overall_score - b.overall_score);
        setStudents(filtered);
      } catch {
        setStudents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, [open, tierMin, tierMax]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${tierColor}`} />
            {tierLabel}
          </DialogTitle>
          <DialogDescription>
            {tierMin}% – {tierMax === 101 ? "100" : tierMax}% overall score
            {" · "}
            {students.length} student{students.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium text-right">Overall Score</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.label} className="border-b hover:bg-muted/30">
                    <td className="py-2 pr-3 font-medium">{s.label}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${getScoreColor(s.overall_score)}`}>
                      {Math.round(s.overall_score)}%
                    </td>
                    <td className="py-2 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeStyle(s.overall_score)}`}>
                        {s.overall_score >= PROFICIENCY_THRESHOLD_PCT
                          ? "Proficient"
                          : s.overall_score >= PARTIAL_PROFICIENCY_THRESHOLD_PCT
                          ? "Partial"
                          : "Not Proficient"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No students in this tier.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
