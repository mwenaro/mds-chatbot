"use client"
import { ClerkProvider } from '@clerk/nextjs';
export  function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  )
}
