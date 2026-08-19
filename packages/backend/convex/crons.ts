import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Batches keep the anonymous-data erasure transaction bounded as draft volume grows.
crons.interval("erase expired anonymous report drafts", { hours: 1 }, internal.reporting!.eraseExpiredAnonymousDrafts!, {});

export default crons;
