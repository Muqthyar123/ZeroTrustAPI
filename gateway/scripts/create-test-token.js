const { SignJWT } = require("jose");

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET
);

async function createToken() {
  const token = await new SignJWT({
    tenant_id: "tenantA",
    org_id: "org1",
    scope: ["orders:read"]
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("userA1")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  console.log(token);
}

createToken().catch(console.error);