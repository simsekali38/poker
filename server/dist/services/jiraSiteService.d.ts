export interface AccessibleResource {
    id: string;
    url: string;
    name: string;
}
export declare function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]>;
export declare function resolveCloudId(resources: AccessibleResource[], siteUrl: string): string;
export declare function pickDefaultSiteUrl(resources: AccessibleResource[]): string | null;
