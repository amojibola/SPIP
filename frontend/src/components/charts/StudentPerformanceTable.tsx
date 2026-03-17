"use client";

import { useState, useMemo, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import type { StudentPerformanceEntry } from "@/lib/api";

type SortField = "label" | "overall_score" | "filtered_score";
type SortDir = "asc" | "desc";

interface Props {
  students: StudentPerformanceEntry[];
  availableStandards: string[];
  availableQuestionTypes: string[];
  activeStandard?: string;
  activeQuestionType?: string;
  onFilterChange: (standard?: string, questionType?: string) => void;
}

function getProficiencyColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-yellow-600";
  return "text-red-600";
}

function getProficiencyBg(pct: number) {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 60) return "bg-yellow-400";
  return "bg-red-400";
}

function getProficiencyLabel(pct: number) {
  if (pct >= 80) return "Proficient";
  if (pct >= 60) return "Partially Proficient";
  return "Not Proficient";
}

function getProficiencyBadgeClass(pct: number) {
  if (pct >= 80) return "bg-green-100 text-green-800 border-green-200";
  if (pct >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export default function StudentPerformanceTable({
  students,
  availableStandards,
  availableQuestionTypes,
  activeStandard,
  activeQuestionType,
  onFilterChange,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "label" ? "asc" : "desc");
    }
  };

  // Compute filtered_score client-side when filters change
  const enrichedStudents = useMemo(() => {
    return students.map((s) => {
      let filtered: number | null = s.filtered_score;
      if (activeStandard) {
        filtered = s.scores_by_standard[activeStandard] ?? null;
      } else if (activeQuestionType) {
        filtered = s.scores_by_question_type[activeQuestionType] ?? null;
      }
      return { ...s, filtered_score: filtered };
    });
  }, [students, activeStandard, activeQuestionType]);

  const sortedStudents = useMemo(() => {
    const sorted = [...enrichedStudents];
    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      if (sortField === "label") {
        aVal = a.label;
        bVal = b.label;
      } else if (sortField === "filtered_score") {
        aVal = a.filtered_score ?? -1;
        bVal = b.filtered_score ?? -1;
      } else {
        aVal = a.overall_score;
        bVal = b.overall_score;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [enrichedStudents, sortField, sortDir]);

  const hasFilter = !!(activeStandard || activeQuestionType);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">&uarr;&darr;</span>;
    return <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Standard:</label>
          <select
            className="text-sm border rounded-md px-2 py-1.5 bg-background"
            value={activeStandard || ""}
            onChange={(e) => onFilterChange(e.target.value || undefined, undefined)}
          >
            <option value="">All Standards</option>
            {availableStandards.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Question Type:</label>
          <select
            className="text-sm border rounded-md px-2 py-1.5 bg-background"
            value={activeQuestionType || ""}
            onChange={(e) => onFilterChange(undefined, e.target.value || undefined)}
          >
            <option value="">All Types</option>
            {availableQuestionTypes.map((qt) => (
              <option key={qt} value={qt}>{qt}</option>
            ))}
          </select>
        </div>
        {hasFilter && (
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() => onFilterChange(undefined, undefined)}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th
                className="py-2 pr-4 font-medium cursor-pointer select-none"
                onClick={() => handleSort("label")}
              >
                Student <SortIcon field="label" />
              </th>
              <th
                className="py-2 pr-4 font-medium cursor-pointer select-none"
                onClick={() => handleSort("overall_score")}
              >
                Overall Score <SortIcon field="overall_score" />
              </th>
              {hasFilter && (
                <th
                  className="py-2 pr-4 font-medium cursor-pointer select-none"
                  onClick={() => handleSort("filtered_score")}
                >
                  {activeStandard ? `${activeStandard}` : activeQuestionType} Score{" "}
                  <SortIcon field="filtered_score" />
                </th>
              )}
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((s) => {
              const isExpanded = expandedStudent === s.label;
              return (
                <Fragment key={s.label}>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="py-2.5 pr-4 font-medium">{s.label}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`font-semibold ${getProficiencyColor(s.overall_score)}`}>
                        {s.overall_score}%
                      </span>
                    </td>
                    {hasFilter && (
                      <td className="py-2.5 pr-4">
                        {s.filtered_score !== null ? (
                          <span className={`font-semibold ${getProficiencyColor(s.filtered_score)}`}>
                            {s.filtered_score}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className={`text-xs ${getProficiencyBadgeClass(s.overall_score)}`}>
                        {getProficiencyLabel(s.overall_score)}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setExpandedStudent(isExpanded ? null : s.label)}
                      >
                        {isExpanded ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/20">
                      <td colSpan={hasFilter ? 5 : 4} className="py-3 px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* By Standard */}
                          <div>
                            <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                              By Standard
                            </h5>
                            <div className="space-y-1.5">
                              {Object.entries(s.scores_by_standard)
                                .sort(([, a], [, b]) => a - b)
                                .map(([std, score]) => (
                                  <div key={std} className="flex items-center gap-2">
                                    <span className="text-xs w-28 truncate" title={std}>{std}</span>
                                    <div className="flex-1 h-2 rounded-full bg-muted">
                                      <div
                                        className={`h-2 rounded-full ${getProficiencyBg(score)} transition-all`}
                                        style={{ width: `${Math.min(score, 100)}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-medium w-10 text-right ${getProficiencyColor(score)}`}>
                                      {score}%
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                          {/* By Question Type */}
                          <div>
                            <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                              By Question Type
                            </h5>
                            <div className="space-y-1.5">
                              {Object.entries(s.scores_by_question_type)
                                .sort(([, a], [, b]) => a - b)
                                .map(([qt, score]) => (
                                  <div key={qt} className="flex items-center gap-2">
                                    <span className="text-xs w-28 truncate" title={qt}>{qt}</span>
                                    <div className="flex-1 h-2 rounded-full bg-muted">
                                      <div
                                        className={`h-2 rounded-full ${getProficiencyBg(score)} transition-all`}
                                        style={{ width: `${Math.min(score, 100)}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-medium w-10 text-right ${getProficiencyColor(score)}`}>
                                      {score}%
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 justify-center pt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Proficient (80–100%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded-sm inline-block" /> Partially Proficient (60–79%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" /> Not Proficient (0–59%)</span>
      </div>
    </div>
  );
}

