import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";

export async function submitFeedback(message: string): Promise<void> {
  const response = await fetch(getApiUrl("/api/feedback"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Failed to submit feedback");
  }
}
