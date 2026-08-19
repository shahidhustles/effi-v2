import type { EvidenceStorage } from "./evidence-storage.js";
import type { EffiMediaStorage } from "./whatsapp-persistence.js";

type ControlledMediaStores = {
  telegram: Required<Pick<EvidenceStorage, "remove">>;
  whatsapp: Required<Pick<EffiMediaStorage, "remove">>;
};

/** Deletes only media keys owned by the anonymous channel that staged them. */
export const eraseAnonymousDraftMedia = async (
  storageKeys: readonly string[],
  stores: ControlledMediaStores,
): Promise<void> => {
  for (const storageKey of new Set(storageKeys)) {
    if (storageKey.startsWith("effi/telegram/")) await stores.telegram.remove(storageKey);
    else if (storageKey.startsWith("effi/whatsapp/")) await stores.whatsapp.remove(storageKey);
    else throw new Error("Draft media key is not controlled by Effi.");
  }
};
