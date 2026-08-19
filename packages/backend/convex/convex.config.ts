import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({ env: { EFFI_GATEWAY_CONVEX_SECRET: v.string() } });
