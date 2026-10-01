"use client";

import { useEffect, useState } from "react";

export type CatalogNetwork = {
  code: string;
  name: string;
  railLabel?: string | null;
  logoUrl?: string | null;
  addressFamily?: string | null;
};

export type CatalogAsset = {
  code: string;
  name: string;
  type: "CRYPTO" | "STABLECOIN" | string;
  decimalPlaces: number;
  logoUrl?: string | null;
  sortOrder: number;
  featured: boolean;
  routeToken: boolean;
  networks: CatalogNetwork[];
};

let pending: Promise<CatalogAsset[]> | null = null;

/** Active crypto catalog from the database (admins switch assets on/off on the Assets page). */
export function loadAssetCatalog(): Promise<CatalogAsset[]> {
  if (!pending) {
    pending = fetch("/api/catalog")
      .then((response) => (response.ok ? response.json() : []))
      .then((value: unknown) => (Array.isArray(value) ? (value as CatalogAsset[]) : []))
      .catch(() => {
        pending = null;
        return [];
      });
  }
  return pending;
}

export function useAssetCatalog(): CatalogAsset[] {
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  useEffect(() => {
    let live = true;
    void loadAssetCatalog().then((value) => {
      if (live) setAssets(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return assets;
}
