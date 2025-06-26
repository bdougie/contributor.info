import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Dub } from "dub";

@Injectable()
export class UrlShortenerService {
  private readonly dubApiKey = this.configService.get<string>("dub.apiKey")!;
  private readonly domain = this.configService.get<string>("dub.domain")!;
  private readonly dubService = new Dub({ token: this.dubApiKey });

  constructor(private configService: ConfigService) {}

  async shortenUrl(url: string) {
    try {
      const urlToValidate = new URL(url);

      if (
        !urlToValidate.host.endsWith("opensauced.pizza") &&
        !urlToValidate.host.endsWith("oss-insights.netlify.app") &&
        !urlToValidate.host.includes("localhost")
      ) {
        throw new BadRequestException("Invalid URL");
      }

      const customKey = this.getCustomKey(url);
      const response = await this.dubService.links.upsert({
        key: customKey,
        domain: this.domain,
        url,
      });

      return { shortUrl: response.shortLink };
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new BadRequestException(`Unable to shorten URL ${e.message}`);
      }
    }
  }

  async createShortLink(url: string) {
    const customKey = this.getCustomKey(url);

    try {
      const response = await this.dubService.links.create({
        key: customKey,
        domain: this.domain,
        url,
      });

      return { shortUrl: response.shortLink };
    } catch (e) {
      if (e instanceof Error) {
        throw new BadRequestException(`Unable to shorten URL ${e.message}`);
      }

      throw new BadRequestException("Unable to shorten URL");
    }
  }

  getCustomKey(url: string) {
    const urlPath = new URL(url).pathname;

    // ex: /user/:username
    const userKey = new RegExp("^/(u|user)/(.*)$").test(urlPath) ? urlPath.split("/").pop() : undefined;

    if (userKey) {
      return userKey;
    }

    // ex: /s/:org/:repo
    const repoKey = new RegExp("^/s/(.*)$").test(urlPath) ? urlPath.split("/").slice(2).join("/") : undefined;

    if (repoKey) {
      return repoKey;
    }

    return undefined;
  }
}