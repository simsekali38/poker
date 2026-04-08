export interface SyncVoteLine {
    memberId: string;
    displayName: string;
    card: string;
}
export interface SyncParticipantLine {
    memberId: string;
    displayName: string;
}
export interface SyncEstimateInput {
    sessionId: string;
    storyId: string;
    storyTitle: string;
    jiraIssueKey: string;
    jiraSiteUrl: string;
    jiraBoardId?: string | null;
    estimate: string;
    method: string;
    includeComment?: boolean;
    votes: SyncVoteLine[];
    participants: SyncParticipantLine[];
}
export declare function syncEstimateToJira(firebaseUid: string, input: SyncEstimateInput): Promise<{
    firestoreUpdated: boolean;
}>;
