import http.server
import os
import webbrowser

HOST = "127.0.0.1"  # localhost only; never expose the dev server to the network
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Only the web app is served; Python sources, data, outputs and .git are not reachable.
ALLOWED_TOP = {"index.html", "styles.css", "js", "vendor"}

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; script-src 'self'; worker-src 'self' blob:; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; "
        "form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        top = self.path.split("?", 1)[0].lstrip("/").split("/", 1)[0]
        if top and top not in ALLOWED_TOP:
            self.send_error(404)
            return
        super().do_GET()

    do_HEAD = do_GET

    def end_headers(self):
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        super().end_headers()


def main():
    with http.server.ThreadingHTTPServer((HOST, PORT), Handler) as httpd:
        print(f"ShipLabel Web Studio running at: http://localhost:{PORT}")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
