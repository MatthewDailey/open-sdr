/**
 * Removes query parameters from a URL
 * @param url The URL to clean
 * @returns URL without query parameters
 */
export function cleanUrlQueryParams(url: string): string {
  if (!url) return url

  try {
    // Parse the URL
    const urlObj = new URL(url)

    // Return the URL without search params (query parameters)
    return `${urlObj.origin}${urlObj.pathname}`
  } catch (error) {
    // If URL parsing fails, return the original URL
    console.warn(`Failed to clean URL: ${url}`, error)
    return url
  }
}
