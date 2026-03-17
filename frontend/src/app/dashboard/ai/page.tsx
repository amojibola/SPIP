"use client";

import AIChatPanel from "@/components/ai/AIChatPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AIPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions about your students&apos; performance data. Student identities are pseudonymized before AI analysis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-16rem)]">
            <CardContent className="h-full p-0">
              <AIChatPanel assessmentId={null} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">1. Data anonymization:</strong> Student names and identifiers
                are replaced with pseudonyms before being sent to the AI model.
              </p>
              <p>
                <strong className="text-foreground">2. Context assembly:</strong> Relevant proficiency data
                is compiled from your uploaded assessments.
              </p>
              <p>
                <strong className="text-foreground">3. AI analysis:</strong> The model analyzes patterns
                and provides actionable instructional recommendations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Example questions</CardTitle>
              <CardDescription>Try asking about:</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Which standards need the most attention?</li>
                <li>• How should I group students for intervention?</li>
                <li>• What&apos;s driving the story problem gap?</li>
                <li>• Create a chart of proficiency by standard</li>
                <li>• Suggest a small-group lesson plan for Tier 3</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
