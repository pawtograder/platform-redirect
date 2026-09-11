import type { MetadataRoute } from "next";

/**
 * Keep this origin out of search results entirely. Every URL here is a
 * redirect stub; indexing them would put dead app.pawtograder.com links above
 * the schools' real deployments in search.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" }
  };
}
