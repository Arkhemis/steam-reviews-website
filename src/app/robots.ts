import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "ia_archiver", disallow: "/" },
      { userAgent: "archive.org_bot", disallow: "/" },
    ],
  };
}
