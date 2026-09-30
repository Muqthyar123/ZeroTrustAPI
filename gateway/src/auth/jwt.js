const { jwtVerify } = require("jose");

/**
 * Verifies a JWT token using HS256 algorithm and process.env.JWT_SECRET.
 *
 * @param {string} token - The JWT string to verify.
 * @returns {Promise<Object>} The decoded JWT payload when valid.
 * @throws {Error} If token is missing, invalid, expired, malformed, or if JWT_SECRET is not configured.
 */
async function verifyToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid or missing JWT token");
  }

  const secretString = process.env.JWT_SECRET;
  if (!secretString) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }

  const secret = new TextEncoder().encode(secretString);

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"]
    });
    return payload;
  } catch (error) {
    if (error.code === "ERR_JWT_EXPIRED") {
      throw new Error("JWT token has expired");
    }
    if (error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
      throw new Error("JWT signature verification failed");
    }
    if (error.code === "ERR_JOSE_ALG_NOT_ALLOWED") {
      throw new Error("JWT algorithm not allowed. Only HS256 is accepted");
    }
    if (error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_MALFORMED") {
      throw new Error("Malformed JWT token");
    }
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}

module.exports = {
  verifyToken
};