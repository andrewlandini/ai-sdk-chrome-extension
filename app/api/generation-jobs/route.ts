import { getPendingJobsByUrl, getJobById, cleanupOldJobs } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const jobId = searchParams.get("jobId");

  try {
    // Cleanup stale jobs on each poll
    await cleanupOldJobs();

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
