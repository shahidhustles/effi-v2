import { FileMediaStorage } from "../../src/whatsapp-persistence.js";
import { reportIngress } from "./reporting.js";

export const whatsappMediaStorage = new FileMediaStorage(
  process.env.WHATSAPP_MEDIA_DIR ?? ".data/whatsapp-media",
);

export const whatsappReportIngress = reportIngress;
