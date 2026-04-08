interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}
export declare function saveTokensForUser(firebaseUid: string, accessToken: string, refreshToken: string | null, expiresInSec: number, atlassianAccountId: string | null): Promise<void>;
export declare function getValidAccessToken(firebaseUid: string): Promise<string>;
export declare function exchangeAuthorizationCode(code: string): Promise<TokenResponse>;
export {};
