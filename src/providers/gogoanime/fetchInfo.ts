import axios from "axios";
import * as cheerio from "cheerio";
import { cache } from "../../index";

export const fetchInfoGogo = async (id: string) => {
  const cacheKey = `gogo:${id}`;

  // Try to get data from cache
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    // console.log(`Retrieved anime info for id ${id} from cache`);
    return cachedData;
  }

  const url = `https://anitaku.pe/category/${id}`;

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const animeInfo = {
      id,
      title: $("div.anime_info_body_bg h1").text().trim(),
      image: $("div.anime_info_body_bg img").attr("src"),
      type: $('p.type:contains("Type:") a').text().trim(),
      description: $("div.description p").text().trim(),
      genre: $('p.type:contains("Genre:") a')
        .map((i: number, el: any) => $(el).text().trim())
        .get()
        .join(", "),
      released: $('p.type:contains("Released:")')
        .text()
        .replace("Released: ", "")
        .trim(),
      status: $('p.type:contains("Status:") a').text().trim(),
      otherNames: $("p.type.other-name a")
        .map((i: number, el: any) => $(el).text().trim())
        .get()
        .join(", "),
      episodes: getTotalEpisodes($),
    };

    // Store in cache
    cache.set(cacheKey, animeInfo);

    return {
      id: animeInfo.id,
      title: animeInfo.title,
      image: animeInfo.image,
      type: animeInfo.type,
      description: animeInfo.description,
      genre: animeInfo.genre,
      released: animeInfo.released,
      status: animeInfo.status,
      otherNames: animeInfo.otherNames,
      episodes: animeInfo.episodes,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error while fetching ${url}:`, error.message);
    } else {
      console.error(`Unexpected error while fetching ${url}:`, error);
    }
    return null;
  }
};

/**
 * Get the total number of episodes by finding the last episode number in the list.
 * @param $ - Cheerio instance
 * @returns {number} - Total number of episodes
 */
const getTotalEpisodes = ($: any): number => {
  const lastEpisodeElement = $("#episode_page li a").last();
  const epEnd = parseInt(lastEpisodeElement.attr("ep_end") || "0", 10);
  return isNaN(epEnd) ? 0 : epEnd;
};

// Example usage (Uncomment below lines to test)
/*
(async () => {
  const animeId = 'naruto';
  const info = await fetchInfoGogo(animeId);
  console.log(JSON.stringify(info, null, 2));
})();
*/
