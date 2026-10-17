// Where the workbook bytes come from. Always read-only.
//  - "url":    fetched from the local server (default; Reload = fetch again)
//  - "handle": a file picked with the File System Access API (Chrome); Reload re-reads the same file
// A small poller notices when the file's modified-time changes (the author saved in Excel).

export function resolveUrl(rel, base) {
  return new URL(rel, new URL(base, location.href)).href;
}

export async function loadConfig(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw Object.assign(new Error('config'), { code: 'CONFIG', url });
  return res.json();
}

export function makeSource(initialUrl) {
  let kind = 'url';
  let url = initialUrl;
  let handle = null;
  let lastStamp = null;
  let modified = null;

  async function stamp() {
    if (kind === 'handle') {
      const f = await handle.getFile();
      return `${f.lastModified}:${f.size}`;
    }
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (!res.ok) throw new Error('head');
    return `${res.headers.get('last-modified')}:${res.headers.get('content-length')}`;
  }

  return {
    get name() {
      return kind === 'handle' ? handle.name : decodeURIComponent(url.split('/').pop());
    },
    /** modified time (ms) of the file as of the last read, or null if unknown */
    get modified() {
      return modified;
    },
    get url() {
      return url;
    },
    async read() {
      let buf;
      if (kind === 'handle') {
        const f = await handle.getFile();
        modified = f.lastModified;
        buf = await f.arrayBuffer();
      } else {
        const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw Object.assign(new Error('fetch'), { code: 'FETCH', url });
        const lm = Date.parse(res.headers.get('last-modified') || '');
        modified = Number.isNaN(lm) ? null : lm;
        buf = await res.arrayBuffer();
      }
      try {
        lastStamp = await stamp();
      } catch {
        lastStamp = null;
      }
      return buf;
    },
    async changed() {
      try {
        const s = await stamp();
        return lastStamp != null && s !== lastStamp;
      } catch {
        return false; // file momentarily locked or mid-save: try again next tick
      }
    },
    async choose() {
      if (!window.showOpenFilePicker) throw new Error('File System Access API is not available in this browser');
      const [h] = await window.showOpenFilePicker({ types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'] } }] });
      handle = h;
      kind = 'handle';
    },
  };
}
