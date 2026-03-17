"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/providers";
import { PermissionGate } from "@/components/app/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import { Shield, Users, Plus, Copy, Check } from "lucide-react";

interface SchoolInfo {
  id: number;
  name: string;
  join_code: string;
  district: string;
  state: string;
}

interface UserInfo {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export default function AdminPage() {
  return (
    <PermissionGate
      roles={["school_admin", "super_admin"]}
      fallback={
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="You need admin privileges to view this page."
        />
      }
    >
      <AdminContent />
    </PermissionGate>
  );
}

function AdminContent() {
  const { user } = useAuth();
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [schoolData, usersData] = await Promise.all([
          apiFetch<SchoolInfo>("/admin/school"),
          apiFetch<UserInfo[]>("/admin/users"),
        ]);
        setSchool(schoolData);
        setUsers(usersData);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const copyJoinCode = async () => {
    if (school?.join_code) {
      await navigator.clipboard.writeText(school.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">Manage school settings and users.</p>
      </div>

      {/* School Info */}
      {school && (
        <Card>
          <CardHeader>
            <CardTitle>School Information</CardTitle>
            <CardDescription>{school.district}, {school.state}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground">School Name</Label>
                <p className="font-medium">{school.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Join Code</Label>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                    {school.join_code}
                  </code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyJoinCode}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>{users.length} members in your school</CardDescription>
          </div>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Invite
          </Button>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Share the join code to invite teachers."
            />
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.is_active ? "secondary" : "destructive"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{u.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
