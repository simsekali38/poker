export interface OAuthStartState {
    firebaseUid: string;
    returnUrl: string;
    createdAtMs: number;
}
export declare function createOAuthState(data: Omit<OAuthStartState, 'createdAtMs'>): string;
export declare function consumeOAuthState(id: string): OAuthStartState | null;
