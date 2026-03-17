"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { assessmentApi } from "@/lib/api";
import { FileUploader, UploadResult } from "@/components/app/FileUploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type MetaStatus = "idle" | "attached" | "success" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaStatus>("idle");

  const onMetaDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setMetadataFile(acceptedFiles[0]);
      setMetaStatus("attached");
    }
  }, []);

  const {
    getRootProps: metaRootProps,
    getInputProps: metaInputProps,
    isDragActive: metaDragActive,
  } = useDropzone({
    onDrop: onMetaDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  const handleUploadAssessment = async (file: File) => {
    if (metadataFile) setMetaStatus("attached");
    const result = await assessmentApi.upload(file, {}, metadataFile ?? undefined);
    if (metadataFile) setMetaStatus("success");
    return result;
  };

  const handleViewResults = (result: UploadResult) => {
    if (result.assessment_id) {
      router.push(`/dashboard/standards?assessment_id=${result.assessment_id}`);
    } else {
      router.push("/dashboard/standards");
    }
  };

  const handleClearMeta = () => {
    setMetadataFile(null);
    setMetaStatus("idle");
  };

  const handleUploadLiteracy = async (file: File) => {
    await assessmentApi.upload(file, { type: "literacy" });
  };

  const handleUploadMetadata = async (file: File) => {
    await assessmentApi.upload(file, { type: "metadata" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Import assessment CSV files from Reveal Math or other sources.
        </p>
      </div>

      <Tabs defaultValue="assessment">
        <TabsList>
          <TabsTrigger value="assessment">
            <Upload className="mr-2 h-4 w-4" /> Assessment
          </TabsTrigger>
          <TabsTrigger value="literacy">Literacy Scores</TabsTrigger>
          <TabsTrigger value="metadata">Student Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="mt-4 space-y-4">
          <FileUploader
            title="Math Assessment CSV (required)"
            description="Upload a Reveal Math unit assessment CSV. Columns should include student identifiers and question scores (e.g. Q1 (1 point), Q2 (2 points))."
            onUpload={handleUploadAssessment}
            onViewResults={handleViewResults}
            className="max-w-xl"
          />

          {/* Optional metadata file */}
          <div className="max-w-xl rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-1">
              Question Metadata CSV{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Attach a Reveal Math metadata CSV with columns: Question, Type, Points, Standard(s), DOK.
              It will be sent together when you click &quot;Upload&quot; on the assessment CSV above.
            </p>

            {metadataFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{metadataFile.name}</span>
                  {metaStatus === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : metaStatus === "error" ? (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  ) : (
                    <button
                      onClick={handleClearMeta}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {metaStatus === "success" && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Metadata uploaded with assessment
                    </p>
                    <button
                      onClick={handleClearMeta}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {metaStatus === "attached" && (
                  <p className="text-xs text-muted-foreground">
                    Ready — will be sent when you upload the assessment CSV above.
                  </p>
                )}
              </div>
            ) : (
              <div
                {...metaRootProps()}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors text-sm",
                  metaDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...metaInputProps()} />
                <Upload className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {metaDragActive ? "Drop metadata CSV here" : "Drag & drop metadata CSV or click to browse"}
                </span>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="literacy" className="mt-4">
          <FileUploader
            title="Literacy Scores CSV"
            description="Upload literacy screening data (e.g. mCLASS, DIBELS). Must include student_xid and a proficiency/score column."
            onUpload={handleUploadLiteracy}
            className="max-w-xl"
          />
        </TabsContent>

        <TabsContent value="metadata" className="mt-4">
          <FileUploader
            title="Student Metadata CSV"
            description="Upload demographic or IEP/504 metadata. Must include student_xid. Sensitive fields will be encrypted at rest."
            onUpload={handleUploadMetadata}
            className="max-w-xl"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
