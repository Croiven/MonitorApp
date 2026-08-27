export function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

export function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(body);
}

export function getPathname(url) {
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

export function parseQuery(url) {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return new URLSearchParams();
  }
  return new URLSearchParams(url.slice(queryIndex + 1));
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}
