export interface Source {
  id: string;
  name: string;
  url: string | null;
  asOfDate: string | null;
  licenseNote: string | null;
  ingestedAt: string | null;
}
