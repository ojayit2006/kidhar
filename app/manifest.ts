import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kidhar? Emergency Locator",
    short_name: "Kidhar?",
    description: "Turn a landmark-style Hinglish emergency call into a map pin and the nearest help.",
    start_url: "/report",
    display: "standalone",
    background_color: "#bfe3ff",
    theme_color: "#2f7dff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
