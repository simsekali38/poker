import type { NextFunction, Request, Response } from 'express';
export interface AuthedRequest extends Request {
    firebaseUid: string;
}
export declare function requireFirebaseAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
