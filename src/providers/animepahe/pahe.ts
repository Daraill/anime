import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Interface for Episode Information
 */
export interface PaheEpisode {
  id: number;
  number: number;
  duration: string;
  snapshot: string;
  isNew: boolean;
}

/**
 * Interface for Anime Information
 */
export interface PaheInfo {
  id: string;
  title: string;
  japanese: string;
  image: string;
  type: string;
  description: string;
  genre: string;
  released: string;
  status: string;
  otherNames: string;
  season: string;
  studio: string;
  externalLinks: string[];
  totalEpisodes: number;
  currentEpisode: number;
  episodeList: PaheEpisode[];
}

/**
 * Interface for API Episode Data
 */
export interface PaheApiEpisodes {
  id: number;
  anime_id: number;
  episode: number;
  episode2: number;
  edition: string;
  title: string;
  snapshot: string;
  disc: string;
  audio: string;
  duration: string;
  session: string;
  filler: number;
  created_at: string;
}

/**
 * Interface for API Response
 */
export interface PaheApi {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  next_page_url: string | null;
  prev_page_url: string | null;
  from: number;
  to: number;
  data: PaheApiEpisodes[];
}

/**
 * Interface for Download Link Information
 */
export interface PaheDownload {
  fansub: string;
  resolution: string;
  size: string;
  url: string;
}

/**
 * Interface for Play Page Information
 */
export interface PahePlayInfo {
  animeId: string;
  episodeId: string;
  title: string;
  videoSession: string;
  videoProvider: string;
  videoUrl: string;
  nextEpisodeUrl: string | null;
  downloadLinks: PaheDownload[];
}

/**
 * Common Axios Headers
 */
export const PAHE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/58.0.3029.110 Safari/537.3",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json",
  Referer: "https://animepahe.ru/", // Essential referer header
  Host: "animepahe.ru", // Host header
  Cookie: "__ddg1_=; __ddg2_=", // DDoS protection cookies
};

/**
 * Fetches the releaseId from the main anime page.
 * @param id - The numeric ID of the anime.
 * @returns The extracted releaseId.
 */
export const fetchPaheReleaseId = async (id: string): Promise<string> => {
  const url = `https://animepahe.ru/a/${id}`;

  try {
    const response = await axios.get(url, {
      headers: {
        ...PAHE_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(response.data);

    let releaseId: string | null = null;
    $("script").each((_, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent) {
        const match = scriptContent.match(/let\s+id\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
          releaseId = match[1];
        }
      }
    });

    if (!releaseId) {
      throw new Error("Release ID not found on the main anime page.");
    }

    return releaseId;
  } catch (error) {
    console.error("Error fetching releaseId from the main anime page:", error);
    throw error;
  }
};
