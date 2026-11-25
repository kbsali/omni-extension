export interface NtfyStorage {
  server: string;
  topic: string;
  token: string; // ntfy access token (tk_...), empty for a public topic
}

export const NTFY_DEFAULTS: NtfyStorage = {
  server: 'https://ntfy.sh',
  topic: 'kbsali-all',
  token: '',
};
