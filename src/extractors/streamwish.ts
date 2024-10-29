import axios from "axios";
import { detect, unpack } from "../utils/unpacker";

interface DecData {
  m3u8?: string;
  slides?: string;
}

/**
 * Extracts the slides URL from the unpacked script content.
 * @param scriptContent The unpacked JavaScript code as a string.
 * @returns The full slides URL or null if not found.
 */
function extractSlidesUrl(scriptContent: string): string | null {
  const regex = /file\s*:\s*"([^"]+\.jpg[^"]*)"/;
  const match = scriptContent.match(regex);
  if (match && match[1]) {
    // Construct the full URL
    const relativePath = match[1];
    // Assuming the base URL is 'https://awish.pro', adjust if different
    return `https://awish.pro${relativePath}`;
  }
  return null;
}

/**
 * Extracts and processes URLs from the awish.pro embed page.
 * @param embedLink - The embed page URL.
 * @returns The cleaned decrypted data or null if not found.
 */
export const streamwish = async (
  embedLink: string,
): Promise<DecData | null> => {
  try {
    const fetchStart = Date.now();
    // Fetch the embed page
    const response = await axios.get(embedLink, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });
    const fetchEnd = Date.now();
    // console.log(`Fetching embed page took ${fetchEnd - fetchStart} ms`);

    const html = response.data;

    // Regular expression to extract all <script>...</script> contents
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptContent: string | null = null;

    const scriptStart = Date.now();
    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html)) !== null) {
      const script = match[1];
      if (script && script.includes("m3u8")) {
        scriptContent = script;
        break; // Exit the loop once the desired script is found
      }
    }
    const scriptEnd = Date.now();
    // console.log(`Extracting script took ${scriptEnd - scriptStart} ms`);

    if (!scriptContent) {
      console.warn("No script containing m3u8 found.");
      return null;
    }

    // Check if the script is packed using P.A.C.K.E.R.
    const packerStart = Date.now();
    if (detect(scriptContent)) {
      try {
        const unpacked = unpack(scriptContent);
        scriptContent = unpacked;
      } catch (error) {
        console.warn("Unpacking failed or resulted in null.");
        return null;
      }
    }
    const packerEnd = Date.now();
    // console.log(`Packer processing took ${packerEnd - packerStart} ms`);

    // Extract the master URL using improved regex
    const extractStart = Date.now();
    let masterUrlMatch =
      scriptContent.match(/file\s*:\s*"([^"]+\.m3u8[^"]*)"/) ||
      scriptContent.match(/src\s*:\s*"([^"]+\.m3u8[^"]*)"/);
    const masterUrl = masterUrlMatch ? masterUrlMatch[1] : null;

    let slidesUrl: string | null = null;

    if (!masterUrl) {
      // Alternative extraction method
      masterUrlMatch = scriptContent.match(
        /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/,
      );
      if (masterUrlMatch) {
        slidesUrl = extractSlidesUrl(scriptContent);
      } else {
        console.warn("Master URL not found in script.");
        return null;
      }
    } else {
      // Extract the slides URL
      slidesUrl = extractSlidesUrl(scriptContent);
    }
    const extractEnd = Date.now();
    // console.log(`URL extraction took ${extractEnd - extractStart} ms`);

    // Structure the result to match DecData
    const result: DecData = {};

    if (masterUrl) {
      result.m3u8 = masterUrl;
    }

    if (slidesUrl) {
      result.slides = slidesUrl;
    }

    return result;
  } catch (error) {
    console.error("Error fetching URL:", error);
    return null;
  }
};

// Example usage
// (async () => {
//   const embedLink = "https://awish.pro/e/62t32zipr5o6";
//   const totalStart = Date.now();
//   const result = await streamwish(embedLink);
//   const totalEnd = Date.now();
//   console.log(`Total processing time: ${totalEnd - totalStart} ms`);

//   if (!result) {
//     console.log("No Master URL or Slides URL found.");
//   } else {
//     if (result.m3u8) {
//       console.log("Master URL Found:", result.m3u8);
//     } else {
//       console.log("Master URL not found.");
//     }

//     if (result.slides) {
//       console.log("Slides URL Found:", result.slides);
//     } else {
//       console.log("Slides URL not found.");
//     }
//   }
// })();
