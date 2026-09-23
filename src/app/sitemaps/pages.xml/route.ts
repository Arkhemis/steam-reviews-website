import { STATIC_PATHS, urlsetXml, xmlResponse } from "@/lib/sitemap";

export function GET() {
  return xmlResponse(urlsetXml(STATIC_PATHS));
}
