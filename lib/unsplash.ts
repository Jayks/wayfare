const UNSPLASH_BASE = "https://api.unsplash.com";

export interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string | null;
  user: { name: string; links: { html: string } };
}

interface SearchResult {
  results: UnsplashPhoto[];
}

export async function searchPhotos(query: string, perPage = 15): Promise<UnsplashPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY is not set");

  const url = new URL(`${UNSPLASH_BASE}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${key}` },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Unsplash error: ${res.status}`);
  const data: SearchResult = await res.json();
  return data.results;
}
