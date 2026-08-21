export type DataLoadState = "ok" | "missing" | "error";

export type DatasetStatus = {
  state: DataLoadState;
  count: number;
  errorMessage: string | null;
};
