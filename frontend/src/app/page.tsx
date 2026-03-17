"use client";

import Link from "next/link";
import { GraduationCap, BarChart3, Shield, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/ThemeToggle";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">SPIP</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Student Performance
            <br />
            <span className="text-primary">Insights Platform</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Turn assessment data into actionable instructional insights.
            AI-powered analytics built for educators, with student privacy at the core.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign in to your school
              </Button>
            </Link>
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-20 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8 text-primary" />}
            title="Standards Analytics"
            description="Visualize proficiency by standard, identify gaps, and track progress over time."
          />
          <FeatureCard
            icon={<Bot className="h-8 w-8 text-primary" />}
            title="AI Assistant"
            description="Ask questions in plain English. Get grouping suggestions, lesson plans, and chart insights."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Privacy First"
            description="AES-256 encryption at rest, pseudonymized AI queries, and role-based access control."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SPIP · Student Performance Insights Platform
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-left">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
