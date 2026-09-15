import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type AppReportMediaAssessment = "satisfactory" | "insufficient";

export type AppReportMedia = {
  kind: "image" | "video";
  mediaType: string;
  fileName: string;
  url: string;
};

const mediaForAssessment = makeFunctionReference<
  "query",
  { serviceSecret: string; mediaId: string; assessmentKey: string },
  AppReportMedia | null
>("reporting:appReportMediaForAssessment");

const assessMedia = makeFunctionReference<
  "mutation",
  {
    serviceSecret: string;
    mediaId: string;
    assessmentKey: string;
    assessment: AppReportMediaAssessment;
  },
  { mediaId: string; assessment: AppReportMediaAssessment }
>("reporting:assessAppReportMedia");

export class AppReportMediaStore {
  readonly #client: ConvexHttpClient;

  constructor(
    convexUrl: string,
    readonly serviceSecret: string,
  ) {
    this.#client = new ConvexHttpClient(convexUrl);
  }

  async get(
    mediaId: string,
    assessmentKey: string,
  ): Promise<AppReportMedia | null> {
    return await this.#client.query(mediaForAssessment, {
      serviceSecret: this.serviceSecret,
      mediaId,
      assessmentKey,
    });
  }

  async assess(
    mediaId: string,
    assessmentKey: string,
    assessment: AppReportMediaAssessment,
  ): Promise<{ mediaId: string; assessment: AppReportMediaAssessment }> {
    return await this.#client.mutation(assessMedia, {
      serviceSecret: this.serviceSecret,
      mediaId,
      assessmentKey,
      assessment,
    });
  }
}
