/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bootcamps from "../bootcamps.js";
import type * as certificates from "../certificates.js";
import type * as dashboard from "../dashboard.js";
import type * as db from "../db.js";
import type * as exams from "../exams.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as legacyAuth from "../legacyAuth.js";
import type * as lessons from "../lessons.js";
import type * as masterclass from "../masterclass.js";
import type * as modules from "../modules.js";
import type * as presence from "../presence.js";
import type * as seed from "../seed.js";
import type * as students from "../students.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bootcamps: typeof bootcamps;
  certificates: typeof certificates;
  dashboard: typeof dashboard;
  db: typeof db;
  exams: typeof exams;
  http: typeof http;
  invitations: typeof invitations;
  legacyAuth: typeof legacyAuth;
  lessons: typeof lessons;
  masterclass: typeof masterclass;
  modules: typeof modules;
  presence: typeof presence;
  seed: typeof seed;
  students: typeof students;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
