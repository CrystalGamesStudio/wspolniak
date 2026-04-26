// SPDX-License-Identifier: AGPL-3.0-or-later
import adminEndpoint from "@/hono/api/admin";
import appEndpoint from "@/hono/api/app";
import commentsEndpoint from "@/hono/api/comments";
import healthEndpoint from "@/hono/api/health";
import imagesEndpoint from "@/hono/api/images";
import postsEndpoint from "@/hono/api/posts";
import pushEndpoint from "@/hono/api/push";
import setupEndpoint from "@/hono/api/setup";
import shareEndpoint from "@/hono/api/share";
import { createHono } from "./factory";

export const apiHono = createHono().basePath("/api");

apiHono.route("/health", healthEndpoint);
apiHono.route("/setup", setupEndpoint);
apiHono.route("/app/images", imagesEndpoint);
apiHono.route("/app/posts", postsEndpoint);
apiHono.route("/app/posts", commentsEndpoint);
apiHono.route("/app/push", pushEndpoint);
apiHono.route("/app", appEndpoint);
apiHono.route("/admin", adminEndpoint);
apiHono.route("/share", shareEndpoint);
