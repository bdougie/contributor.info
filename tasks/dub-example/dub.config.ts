import { registerAs } from "@nestjs/config";

export const DubConfig = registerAs("dub", () => ({
  apiKey: String(process.env.DUB_API_KEY ?? ""),
  domain: String(process.env.DUB_WORKSPACE_DOMAIN ?? ""),
}));

export default DubConfig;