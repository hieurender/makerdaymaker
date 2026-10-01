import { createRemoteJWKSet, jwtVerify } from 'jose';

const OKTA_DOMAIN = process.env.OKTA_DOMAIN || 'render.okta.com';
const ISSUER = `https://${OKTA_DOMAIN}`;
const TOKEN_HEADER = 'x-forwarded-access-token';
const HEALTH_CHECK_PATH = '/api/config';

const SIGN_IN_PATH = '/oauth2/start';
const REAUTH_PARAM = '_reauth';
const CLOCK_TOLERANCE_SECONDS = 30;

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/oauth2/v1/keys`));

// Render sets RENDER on its services. Locally there is no auth proxy, so the check is skipped.
const enforced = () => Boolean(process.env.RENDER);

const wantsPage = (req) => req.method === 'GET' && Boolean(req.accepts('html')) && !req.path.startsWith('/api/');

// The auth proxy keeps its session cookie longer than the access token it forwards. When the token
// has expired, send page loads back through the proxy's login flow (Okta single sign-on is usually
// instant) instead of showing an error. The marker prevents a redirect loop if the new token is
// also rejected.
export function rejectExpired(req, res) {
  if (wantsPage(req) && !(REAUTH_PARAM in req.query)) {
    const back = new URL(req.originalUrl, 'http://placeholder');
    back.searchParams.set(REAUTH_PARAM, '1');
    return res.redirect(`${SIGN_IN_PATH}?rd=${encodeURIComponent(back.pathname + back.search)}`);
  }
  return res.status(401).json({ error: 'login expired', code: 'token_expired' });
}

export async function requireOkta(req, res, next) {
  if (!enforced() || req.path === HEALTH_CHECK_PATH) return next();
  const token = req.get(TOKEN_HEADER);
  if (!token) return res.status(401).json({ error: `missing ${TOKEN_HEADER} header` });
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      algorithms: ['RS256'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    if (!payload.sub) return res.status(401).json({ error: 'token has no sub claim' });
    req.user = { email: payload.sub };
    return next();
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') return rejectExpired(req, res);
    return res.status(401).json({ error: `invalid token: ${error.code ?? error.message}` });
  }
}
