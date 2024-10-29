import axios from "axios";
import * as cheerio from "cheerio";
import { cache } from "../../index";
import {
  type PaheInfo,
  type PaheApi,
  PAHE_HEADERS,
  fetchPaheReleaseId,
} from "./pahe";

/**
 * Fetch Anime Information from AnimePahe
 * @param id - The numeric ID of the anime (e.g., "5687")
 * @returns PaheInfo object or null if not found/error
 */
export const fetchInfoAnimepahe = async (
  id: string,
): Promise<PaheInfo | null> => {
  const cacheKey = `animepahe:${id}`;

  if (await cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    // Fetch the releaseId using the numeric ID
    const releaseId = await fetchPaheReleaseId(id);

    const url = `https://animepahe.ru/a/${id}`;

    // Fetch the main page
    const response = await axios.get(url, {
      headers: {
        ...PAHE_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(response.data);

    // Check if the main anime detail section exists
    if ($("article.page-detail").length === 0) {
      console.error("Main anime detail section not found.");
      return null;
    }

    // Extract Basic Anime Information
    const animeInfo: PaheInfo = {
      id,
      title: $("h1 > span").first().text().trim(),
      japanese: $('p:contains("Japanese:")')
        .text()
        .replace("Japanese:", "")
        .trim(),
      image:
        $("div.anime-poster img").attr("data-src") ||
        $("div.anime-poster img").attr("src") ||
        "",
      type: $('p:contains("Type:") a').text().trim(),
      description: $("div.anime-synopsis").text().trim(),
      genre: $("div.anime-genre a")
        .map((_, el) => $(el).text().trim())
        .get()
        .join(", "),
      released: $('p:contains("Aired:")').text().replace("Aired:", "").trim(),
      status: $('p:contains("Status:") a').text().trim(),
      otherNames: $('p:contains("Synonyms:")')
        .text()
        .replace("Synonyms:", "")
        .trim(),
      season: $('p:contains("Season:") a').text().trim(),
      studio: $('p:contains("Studio:")').text().replace("Studio:", "").trim(),
      externalLinks: $("p.external-links a")
        .map((_, el) => $(el).attr("href"))
        .get()
        .map((link) => `https:${link}`),
      totalEpisodes: parseInt(
        $('p:contains("Episodes:")').text().replace("Episodes:", "").trim(),
        10,
      ),
      currentEpisode: 0,
      episodeList: [],
    };

    // Construct the API URL for fetching episodes
    const apiUrl = `https://animepahe.ru/api?m=release&id=${releaseId}&sort=episode_desc&page=1`;

    // Function to process episodes data
    const processEpisodes = (data: PaheApi["data"]) => {
      data.forEach((ep) => {
        const id = ep.id || 0;
        const episodeNumber = ep.episode || ep.episode2 || 1;
        const duration = ep.duration || "";
        const snapshot = ep.snapshot || "";
        const isNew = (() => {
          const episodeDate = new Date(ep.created_at);
          const currentDate = new Date();
          const diffTime = Math.abs(
            currentDate.getTime() - episodeDate.getTime(),
          );
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        })();

        // Push Episode Data to the List
        animeInfo.episodeList.push({
          id,
          number: parseInt(episodeNumber.toString(), 10),
          duration,
          snapshot,
          isNew,
        });
      });
    };

    // Fetch Episodes from the API
    const apiResponse = await axios.get<PaheApi>(apiUrl, {
      headers: PAHE_HEADERS,
    });

    const episodesData = apiResponse.data;

    if (episodesData && episodesData.data && Array.isArray(episodesData.data)) {
      // Process first page
      processEpisodes(episodesData.data);

      // Handle Pagination (if applicable)
      const totalPages = episodesData.last_page;
      for (let page = 2; page <= totalPages; page++) {
        const paginatedApiUrl = `https://animepahe.ru/api?m=release&id=${releaseId}&sort=episode_desc&page=${page}`;
        try {
          const paginatedResponse = await axios.get<PaheApi>(paginatedApiUrl, {
            headers: PAHE_HEADERS,
          });
          const paginatedData = paginatedResponse.data;

          if (
            paginatedData &&
            paginatedData.data &&
            Array.isArray(paginatedData.data)
          ) {
            processEpisodes(paginatedData.data);
          } else {
            console.warn(`No episode data found on page ${page}.`);
          }
        } catch (paginatedError) {
          console.error(
            `Error fetching episodes on page ${page}:`,
            paginatedError,
          );
        }
      }

      // Sort the episodeList by episode number ascending
      animeInfo.episodeList.sort((a, b) => a.number - b.number);

      // Determine the latest episode number
      if (animeInfo.episodeList.length > 0) {
        animeInfo.currentEpisode = Math.max(
          ...animeInfo.episodeList.map((ep) => ep.number),
        );
      } else {
        animeInfo.currentEpisode = 0;
      }
    } else {
      console.warn("No episode data found in API response.");
      animeInfo.currentEpisode = 0;
    }

    // Cache the Result
    cache.set(cacheKey, animeInfo);

    return animeInfo;
  } catch (error) {
    console.error("Error fetching anime info from AnimePahe:", error);
    return null;
  }
};
