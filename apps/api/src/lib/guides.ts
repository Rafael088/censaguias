export const GUIDE_COLUMNS =
  "id, subject_id, topic, title, description, status, published_at, storage_path, file_name, size_bytes, page_count, created_at, updated_at";

export type GuideRow = {
  id: string;
  subject_id: string;
  topic: string;
  title: string;
  description: string;
  status: "draft" | "published";
  published_at: string | null;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  page_count: number | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * La guía como la ve el front. Sin storage_path: eso es interno, la descarga va por una
 * URL firmada de corta vida (API-07).
 */
export const mapGuide = (row: GuideRow) => ({
  id: row.id,
  subjectId: row.subject_id,
  topic: row.topic,
  title: row.title,
  description: row.description,
  status: row.status,
  publishedAt: row.published_at,
  fileName: row.file_name,
  sizeBytes: row.size_bytes,
  pageCount: row.page_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
