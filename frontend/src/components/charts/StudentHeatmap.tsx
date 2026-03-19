"use client";

import { useMemo } from "react";
import type { StudentPerformanceEntry } from "@/lib/api";
import {
  PROFICIENCY_THRESHOLD_PCT,
  PARTIAL_PROFICIENCY_THRESHOLD_PCT,
} from "@/lib/constants";

interface StudentHeatmapProps {
  students: StudentPerformanceEntry[];
  mode: "standard" | "question_type";
  onCellClick: (studentIndex: number, studentLabel: string, columnKey: string) => void;
}

function getCellColor(value: number | undefined) {
  if (value === undefined || value === null) {
    return "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500";
  }
  if (value >= PROFICIENCY_THRESHOLD_PCT) {
    return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  }
  if (value >= PARTIAL_PROFICIENCY_THRESHOLD_PCT) {
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  }
  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
}

export default function StudentHeatmap({ students, mode, onCellClick }: StudentHeatmapProps) {
  // Collect all unique column keys across all students
  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const s of students) {
      const scores = mode === "standard" ? s.scores_by_standard : s.scores_by_question_type;
      Object.keys(scores).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [students, mode]);

  // Compute class averages per column and overall
  const classAverages = useMemo(() => {
    const avgByColumn: Record<string, number> = {};
    for (const col of columns) {
      const values: number[] = [];
      for (const s of students) {
        const scores = mode === "standard" ? s.scores_by_standard : s.scores_by_question_type;
        if (scores[col] !== undefined && scores[col] !== null) {
          values.push(scores[col]);
        }
      }
      if (values.length > 0) {
        avgByColumn[col] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }
    const overallValues = students.map((s) => s.overall_score);
    const overallAvg = overallValues.length > 0
      ? overallValues.reduce((a, b) => a + b, 0) / overallValues.length
      : 0;
    return { byColumn: avgByColumn, overall: overallAvg };
  }, [students, columns, mode]);

  if (students.length === 0 || columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No data available for this view.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-left font-medium whitespace-nowrap">
                Student
              </th>
              <th className="sticky left-[90px] z-10 bg-muted/30 px-3 py-2.5 text-center font-medium whitespace-nowrap border-r">
                Overall
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-2.5 text-center font-medium text-xs whitespace-nowrap"
                  title={col}
                >
                  {mode === "standard" ? col.replace("CCSS.Math.Content.", "") : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => {
              const scores = mode === "standard" ? student.scores_by_standard : student.scores_by_question_type;
              return (
                <tr key={student.label} className="border-b hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 font-medium whitespace-nowrap text-xs">
                    {student.label}
                  </td>
                  <td
                    className={`sticky left-[90px] z-10 bg-background px-3 py-2 text-center text-xs font-semibold border-r ${getCellColor(student.overall_score)}`}
                  >
                    {Math.round(student.overall_score)}%
                  </td>
                  {columns.map((col) => {
                    const value = scores[col];
                    return (
                      <td
                        key={col}
                        className={`px-2 py-2 text-center text-xs font-medium cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 hover:ring-inset ${getCellColor(value)}`}
                        onClick={() => onCellClick(idx, student.label, col)}
                        title={`${student.label} — ${col}: ${value !== undefined ? `${Math.round(value)}%` : "N/A"}`}
                      >
                        {value !== undefined ? `${Math.round(value)}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20 bg-muted/40">
              <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 font-bold whitespace-nowrap text-xs">
                Class Average
              </td>
              <td
                className={`sticky left-[90px] z-10 bg-muted/40 px-3 py-2.5 text-center text-xs font-bold border-r ${getCellColor(classAverages.overall)}`}
              >
                {Math.round(classAverages.overall)}%
              </td>
              {columns.map((col) => {
                const avg = classAverages.byColumn[col];
                return (
                  <td
                    key={col}
                    className={`px-2 py-2.5 text-center text-xs font-bold ${getCellColor(avg)}`}
                    title={`Class Average — ${col}: ${avg !== undefined ? `${Math.round(avg)}%` : "N/A"}`}
                  >
                    {avg !== undefined ? `${Math.round(avg)}%` : "—"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span>Proficient (80-100%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-amber-400" />
          <span>Partial (60-79%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-400" />
          <span>Not Proficient (0-59%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-gray-300 dark:bg-gray-700" />
          <span>No Data</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Click any cell to see question-level detail
      </p>
    </div>
  );
}
