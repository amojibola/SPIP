"use client";

import { useAuth } from "@/lib/providers";
import type { ReactNode } from "react";

interface PermissionGateProps {
  children: ReactNode;
  roles: string[];
  fallback?: ReactNode;
}

export function PermissionGate({ children, roles, fallback = null }: PermissionGateProps) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
