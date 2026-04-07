export type JoinFlowErrorCode = 'not_found' | 'closed';

export interface JoinFlowError {
  readonly kind: 'join';
  readonly code: JoinFlowErrorCode;
}

export function joinFlowError(code: JoinFlowErrorCode): JoinFlowError {
  return { kind: 'join', code };
}

export function isJoinFlowError(value: unknown): value is JoinFlowError {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as JoinFlowError).kind === 'join' &&
    ((value as JoinFlowError).code === 'not_found' || (value as JoinFlowError).code === 'closed')
  );
}
