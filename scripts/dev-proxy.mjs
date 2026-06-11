import http from 'http';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({});

// Handle errors
proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });
  res.end('Something went wrong with dev-proxy: ' + err.message);
});

const server = http.createServer(function(req, res) {
  if (req.url.startsWith('/admin')) {
    // Proxy to Admin app on port 5174
    proxy.web(req, res, { target: 'http://localhost:5174' });
  } else {
    // Proxy to Customer app on port 5173
    // Note: customer app uses basicSsl (https)
    proxy.web(req, res, { 
      target: 'https://localhost:5173',
      secure: false // ignore self-signed certificate errors
    });
  }
});

console.log("Dev proxy listening on port 3000");
server.listen(3000);
