export interface JiraIssueDto {
    issueKey: string;
    issueId: string;
    summary: string;
    description: string | null;
    status: {
        id: string;
        name: string;
        category?: string;
    };
    assignee: {
        accountId: string;
        displayName: string;
        emailAddress: string | null;
    } | null;
}
export declare function getIssueWithCloudId(firebaseUid: string, issueKey: string, siteUrl: string): Promise<{
    cloudId: string;
    issue: JiraIssueDto;
}>;
export declare function getIssueForUser(firebaseUid: string, issueKey: string, siteUrl: string): Promise<JiraIssueDto>;
export declare function getCloudIdForUser(firebaseUid: string, siteUrl: string): Promise<string>;
/** PUT agile estimation when boardId is known */
export declare function putBoardEstimation(firebaseUid: string, cloudId: string, issueId: string, boardId: string, valueStr: string): Promise<void>;
/** Fallback: story points custom field */
export declare function putStoryPointsField(firebaseUid: string, cloudId: string, issueId: string, points: number): Promise<void>;
export declare function getIssueProperty(firebaseUid: string, cloudId: string, issueId: string, propertyKey: string): Promise<unknown>;
export declare function putIssueProperty(firebaseUid: string, cloudId: string, issueId: string, propertyKey: string, value: unknown): Promise<void>;
export declare function postIssueComment(firebaseUid: string, cloudId: string, issueId: string, plainText: string): Promise<void>;
