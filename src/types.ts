export interface Entry {
  id: string;
  /** YYYY-MM-DD, local time */
  date: string;
  createdAt: string;
  updatedAt?: string;
  text: string;
  impact?: string;
  project?: string;
  tags: string[];
  links: string[];
}

export interface Journal {
  version: number;
  entries: Entry[];
}

/** A list option as given on the command line or in a prompt: repeatable and/or comma-separated. */
export type ListInput = string | string[] | undefined;

export interface EntryFields {
  text?: string;
  impact?: string;
  project?: string;
  tags?: ListInput;
  links?: ListInput;
  date?: string;
}

export interface Filters {
  since?: string;
  until?: string;
  tags?: ListInput;
  project?: string;
}
