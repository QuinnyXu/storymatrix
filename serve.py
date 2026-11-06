"""Tiny local web server for the story dashboard (read-only static files, localhost only).
Serves the folder that contains this dashboard folder, so books kept next to it (../my-novel/book.xlsx) can be read.
Works whatever the dashboard folder is called (story-dashboard, storymatrix, storymatrix-main…)."""
import http.server
import os
import socketserver
import sys
import urllib.parse
import urllib.request
import webbrowser

PORT = 8765
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = urllib.parse.quote(os.path.basename(HERE))


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windows registries sometimes map .js to text/plain, which breaks ES modules
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
                      ".css": "text/css", ".html": "text/html; charset=utf-8", ".md": "text/markdown; charset=utf-8"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_PUT(self):    self.send_error(405, "read-only")
    def do_POST(self):   self.send_error(405, "read-only")
    def do_DELETE(self): self.send_error(405, "read-only")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    # On Windows SO_REUSEADDR lets two servers share one port (the other one then answers), so keep it off there
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


def is_dashboard(port):
    """True if something on this port already serves this dashboard (e.g. an earlier start.bat window)."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/{APP}/index.html", timeout=2) as r:
            return r.status == 200 and b"src/std/app.js" in r.read()
    except Exception:
        return False


if __name__ == "__main__":
    # 8765 first; if another program uses it, take the next free port instead of opening the wrong site
    for port in range(PORT, PORT + 20):
        url = f"http://127.0.0.1:{port}/{APP}/index.html"
        try:
            srv = Server(("127.0.0.1", port), Handler)
            break
        except OSError:
            if is_dashboard(port):
                print(f"The dashboard is already running: {url}")
                webbrowser.open(url)
                sys.exit(0)
            print(f"Port {port} is used by another program, trying {port + 1}...")
    else:
        print(f"No free port between {PORT} and {PORT + 19}.")
        input("Press Enter to close.")
        sys.exit(1)
    print(f"Story dashboard running at {url}\nClose this window to stop it.")
    webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
