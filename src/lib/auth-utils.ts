import { auth } from '@clerk/nextjs/server';

export interface UserContext {
  userId: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
}

export async function getUserContext(): Promise<UserContext> {
  const { userId } = await auth();
  
  return {
    userId,
    isAuthenticated: !!userId,
    isGuest: !userId,
  };
}
