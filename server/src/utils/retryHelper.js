/**
 * Executes an asynchronous function with exponential backoff retries.
 *
 * @param {Function} fn - async function to execute
 * @param {number} [maxRetries=3] - maximum number of attempts
 * @param {number} [delay=1000] - initial delay in milliseconds
 * @returns {Promise<*>} result of the function
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`[RetryHelper] All ${maxRetries} attempts failed. Last error: ${err.message}`);
        throw err;
      }
      console.warn(`[RetryHelper] Attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // exponential backoff
    }
  }
}
