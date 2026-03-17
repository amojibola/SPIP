/**
 * API client with automatic JWT injection and refresh token rotation.
 * All requests are scoped to the authenticated user's tenant automatically.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send refresh_token cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    setAccessToken(data.access_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });

  // If 401, attempt token refresh once
  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers,
        credentials: "include",
      });
    } else {
      // Refresh failed - redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ── Analytics API ────────────────────────────────────────────────────────────
export const analyticsApi = {
  proficiencyByStandard: (assessmentId?: string) => {
    const qs = assessmentId ? `?assessment_id=${assessmentId}` : "";
    return apiFetch<Record<string, unknown>[]>(`/analytics/proficiency_by_standard${qs}`);
  },

  studentHeatmap: (assessmentId?: string) => {
    const qs = assessmentId ? `?assessment_id=${assessmentId}` : "";
    return apiFetch<Record<string, unknown>[]>(`/analytics/student_heatmap${qs}`);
  },

  storyProblemAnalysis: (assessmentId?: string) => {
    const qs = assessmentId ? `?assessment_id=${assessmentId}` : "";
    return apiFetch<Record<string, unknown>>(`/analytics/story_problem_analysis${qs}`);
  },

  progressOverTime: (classroomId?: string) => {
    const qs = classroomId ? `?classroom_id=${classroomId}` : "";
    return apiFetch<Record<string, unknown>[]>(`/analytics/progress_over_time${qs}`);
  },

  interventionGroups: (assessmentId?: string) => {
    const qs = assessmentId ? `?assessment_id=${assessmentId}` : "";
    return apiFetch<{ tier1: number; tier2: number; tier3: number }>(`/analytics/intervention_groups${qs}`);
  },

  proficiencyByQuestionType: (assessmentId?: string) => {
    const qs = assessmentId ? `?assessment_id=${assessmentId}` : "";
    return apiFetch<Record<string, unknown>[]>(`/analytics/proficiency_by_question_type${qs}`);
  },

  standardBreakdown: (standard: string, assessmentId?: string) => {
    const params = new URLSearchParams({ standard });
    if (assessmentId) params.set("assessment_id", assessmentId);
    return apiFetch<Record<string, unknown>>(`/analytics/standard_breakdown?${params.toString()}`);
  },

  studentPerformance: (assessmentId?: string, standard?: string, questionType?: string) => {
    const params = new URLSearchParams();
    if (assessmentId) params.set("assessment_id", assessmentId);
    if (standard) params.set("standard", standard);
    if (questionType) params.set("question_type", questionType);
    const qs = params.toString();
    return apiFetch<StudentPerformanceResponse>(`/analytics/student_performance${qs ? `?${qs}` : ""}`);
  },
};

// ── Assessment API ────────────────────────────────────────────────────────────
export const assessmentApi = {
  list: () => apiFetch<Assessment[]>("/assessments"),

  upload: async (file: File, meta: Record<string, string> = {}, metadataFile?: File) => {
    const formData = new FormData();
    formData.append("file", file);
    if (metadataFile) {
      formData.append("metadata_file", metadataFile);
    }
    Object.entries(meta).forEach(([k, v]) => formData.append(k, v));

    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const res = await fetch(`${API_BASE}/assessments/upload/quick`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      // Handle Pydantic validation errors (detail is an array of objects)
      const detail = err.detail;
      if (Array.isArray(detail)) {
        const msg = detail.map((e: { msg?: string }) => e.msg || "Validation error").join("; ");
        throw new Error(msg);
      }
      throw new Error(typeof detail === "string" ? detail : "Upload failed");
    }
    return res.json();
  },
};

// ── AI API ────────────────────────────────────────────────────────────────────
export const aiApi = {
  chat: (question: string, assessmentId: string, conversationHistory: Message[]) =>
    apiFetch<AIResponse>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ question, assessment_id: assessmentId, conversation_history: conversationHistory }),
    }),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ChartResponse {
  data: unknown[];
  chart_type: string;
  suppressed?: boolean;
}

export interface Assessment {
  id: string;
  name: string;
  assessment_type: "math" | "literacy";
  unit?: string;
  week_of?: string;
  classroom_id: string;
}

export interface AIResponse {
  response: string | null;
  chart_spec: {
    chart_type: string;
    metric: string;
    group_by: string;
    color_metric: string;
    title?: string;
  } | null;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface StudentPerformanceEntry {
  label: string;
  overall_score: number;
  is_proficient: boolean;
  filtered_score: number | null;
  scores_by_standard: Record<string, number>;
  scores_by_question_type: Record<string, number>;
}

export interface StudentPerformanceResponse {
  students: StudentPerformanceEntry[];
  filters: {
    available_standards: string[];
    available_question_types: string[];
  };
  student_count: number;
  suppressed: boolean;
}
