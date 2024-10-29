/**
 * Fetches the m3u8 video URL by evaluating the JavaScript code embedded in the page.
 * @param url - The URL of the page containing the m3u8 link.
 * @returns The extracted m3u8 video URL.
 */
export const fetchM3U8Url = async (url: string): Promise<string> => {
  const referer = "https://animepahe.ru/";

  const pageContent = await fetch(url, {
    headers: { Referer: referer },
  }).then((response) => response.text());

  const scriptContentMatch = /(eval)(\(function[\s\S]*?)(<\/script>)/s.exec(
    pageContent,
  );
  const scriptContent = scriptContentMatch?.[2].replace("eval", "") || "";

  // It's generally unsafe to use eval. Consider using a safer alternative if possible.
  const evaluatedScript = eval(scriptContent);
  const m3u8LinkMatch = evaluatedScript.match(/https.*?m3u8/);
  const m3u8Link = m3u8LinkMatch?.[0];

  if (!m3u8Link) {
    throw new Error("Failed to extract m3u8 link.");
  }

  return m3u8Link;
};

/**
 * Fetches the m3u8 video URL from the kiwi server.
 * @param url - The URL of the page hosted on the kiwi server.
 * @returns The extracted m3u8 video URL.
 */
export const kwik = async (url: string): Promise<string> => {
  const pageContent = await fetch(url, {
    headers: { Cookie: "__ddg1_=;__ddg2_=" },
  }).then((response) => response.text());

  const urlMatch = pageContent.match(/let url = "(.*)"/);
  if (!urlMatch) {
    throw new Error("Failed to extract video URL.");
  }

  const videoPageUrl = urlMatch[1];
  const m3u8Url = await fetchM3U8Url(videoPageUrl);

  return m3u8Url;
};
