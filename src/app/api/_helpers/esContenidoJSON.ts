// Helper function to verify if content is actually JSON
export async function isJSONContent(response: Response): Promise<boolean> {
  try {
    // Check Content-Type header
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // If not application/json, we verify the content itself
      const text = await response.clone().text();

      // Try to parse the text to see if it's valid JSON
      JSON.parse(text);
      return true;
    }
    return true;
  } catch (error) {
    console.warn("The received content is not valid JSON:", error);
    return false;
  }
}