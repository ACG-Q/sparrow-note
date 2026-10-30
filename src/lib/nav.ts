export type NavView = "timeline" | "summary" | "profile" | "checklist";

export function noteHash(id: string): string {
  return `#/note/${id}`;
}

export function parseNoteHash(hash: string): string | null {
  const m = /^#\/note\/([^/]+)$/.exec(hash);
  return m ? decodeURIComponent(m[1]) : null;
}
