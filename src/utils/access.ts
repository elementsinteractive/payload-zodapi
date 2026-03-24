import { Forbidden, type PayloadRequest } from "payload";
import { formatAdminURL } from "payload/shared";

import type { SpecAccess } from "../types";

export const specAccessResponse = async (
  req: PayloadRequest,
  access?: SpecAccess,
) => {
  if ((await access?.({ req })) === false) {
    if (req.user) {
      // User is authenticated but not authorized for this resource
      throw new Forbidden(req.t);
    }

    // Redirect unauthenticated user to login page
    const loginUrl = formatAdminURL({
      adminRoute: req.payload.getAdminURL(),
      basePath: "",
      includeBasePath: true,
      path: "/login",
    });

    // nosemgrep: nodejs_scan.javascript-redirect-rule-express_open_redirect / loginUrl is not user-input, it is generated from config
    return Response.redirect(loginUrl, 302);
  }
};
