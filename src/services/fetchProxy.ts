import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import * as fs from "fs-extra";
import * as https from "https";
import * as http from "http";
import pLimit from "p-limit";
import { HttpsProxyAgent } from "https-proxy-agent";
import logger from "../utils/logger";

// Environment Variables
const CENSYS_URL = "https://search.censys.io/api/v2/hosts/search";
const CENSYS_ID = "dbe0adee-31bd-49e4-b314-493f6aea05c9";
const CENSYS_SECRET = "nlNrZ55bbt0PXFUefsryoL7KWdM4zmqE";

// Target Websites to Verify Proxies Against
const TARGET_WEBSITES = [
  "https://gogoanime3.co/",
  "https://hianime.to/",
  "https://animepahe.ru/",
  "https://anilist.co/",
];

// Maximum number of concurrent proxy verifications
const CONCURRENCY_LIMIT = 10;

// Timeout settings
const REQUEST_TIMEOUT = 5000; // 5 seconds

// Function to Fetch Proxies from Censys
export async function fetchProxiesFromCensys(
  pages: number = 1,
): Promise<string[]> {
  if (!CENSYS_URL || !CENSYS_ID || !CENSYS_SECRET) {
    logger.error(
      "CENSYS_URL, CENSYS_ID, and CENSYS_SECRET must be set in environment variables.",
    );
    throw new Error(
      "CENSYS_URL, CENSYS_ID, and CENSYS_SECRET must be set in environment variables.",
    );
  }

  const query =
    "(services.port:80 OR services.port:1080 OR services.port:3128 OR services.port:8080)";

  const proxies: string[] = [];

  for (let page = 1; page <= pages; page++) {
    try {
      logger.info(`Fetching page ${page} from Censys...`);
      const response = await axios.get(CENSYS_URL, {
        params: {
          q: query,
          per_page: 100, // Increase per_page for more proxies
          page: page,
        },
        auth: {
          username: CENSYS_ID,
          password: CENSYS_SECRET,
        },
        timeout: REQUEST_TIMEOUT,
      });

      response.data.result.hits.forEach((host: any) => {
        const ip = host.ip;
        host.services.forEach((service: any) => {
          if ([80, 1080, 3128, 8080].includes(service.port)) {
            proxies.push(`${ip}:${service.port}`);
          }
        });
      });

      logger.info(
        `Fetched ${response.data.result.hits.length} hits from page ${page}. Total proxies fetched so far: ${proxies.length}.`,
      );
    } catch (error: any) {
      logger.error(`Error fetching page ${page} from Censys: ${error.message}`);
      // Optionally, decide whether to continue or break
    }
  }

  logger.info(`Total proxies fetched: ${proxies.length}`);
  return proxies;
}

// Function to Verify a Single Proxy
async function verifyProxy(
  proxy: string,
): Promise<{ proxy: string; worksFor: string[] }> {
  const worksFor: string[] = [];
  const [ip, port] = proxy.split(":");
  const proxyPort = parseInt(port, 10);
  const protocol = proxyPort === 1080 ? "socks5" : "http";

  const proxyUrl = `${protocol}://${proxy}`;

  logger.info(`Verifying proxy ${proxy} (${protocol.toUpperCase()})`);

  // Create Axios instance with proxy settings
  const axiosInstance = axios.create({
    httpAgent:
      protocol === "http" ? new http.Agent({ keepAlive: true }) : undefined,
    httpsAgent:
      protocol === "socks5"
        ? new HttpsProxyAgent(proxyUrl)
        : new https.Agent({ keepAlive: true }),
    proxy:
      protocol === "http"
        ? {
            host: ip,
            port: proxyPort,
          }
        : false, // Disable proxy for SOCKS5, handled by https-proxy-agent
    timeout: REQUEST_TIMEOUT,
    validateStatus: (status) => status >= 200 && status < 400, // Accept 2xx and 3xx status codes
  });

  for (const site of TARGET_WEBSITES) {
    try {
      logger.info(`Proxy ${proxy} attempting to connect to ${site}`);
      const response = await axiosInstance.get(site);
      if (response.status >= 200 && response.status < 400) {
        logger.info(`Proxy ${proxy} successfully connected to ${site}`);
        worksFor.push(site);
      } else {
        logger.warn(
          `Proxy ${proxy} received status code ${response.status} from ${site}`,
        );
      }
    } catch (error: any) {
      logger.warn(
        `Proxy ${proxy} failed to connect to ${site}: ${error.message}`,
      );
      // Continue to next site
    }
  }

  if (worksFor.length > 0) {
    logger.info(`Proxy ${proxy} works for: ${worksFor.join(", ")}`);
  } else {
    logger.warn(`Proxy ${proxy} does not work for any target sites.`);
  }

  return { proxy, worksFor };
}

// Main Function to Fetch, Verify, and Store Proxies
export async function fetchAndVerifyProxies() {
  logger.info("Starting the proxy fetching and verification process...");

  const fetchedProxies = await fetchProxiesFromCensys(5); // Fetch 5 pages

  if (fetchedProxies.length === 0) {
    logger.warn("No proxies fetched. Exiting.");
    return;
  }

  logger.info(`Starting verification of ${fetchedProxies.length} proxies.`);

  const limit = pLimit(CONCURRENCY_LIMIT);
  const verificationPromises = fetchedProxies.map((proxy) =>
    limit(() => verifyProxy(proxy)),
  );

  const verifiedProxiesResults = await Promise.all(verificationPromises);

  // Filter proxies that work for at least one site
  const workingProxies = verifiedProxiesResults.filter(
    (result) => result.worksFor.length > 0,
  );

  logger.info(
    `Verification complete. ${workingProxies.length} out of ${fetchedProxies.length} proxies are working.`,
  );

  // Structure to store proxies with their working sites
  const proxiesToStore = workingProxies.map(({ proxy, worksFor }) => ({
    proxy,
    worksFor,
  }));

  // Write to proxies.json
  try {
    await fs.writeJson("proxies.json", proxiesToStore, { spaces: 2 });
    logger.info("Working proxies have been saved to proxies.json");
  } catch (error: any) {
    logger.error(`Error writing proxies to file: ${error.message}`);
  }

  logger.info("Proxy fetching and verification process completed.");
}

// Execute the Main Function
fetchAndVerifyProxies();
