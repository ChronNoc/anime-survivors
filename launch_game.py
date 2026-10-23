"""Start DBZ Survivor's local web server and open it in the default browser."""

from __future__ import annotations

import os
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"


class LocalGameHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        # Keep useful request logs while giving the window a recognizable prefix.
        print("[DBZ] " + (format % args))


class LocalGameServer(ThreadingHTTPServer):
    # Windows can otherwise allow two Python servers to bind the same port.
    allow_reuse_address = False


def make_server() -> tuple[ThreadingHTTPServer, int]:
    os.chdir(ROOT)
    last_error: OSError | None = None
    for port in range(8000, 8011):
        try:
            return LocalGameServer((HOST, port), LocalGameHandler), port
        except OSError as error:
            last_error = error
    assert last_error is not None
    raise last_error


def main() -> None:
    server, port = make_server()
    url = f"http://{HOST}:{port}/"
    print(f"DBZ Survivor is running at {url}")
    print("Keep this window open while playing.")
    print("Press Ctrl+C or close this window to stop the game server.")

    if os.environ.get("DBZ_NO_BROWSER") != "1":
        threading.Timer(0.35, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping DBZ Survivor...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
