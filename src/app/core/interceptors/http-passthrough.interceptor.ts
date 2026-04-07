import { HttpInterceptorFn } from '@angular/common/http';

/** Reserved for future HTTP calls (Cloud Functions, etc.). */
export const httpPassthroughInterceptor: HttpInterceptorFn = (req, next) => next(req);
