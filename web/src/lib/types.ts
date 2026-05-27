export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export type ViewMode = "split" | "editor" | "preview";
