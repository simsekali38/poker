export type UserId = string;

export interface UserIdentity {
  uid: UserId;
  displayName?: string;
  provider: 'anonymous' | 'password' | 'google' | 'local';
  email?: string;
  photoUrl?: string;
}
