import importlib.util
import threading
import unittest
from functools import partial
from http.client import HTTPConnection
from pathlib import Path
from tempfile import TemporaryDirectory

spec = importlib.util.spec_from_file_location('serve', Path(__file__).resolve().parents[1] / 'scripts/serve.py')
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


class RangeTests(unittest.TestCase):
    def test_video_ranges(self):
        with TemporaryDirectory() as folder:
            Path(folder, 'clip.mp4').write_bytes(bytes(range(100)))
            server = serve.DemoServer(('127.0.0.1', 0), partial(serve.DemoHandler, directory=folder))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                for header, status, expected in [
                    (None, 200, bytes(range(100))), ('bytes=10-19', 206, bytes(range(10, 20))),
                    ('bytes=95-', 206, bytes(range(95, 100))), ('bytes=-5', 206, bytes(range(95, 100))),
                    ('bytes=90-999', 206, bytes(range(90, 100))), ('bytes=100-', 416, b''),
                    ('bytes=10-3', 416, b''), ('bytes=0-1,3-4', 416, b''), ('bytes=-0', 416, b'')
                ]:
                    with self.subTest(header=header):
                        connection = HTTPConnection(*server.server_address)
                        connection.request('GET', '/clip.mp4', headers={'Range': header} if header else {})
                        response = connection.getresponse()
                        self.assertEqual(response.status, status)
                        self.assertEqual(response.read(), expected)
                        self.assertEqual(int(response.getheader('Content-Length')), len(expected))
                        if status == 206:
                            self.assertEqual(response.getheader('Accept-Ranges'), 'bytes')
                        connection.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == '__main__':
    unittest.main()
