import axios, { type AxiosRequestConfig } from "axios";
import * as cheerio from "cheerio";
import {
  type PaheApi,
  type PahePlayInfo,
  PAHE_HEADERS,
  fetchPaheReleaseId,
} from "./pahe";
import { kwik } from "../../extractors/kwik";
import { cache } from "../../index";

/**
 * Fetches and extracts information from the AnimePahe play page.
 * @param provider - The provider name (e.g., 'animepahe').
 * @param id - The numeric ID of the anime.
 * @param ep - The episode number.
 * @returns An object containing the extracted play page information.
 */
export const fetchSourcesPahe = async (
  provider: string,
  id: string,
  ep: number,
): Promise<PahePlayInfo | null> => {
  const cacheKey = `animepahe:sources:${id}:${ep}`;

  if (await cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    // Fetch the releaseId using the numeric ID
    const releaseId = await fetchPaheReleaseId(id);

    // Calculate the page number based on the episode number
    const episodesPerPage = 30;
    const pageNumber = Math.ceil(ep / episodesPerPage);

    // Construct the API URL for the calculated page using releaseId
    const apiUrl = `https://animepahe.ru/api?m=release&id=${releaseId}&sort=episode_asc&page=${pageNumber}`;

    // Fetch the API page containing the desired episode
    const apiResponse = await axios.get<PaheApi>(apiUrl, {
      headers: PAHE_HEADERS,
      timeout: 15000,
    });

    const episodesData = apiResponse.data;

    if (!episodesData || !Array.isArray(episodesData.data)) {
      console.error("Invalid API response structure.");
      return null;
    }

    // Validate that the desired episode falls within the current page range
    if (ep < episodesData.from || ep > episodesData.to) {
      console.error(
        `Episode ${ep} is out of range for page ${pageNumber} (Episodes ${episodesData.from}-${episodesData.to}).`,
      );
      return null;
    }

    // Calculate the index of the desired episode in the data array
    const index = ep - episodesData.from;

    // Retrieve the desired episode using the calculated index
    const desiredEpisode = episodesData.data[index];

    if (!desiredEpisode) {
      console.error(
        `Episode ${ep} not found in API response on page ${pageNumber}.`,
      );
      return null;
    }

    const epId = desiredEpisode.session;

    if (!epId) {
      console.error(`Session (epId) not found for episode ${ep}.`);
      return null;
    }

    // Construct the play URI
    const playUri = `https://animepahe.ru/play/${releaseId}/${epId}`;

    // Fetch the m3u8 video URL
    const videoUrl = await kwik(playUri);

    // Initialize the PlayPageInfo object
    const playPageInfo: PahePlayInfo = {
      animeId: id,
      episodeId: epId,
      title: "",
      videoSession: "",
      videoProvider: "",
      videoUrl,
      nextEpisodeUrl: null,
      downloadLinks: [],
    };

    // Axios configuration with necessary headers
    const axiosConfig: AxiosRequestConfig = {
      headers: {
        ...PAHE_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Connection: "keep-alive",
      },
      timeout: 15000,
      maxRedirects: 5,
    };

    // Fetch the play page content using axios
    const response = await axios.get(playUri, axiosConfig);
    const $ = cheerio.load(response.data);

    // Extract the page title and clean it
    const pageTitle = $("title").text();
    playPageInfo.title = pageTitle.replace(":: animepahe", "").trim();

    // Extract JavaScript variables: session and provider
    $("script").each((_, scriptElement) => {
      const scriptContent = $(scriptElement).html();
      if (scriptContent) {
        const sessionMatch = scriptContent.match(
          /let\s+session\s*=\s*"([^"]+)"/,
        );
        const providerMatch = scriptContent.match(
          /let\s+provider\s*=\s*"([^"]+)"/,
        );

        if (sessionMatch) {
          playPageInfo.videoSession = sessionMatch[1];
        }

        if (providerMatch) {
          playPageInfo.videoProvider = providerMatch[1];
        }
      }
    });

    // Extract the next episode link, if available
    const sequelHref = $("div.sequel a").attr("href");
    if (sequelHref) {
      playPageInfo.nextEpisodeUrl = `https://animepahe.ru${sequelHref}`;
    }

    // Extract download links from the dropdown menu
    $("div#pickDownload a.dropdown-item").each((_, linkElement) => {
      const href = $(linkElement).attr("href") || "";
      const text = $(linkElement).text().trim();

      // Regex to parse fansub, resolution, and size
      const textMatch = text.match(/^(.+?)\s*·\s*(\d+p)\s*\(([\d.]+MB)\)$/);

      if (textMatch) {
        const [_, fansub, resolution, size] = textMatch;

        playPageInfo.downloadLinks.push({
          fansub,
          resolution,
          size,
          url: href,
        });
      }
    });

    // Validate essential fields
    if (
      !playPageInfo.videoSession ||
      !playPageInfo.videoProvider ||
      !playPageInfo.videoUrl
    ) {
      console.error("Failed to extract essential video information.");
      return null;
    }

    // Cache the result
    cache.set(cacheKey, playPageInfo);

    return playPageInfo;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error fetching sources from AnimePahe:");

      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
        console.error(`Data: ${error.response.data}`);
      } else if (error.request) {
        console.error("No response received:", error.request);
      } else {
        console.error("Error setting up request:", error.message);
      }
    } else {
      console.error("Unexpected error:", error);
    }
    return null;
  }
};
