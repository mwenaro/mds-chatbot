"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, UserPlus, LogOut } from 'lucide-react';

export default function AuthControls() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-xs">
          <User className="h-3 w-3 mr-1" />
          {user?.firstName || 'User'}
        </Badge>
        <UserButton 
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8"
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs">
        <User className="h-3 w-3 mr-1" />
        Guest Mode
      </Badge>
      <SignInButton>
        <Button variant="outline" size="sm">
          <LogOut className="h-4 w-4 mr-2" />
          Sign In
        </Button>
      </SignInButton>
      <SignUpButton>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Sign Up
        </Button>
      </SignUpButton>
    </div>
  );
}
