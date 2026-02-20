import { getPendingJobsByUrl, getJobById, cleanupOldJobs } from "@/lib/db";

let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60_000; // Only run cleanup once per minute

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const jobId = searchParams.get("jobId");

  try {
    // Cleanup stale jobs at most once per minute
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      lastCleanup = now;
      cleanupOldJobs().catch(() => {});
    }

    if (jobId) {
      const job = await getJobById(Number(jobId));
      return Response.json({ job });
    }

    if (url) {
      const jobs = await getPendingJobsByUrl(url);
      return Response.json({ jobs });
    }

    return Response.json({ error: "Provide url or jobId" }, { status: 400 });
  } catch (error) {
    console.error("Generation jobs error:", error);
    return Response.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
