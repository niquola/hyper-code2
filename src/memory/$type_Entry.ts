export type Entry = {
  id?: number;
  key: string;
  value: any;        // JSON-serialized on write
  tags?: string[];   // labels for filtering
  createdAt?: number;
};