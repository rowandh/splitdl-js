splitdl-js
==========

Chunked image downloader using HTML5 and JavaScript. Downloads an image in segments, then stitches it together and displays on screen.

Look in the test folder for a sample, or try http://mechonomics.github.com/splitdl-js/

You will need to set an image URL yourself in splitdl-js.

If it's a cross domain request, the server needs to support the following
headers:
- Access-Control-Allow-Headers:range
- Access-Control-Allow-Methods: GET, POST, OPTIONS
- Access-Control-Allow-Origin: YOUR_URL
