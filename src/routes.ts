import express, { type Request, type Response } from "express";
import {
  fetchInfoAnilist,
  fetchInfoAnimepahe,
  fetchInfoGogo,
  fetchInfoZoro,
  fetchEpisodesZoro,
  fetchServersZoro,
  fetchSourcesGogo,
  fetchSourcesPahe,
  fetchSourcesZoro,
  fetchMappings,
  ContentType,
  Provider,
} from "./index";

const router = express.Router();

// Helper function for sending error responses
function sendErrorResponse(res: Response, status: number, message: string) {
  res.status(status).json({ error: message, status });
}

// Provider functions mapped by Provider enum
const infoProviders: { [key in Provider]?: (id: string) => Promise<any> } = {
  [Provider.ANILIST]: fetchInfoAnilist,
  [Provider.GOGOANIME]: fetchInfoGogo,
  [Provider.ZORO]: fetchInfoZoro,
  [Provider.ANIMEPAHE]: fetchInfoAnimepahe,
};

const episodeProviders: { [key in Provider]?: (id: string) => Promise<any> } = {
  [Provider.ZORO]: fetchEpisodesZoro,
};

const serverProviders: { [key in Provider]?: (epId: string) => Promise<any> } =
  {
    [Provider.ZORO]: fetchServersZoro,
  };

const sourcesProviders: {
  [key in Provider]?: (
    provider: string,
    id: string,
    ep: number,
  ) => Promise<any>;
} = {
  [Provider.GOGOANIME]: fetchSourcesGogo,
  [Provider.ANIMEPAHE]: fetchSourcesPahe,
  [Provider.ZORO]: fetchSourcesZoro,
};

// Info Route
router.get("/info", async (req: Request, res: Response) => {
  const { id, provider } = req.query;

  if (!id || !provider) {
    return sendErrorResponse(
      res,
      400,
      "Missing 'id' or 'provider' in query parameters.",
    );
  }

  const providerKey = provider as Provider;

  if (!infoProviders[providerKey]) {
    return sendErrorResponse(res, 400, "Invalid provider.");
  }

  try {
    const infoResponse = await infoProviders[providerKey]!(id as string);
    if (!infoResponse) {
      return sendErrorResponse(res, 404, "Anime not found.");
    }
    res.json(infoResponse);
  } catch (error) {
    console.error(error);
    sendErrorResponse(
      res,
      500,
      "An error occurred while fetching the anime information.",
    );
  }
});

// Episodes Route
router.get("/episodes", async (req: Request, res: Response) => {
  const { id, provider } = req.query;

  if (!id || !provider) {
    return sendErrorResponse(
      res,
      400,
      "Missing 'id' or 'provider' in query parameters.",
    );
  }

  const providerKey = provider as Provider;

  if (!episodeProviders[providerKey]) {
    return sendErrorResponse(res, 400, "Invalid provider.");
  }

  try {
    const episodesResponse = await episodeProviders[providerKey]!(id as string);
    if (!episodesResponse) {
      return sendErrorResponse(res, 404, "Episodes not found.");
    }
    res.json(episodesResponse);
  } catch (error) {
    console.error(error);
    sendErrorResponse(
      res,
      500,
      "An error occurred while fetching the episodes information.",
    );
  }
});

// Mappings Route
router.get("/mappings", async (req: Request, res: Response) => {
  const { id, provider, type } = req.query;

  if (!id || !provider || !type) {
    return sendErrorResponse(
      res,
      400,
      "Missing 'id', 'provider', or 'type' in query parameters.",
    );
  }

  const providerKey = provider as Provider;
  const typeKey = type as ContentType;

  if (!Object.values(Provider).includes(providerKey)) {
    return sendErrorResponse(res, 400, "Invalid provider.");
  }

  if (!Object.values(ContentType).includes(typeKey)) {
    return sendErrorResponse(res, 400, "Invalid type.");
  }

  try {
    const data = await fetchMappings(id as string, providerKey, typeKey);
    if (!data) {
      return sendErrorResponse(res, 404, "Mappings not found.");
    }
    res.json(data);
  } catch (error) {
    console.error("Error in /mappings route:", error);
    sendErrorResponse(
      res,
      500,
      "An error occurred while fetching the mappings.",
    );
  }
});

// Servers Route
router.get("/servers", async (req: Request, res: Response) => {
  const { epId, provider } = req.query;

  if (!epId || !provider) {
    return sendErrorResponse(
      res,
      400,
      "Missing 'epId' or 'provider' in query parameters.",
    );
  }

  const providerKey = provider as Provider;

  if (!serverProviders[providerKey]) {
    return sendErrorResponse(res, 400, "Invalid provider.");
  }

  try {
    const serversResponse = await serverProviders[providerKey]!(epId as string);
    if (!serversResponse) {
      return sendErrorResponse(res, 404, "Servers not found.");
    }
    res.json(serversResponse);
  } catch (error) {
    console.error(error);
    sendErrorResponse(
      res,
      500,
      "An error occurred while fetching the servers information.",
    );
  }
});

// Sources Route
router.get("/sources", async (req: Request, res: Response) => {
  const { id, provider, ep } = req.query;

  if (!id || !provider || ep == null) {
    return sendErrorResponse(
      res,
      400,
      "Missing 'id', 'provider', or 'ep' in query parameters.",
    );
  }

  const providerKey = provider as Provider;

  if (!sourcesProviders[providerKey]) {
    return sendErrorResponse(res, 400, "Invalid provider.");
  }

  // Parse 'ep' as a number and validate
  const episodeNumber = parseInt(ep as string, 10);
  if (isNaN(episodeNumber) || episodeNumber < 0) {
    return sendErrorResponse(
      res,
      400,
      "Invalid 'ep' provided. It must be a valid non-negative number.",
    );
  }

  try {
    const sourcesResponse = await sourcesProviders[providerKey]!(
      providerKey,
      id as string,
      episodeNumber,
    );
    if (!sourcesResponse) {
      return sendErrorResponse(res, 404, "No sources found.");
    }
    res.json(sourcesResponse);
  } catch (error) {
    console.error(error);
    sendErrorResponse(
      res,
      500,
      "An error occurred while fetching the source data.",
    );
  }
});

export default router;
