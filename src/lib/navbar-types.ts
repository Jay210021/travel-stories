import type { DestinationNavigation, RegionSlug } from "@/lib/destination";

export type NavbarLinkItem = {
  id: string;
  type: "link";
  label: string;
  href: string;
};

export type NavbarDestinationItem = {
  id: string;
  type: "destination";
  label: string;
  region: DestinationNavigation[number];
};

export type NavbarGroupItem = {
  id: string;
  type: "group";
  label: string;
  href: string;
  children: { id: string; label: string; href: string }[];
};

export type PublicNavbarItem = NavbarLinkItem | NavbarDestinationItem | NavbarGroupItem;
export type NavbarItemInput = {
  label: string;
  type: "link" | "destination";
  href?: string;
  destinationRegion?: RegionSlug;
  sortOrder?: number;
  isVisible?: boolean;
};
