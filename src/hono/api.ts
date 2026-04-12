import adminEndpoint from "@/hono/api/admin";
import appEndpoint from "@/hono/api/app";
import healthEndpoint from "@/hono/api/health";
import imagesEndpoint from "@/hono/api/images";
import postsEndpoint from "@/hono/api/posts";
import setupEndpoint from "@/hono/api/setup";
import { createHono } from "./factory";

export const apiHono = createHono().basePath("/api");

apiHono.route("/health", healthEndpoint);
apiHono.route("/setup", setupEndpoint);
apiHono.route("/app", appEndpoint);
apiHono.route("/app/images", imagesEndpoint);
apiHono.route("/app/posts", postsEndpoint);
apiHono.route("/admin", adminEndpoint);
