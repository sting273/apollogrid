// Retrying uses the same assessment ID, so the API upserts rather than duplicates.
export async function saveAssessment(body: Record<string, unknown>, request = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request("/api/assessments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), keepalive: true, signal: AbortSignal.timeout(10000),
      });
      if (response.ok) return await response.json() as { id: string };
      if (response.status >= 400 && response.status < 500) {
        throw new InvalidAssessmentError("Unable to save assessment. Please check the inputs.");
      }
      throw new Error("Unable to save assessment. Please retry.");
    } catch (error) {
      if (error instanceof InvalidAssessmentError || attempt === 2) throw error;
    }
  }
  throw new Error("Unable to save assessment.");
}

class InvalidAssessmentError extends Error {}
