"use client";

import { redirect } from "next/navigation";
import type React from "react";
import { useAuth } from "@/hooks/useAuth";

interface ShowIfAuthenticatedProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  loadingComponent?: React.ReactNode;
}

/**
 * Higher order component that only renders children if the user is authenticated
 *
 * @param props.children - Content to show when authenticated
 * @param props.fallback - Optional content to show when not authenticated
 * @param props.redirectTo - Optional URL to redirect to if not authenticated
 * @param props.loadingComponent - Optional component to show while checking authentication status
 */
export default function ShowIfAuthenticated({
  children,
  fallback = null,
  redirectTo,
  loadingComponent = <div className="hidden">Loading...</div>,
}: ShowIfAuthenticatedProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // While checking authentication status, show loading component
  if (isLoading) {
    return <>{loadingComponent}</>;
  }

  // If authenticated, show the children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // If redirectTo is provided, redirect to that path
  if (redirectTo) {
    redirect(redirectTo);
  }

  // If not authenticated and no redirect, show the fallback
  return <>{fallback}</>;
}

/**
 * HOC factory to create a component that requires authentication
 *
 * @param Component - The component to wrap
 * @param options - Configuration options
 * @returns A component that only renders if authenticated
 */
export function withAuthentication<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    fallback?: React.ReactNode;
    redirectTo?: string;
    loadingComponent?: React.ReactNode;
  } = {},
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ShowIfAuthenticated
        fallback={options.fallback}
        loadingComponent={options.loadingComponent}
        redirectTo={options.redirectTo}
      >
        <Component {...props} />
      </ShowIfAuthenticated>
    );
  };
}
