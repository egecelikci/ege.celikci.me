export const handler = async () => {
  const { BUILD_HOOK_URL } = process.env;

  if (!BUILD_HOOK_URL) {
    const errorMessage =
      "Build hook URL is not defined. Please set BUILD_HOOK_URL environment variable.";
    console.error(errorMessage);
    return {
      statusCode: 500,
      body: errorMessage,
    };
  }

  try {
    const response = await fetch(BUILD_HOOK_URL, { method: "POST" });
    if (!response.ok) {
      throw new Error(
        `Build hook failed with status: ${response.status} ${response.statusText}`,
      );
    }
    console.log("Successfully triggered daily build for ege.celikci.me.");
    return { statusCode: 200, body: "Build triggered." };
  } catch (error) {
    console.error("Error triggering build hook:", error);
    return { statusCode: 500, body: error.message };
  }
};
