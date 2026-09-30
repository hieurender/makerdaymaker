import { createRemoteJWKSet, jwtVerify } from 'jose';

const OKTA_DOMAIN = process.env.OKTA_DOMAIN || 'render.okta.com';
const ISSUER = `https://${OKTA_DOMAIN}`;
const TOKEN_HEADER = 'x-forwarded-access-token';
const HEALTH_CHECK_PATH = '/api/config';

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/oauth2/v1/keys`));

// Render sets RENDER on its services. Locally there is no auth proxy, so the check is skipped.
const enforced = () => Boolean(process.env.RENDER);

export async function requireOkta(req, res, next) {
  if (!enforced() || req.path === HEALTH_CHECK_PATH) return next();
  const token = req.get(TOKEN_HEADER);
  if (!token) return res.status(401).json({ error: `missing ${TOKEN_HEADER} header` });
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, algorithms: ['RS256'] });
    if (!payload.sub) return res.status(401).json({ error: 'token has no sub claim' });
    req.user = { email: payload.sub };
    return next();
  } catch (error) {
    return res.status(401).json({ error: `invalid token: ${error.code ?? error.message}` });
  }
}
