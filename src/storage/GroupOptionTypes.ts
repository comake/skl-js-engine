import { FindOptionsWhere } from "./FindOptionsTypes";

// Add these types at the top of the file
export interface GroupByOptions {
  where?: FindOptionsWhere;
  groupBy?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  dateGrouping?: "month" | "day";
  limit?: number;
  offset?: number;
}

export interface GroupResult {
  group: Record<string, string | number>;
  count: number;
  entityIds: string[];
}

export interface GroupByResponse {
  results: GroupResult[];
  meta: {
    totalCount: number;
    dateRange?: {
      start: string;
      end: string;
    };
    groupings: string[];
  };
}
