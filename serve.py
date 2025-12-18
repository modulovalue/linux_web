#!/usr/bin/env python3
"""
HTTP server with headers required for SharedArrayBuffer (needed by v86).
"""

import http.server
import socketserver

PORT = 8888

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Required for SharedArrayBuffer
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

print(f"Server running at http://localhost:{PORT}")
print("Required headers for SharedArrayBuffer enabled")
print("Press Ctrl+C to stop")

with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
    httpd.allow_reuse_address = True
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
