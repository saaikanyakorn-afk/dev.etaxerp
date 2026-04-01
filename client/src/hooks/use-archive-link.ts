import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "./use-toast";

interface BaseUrls {
  ftpBaseUrl: string | null;
  ftpLanBaseUrl: string | null;
}

export function useArchiveLink() {
  const { toast } = useToast();

  const { data: baseUrls } = useQuery<BaseUrls>({
    queryKey: ["/api/ftp-archive/base-urls"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isArchiveUrl = useCallback(
    (url: string) => {
      if (!baseUrls?.ftpBaseUrl) return false;
      return url.startsWith(baseUrls.ftpBaseUrl);
    },
    [baseUrls]
  );

  const hasLanFallback = useCallback(
    (url: string) => {
      return isArchiveUrl(url) && !!baseUrls?.ftpLanBaseUrl;
    },
    [isArchiveUrl, baseUrls]
  );

  const openArchiveFile = useCallback(
    async (url: string) => {
      if (!isArchiveUrl(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      const proxyUrl = `/api/ftp-archive/proxy?url=${encodeURIComponent(url)}`;
      window.open(proxyUrl, "_blank", "noopener,noreferrer");
    },
    [isArchiveUrl]
  );

  const getProxyUrl = useCallback(
    (url: string) => {
      if (!baseUrls?.ftpBaseUrl || !url.startsWith(baseUrls.ftpBaseUrl)) return url;
      return `/api/ftp-archive/proxy?url=${encodeURIComponent(url)}`;
    },
    [baseUrls]
  );

  const getLanUrl = useCallback(
    (url: string) => {
      if (!baseUrls?.ftpBaseUrl || !baseUrls?.ftpLanBaseUrl) return null;
      if (!url.startsWith(baseUrls.ftpBaseUrl)) return null;
      return url.replace(baseUrls.ftpBaseUrl, baseUrls.ftpLanBaseUrl);
    },
    [baseUrls]
  );

  return { openArchiveFile, isArchiveUrl, hasLanFallback, getLanUrl, getProxyUrl };
}
