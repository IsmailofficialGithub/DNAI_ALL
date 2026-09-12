/**
 * Sanitize error message to prevent leaking secrets/technical details from external APIs.
 * This is compliant with SEC-02 and API-01 (Consistent Error Schema/Sanitization).
 */
export const sanitizeError = (error, defaultMessage) => {
    let statusCode = error.status || error.statusCode || 500;
    let message = defaultMessage || "An unexpected error occurred.";

    const errorMsg = error.message || "";
    const errorCode = error.code || error.error?.code || "";
    const errorType = error.type || error.error?.type || "";
    const normalizedError = `${errorMsg} ${errorCode} ${errorType}`.toLowerCase();

    const friendlyAiUnavailableMessage = "Our AI assistant is currently unavailable. Please try again later or contact support if you need help.";

    if (
        statusCode === 429 ||
        statusCode === 402 ||
        normalizedError.includes("insufficient_quota") ||
        normalizedError.includes("quota") ||
        normalizedError.includes("billing") ||
        normalizedError.includes("credit") ||
        normalizedError.includes("rate limit") ||
        normalizedError.includes("too many requests")
    ) {
        return { statusCode: statusCode === 500 ? 503 : statusCode, message: friendlyAiUnavailableMessage };
    }

    // Check if it's an OpenAI error or similar with key info or technical details
    if (errorMsg.includes("sk-proj-") || errorMsg.includes("API key") || errorMsg.includes("OpenAI") || errorMsg.includes("Unauthorized")) {
        if (statusCode === 401) {
            message = friendlyAiUnavailableMessage;
        } else if (statusCode === 403) {
            message = friendlyAiUnavailableMessage;
        } else if (statusCode === 429) {
            message = friendlyAiUnavailableMessage;
        } else if (statusCode === 400 && errorMsg.includes("model")) {
            message = "Invalid model requested for AI service.";
        } else {
            message = friendlyAiUnavailableMessage;
        }
    } else {
        // Fallback to original message if it's safe (doesn't contain secrets)
        message = errorMsg || message;
    }

    return { statusCode, message };
};
