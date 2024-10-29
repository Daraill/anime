import axios from "axios";
import { cache } from "../../index";
import type { ContentType, Provider } from "../../types/enums";

/**
 * Interface for Site Information
 */
interface SiteInfo {
  identifier: string;
  image?: string;
  malId: number;
  aniId: number;
  page: string;
  title: string;
  type: string;
  url: string;
  external?: boolean;
}

/**
 * Interface for Sites Mapping
 */
interface Sites {
  [key: string]: {
    [key: string]: SiteInfo;
  };
}

/**
 * Interface for Mapping Response
 */
interface MappingResponse {
  id: number;
  type: string;
  title: string;
  url: string;
  total: number;
  image: string;
  malId: number;
  Sites: Sites;
}

/**
 * Fetch Mapping Data from Primary API and Fallback GitHub Sources
 * @param id - The numeric ID of the anime or manga (e.g., "5687")
 * @param provider - The source provider ('anilist' or 'mal')
 * @param type - The type of content ('anime' or 'manga')
 * @returns MappingResponse object or null if not found/error
 */
export const fetchMappings = async (
  id: string,
  provider: Provider,
  type: ContentType,
): Promise<MappingResponse | null> => {
  const cacheKey = `mappings-${provider}-${type}-${id}`;

  // Check Cache First
  if (await cache.has(cacheKey)) {
    console.log(`Fetching mappings for id ${id} from cache`);
    return cache.get(cacheKey);
  }

  // Adjusted Primary API URL Based on Provider
  const identifier = provider === "anilist" ? `anilist:${id}` : `${id}`;
  const primaryApiUrl = `https://api.malsync.moe/mal/${type}/${identifier}`;

  // Simplified GitHub URL
  const githubUrl = `https://raw.githubusercontent.com/bal-mackup/mal-backup/refs/heads/master/${provider}/${type}/${id}.json`;

  // Attempt to Fetch from Primary API
  try {
    console.log(
      `Attempting to fetch mappings from primary API: ${primaryApiUrl}`,
    );
    const res = await axios.get<MappingResponse>(primaryApiUrl);
    const primaryData = res.data;

    if (primaryData) {
      console.log(
        `Successfully fetched mappings from primary API for id ${id}`,
      );
      await cache.set(cacheKey, primaryData); // Ensure cache.set is awaited if it's asynchronous
      return primaryData;
    } else {
      console.warn(`Primary API returned null or undefined data for id ${id}`);
    }
  } catch (error) {
    console.warn(`Failed to fetch from primary API for id ${id}:`, error);
  }

  // Attempt to Fetch from GitHub Raw URL
  try {
    console.log(
      `Attempting to fetch mappings from GitHub raw URL: ${githubUrl}`,
    );
    const res = await axios.get<MappingResponse>(githubUrl);
    const fallbackData = res.data;

    if (fallbackData) {
      console.log(`Successfully fetched mappings from GitHub for id ${id}`);
      await cache.set(cacheKey, fallbackData); // Ensure cache.set is awaited if it's asynchronous
      return fallbackData;
    } else {
      console.warn(
        `GitHub raw URL returned null or undefined data for id ${id}`,
      );
    }
  } catch (error) {
    console.warn(`Failed to fetch from GitHub raw URL for id ${id}:`, error);
  }

  // If All Fetch Attempts Fail
  console.error(`Failed to fetch mappings for id ${id} from all sources.`);
  return null;
};
