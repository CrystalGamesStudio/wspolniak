import healthEndpoint from "@/hono/api/health";
import setupEndpoint from "@/hono/api/setup";
import { createHono } from "./factory";

export const apiHono = createHono().basePath("/api");

apiHono.route("/health", healthEndpoint);
apiHono.route("/setup", setupEndpoint);
