// Client-side auth utilities
export function generateGuestId(): string {
  // Generate a unique session ID for guest users
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getStorageKey(key: string): string {
  return `mds_chatbot_${key}`;
}

export function setGuestSession(guestId: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(getStorageKey('guest_id'), guestId);
  }
}

export function getGuestSession(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(getStorageKey('guest_id'));
  }
  return null;
}

export function clearGuestSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(getStorageKey('guest_id'));
    // Clear any other guest-related data
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(getStorageKey(''))) {
        sessionStorage.removeItem(key);
      }
    });
  }
}
