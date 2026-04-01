import { useMemo } from "react";
import { getPrefixOptions, resolvePrefix } from "@shared/document-types";

export function usePrefixOptions(docTypeKey: string, docSettings: any) {
  const docPrefixesJson = docSettings?.docPrefixes || null;

  const prefixOptions = useMemo(
    () => getPrefixOptions(docTypeKey, docPrefixesJson),
    [docTypeKey, docPrefixesJson]
  );

  const defaultPrefix = useMemo(
    () => resolvePrefix(docTypeKey, docPrefixesJson),
    [docTypeKey, docPrefixesJson]
  );

  return { prefixOptions, defaultPrefix };
}
