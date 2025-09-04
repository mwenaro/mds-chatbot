"use client";

import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ClientErrorBoundaryProps {
  children: React.ReactNode;
}

export function ClientErrorBoundary({ children }: ClientErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.error('App-level error:', error);
          console.error('Error info:', errorInfo);
        }
        // In production, you might want to send to an error reporting service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
