import axios from "axios";

interface DecData {
  mp4?: string;
  slides?: string;
}

/**
 * Generate a random alphanumeric string of specified length.
 * @param {number} length - The length of the random string.
 * @returns {string} - Randomly generated alphanumeric string.
 */
function randoShit(length: number): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length)),
  ).join("");
}

/**
 * Fetches Doodstream video data including the pass key, video URL, and thumbnail URL.
 * @param {string} doodUrl - The Doodstream URL to scrape data from.
 * @returns {Promise<DecData | null>} - An object containing the scraped video information or null if failed.
 */
export async function doodstream(doodUrl: string): Promise<DecData | null> {
  // Required headers to prevent being blocked (403). Any User-Agent works.
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Referer: doodUrl,
  };

  try {
    // Fetch page content
    const { data: html } = await axios.get(doodUrl, { headers });

    // Combine all <script> tag contents into a single string using regex
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptContent = "";
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
      if (match[1]) {
        scriptContent += match[1] + "\n";
      }
    }

    // Regex patterns for extracting data
    const passKeyPattern = /\/pass_md5\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9]+/;
    // const tokenPattern = /return a \+ "(\?token=[^"]+&expiry=)"/;
    const thumbnailPattern = /thumbnails:\s*\{\s*vtt:\s*'([^']+)/;

    // Extract pass key, token, and thumbnail URL
    const passKeyMatch = scriptContent.match(passKeyPattern);
    // const tokenBaseMatch = scriptContent.match(tokenPattern);
    const thumbnailMatch = scriptContent.match(thumbnailPattern);

    if (!passKeyMatch) {
      console.error("Error: Unable to extract pass key.");
      return null;
    }

    const passKey = passKeyMatch[0];
    // const tokenBase = tokenBaseMatch ? tokenBaseMatch[1] : "";
    const tokenBase = "?token=token&expiry=";
    const thumbnailUrl = thumbnailMatch
      ? thumbnailMatch[1]
      : "Thumbnail not found";

    // Optional: Uncomment for debugging
    // console.log("Pass Key Extracted:", passKey);
    // console.log("Thumbnail URL Extracted:", thumbnailUrl);

    // Fetch the pass key URL to retrieve the video URL base
    const passKeyResponse = await axios.get(`https://dood.wf${passKey}`, {
      headers,
    });

    // Generate final MP4 URL
    const randomSuffix = randoShit(10);
    const finalVideoUrl = `${
      passKeyResponse.data
    }${randomSuffix}${tokenBase}${Date.now()}`;

    // Optional: Uncomment for debugging
    // console.log("Final Video URL:", finalVideoUrl);

    return {
      mp4: finalVideoUrl,
      slides: `https:${thumbnailUrl}`,
    };
  } catch (error) {
    console.error("Error fetching or parsing Doodstream data:", error);
    return null;
  }
}

// Example usage
// (async () => {
//   const result = await doodstream("https://dood.wf/e/uc28xb0bvj3p");
//   console.log(result);
// })();
