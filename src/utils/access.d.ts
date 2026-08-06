import { type PayloadRequest } from "payload";
import type { SpecAccess } from "../types";
export declare const specAccessResponse: (
  req: PayloadRequest,
  access?: SpecAccess,
) => Promise<Response | undefined>;
