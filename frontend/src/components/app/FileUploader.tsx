"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface UploadResult {
  assessment_id?: string;
  name?: string;
  students_processed?: number;
  questions_processed?: number;
  scores_stored?: number;
  warnings?: string[];
  [key: string]: unknown;
}

interface FileUploaderProps {
  title: string;
  description: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  onUpload: (file: File) => Promise<UploadResult | void>;
  onViewResults?: (result: UploadResult) => void;
  className?: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function FileUploader({
  title,
  description,
  accept = { "text/csv": [".csv"] },
  maxSize = 10 * 1024 * 1024, // 10MB
  onUpload,
  onViewResults,
  className,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setStatus("idle");
        setErrorMsg("");
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      if (err?.code === "file-too-large") {
        setErrorMsg(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
      } else if (err?.code === "file-invalid-type") {
        setErrorMsg("Invalid file type. Please upload a CSV file.");
      } else {
        setErrorMsg(err?.message || "File rejected");
      }
    },
  });

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setErrorMsg("");
    setResult(null);
    try {
      const res = await onUpload(file);
      setResult(res || null);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleRemove = () => {
    setFile(null);
    setStatus("idle");
    setErrorMsg("");
    setResult(null);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!file ? (
          <div
            {...getRootProps()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop file here" : "Drag & drop or click to browse"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              CSV files up to {maxSize / 1024 / 1024}MB
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="h-8 w-8 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {status === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : status === "error" ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Button variant="ghost" size="icon" onClick={handleRemove}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            {/* Upload result summary */}
            {status === "success" && result && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                  Upload Successful
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {result.students_processed != null && (
                    <div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">
                        {result.students_processed}
                      </p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  )}
                  {result.questions_processed != null && (
                    <div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">
                        {result.questions_processed}
                      </p>
                      <p className="text-xs text-muted-foreground">Questions</p>
                    </div>
                  )}
                  {result.scores_stored != null && (
                    <div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">
                        {result.scores_stored}
                      </p>
                      <p className="text-xs text-muted-foreground">Scores</p>
                    </div>
                  )}
                </div>
                {result.warnings && result.warnings.length > 0 && (
                  <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                    {result.warnings.map((w, i) => (
                      <p key={i}>⚠ {w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={status === "uploading" || status === "success"}
                className="flex-1"
              >
                {status === "uploading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status === "success" ? "Uploaded!" : status === "uploading" ? "Uploading..." : "Upload"}
              </Button>
              {status === "success" && onViewResults && result && (
                <Button variant="default" onClick={() => onViewResults(result)}>
                  View Results <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {status === "success" && (
                <Button variant="outline" onClick={handleRemove}>
                  Upload Another
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
