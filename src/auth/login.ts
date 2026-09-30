import { ApiClient } from "../client/api-client.js";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  token?: string;
  [key: string]: unknown;
}

export async function login(
  targetUrl: string,
  credentials: LoginCredentials,
  client: ApiClient
): Promise<string> {
  const loginUrl = `${targetUrl.replace(/\/$/, "")}/auth/login`;

  console.log("");
  console.log(`Logging in as: ${credentials.username}`);

  const response = await client.post<LoginResponse>(
    loginUrl,
    credentials
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Login failed for ${credentials.username}. HTTP status: ${response.status}`
    );
  }

  const data = response.data;

  if (!data || typeof data !== "object") {
    throw new Error(
      `Invalid login response for ${credentials.username}.`
    );
  }

  const token = data.access_token ?? data.token;

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      `No JWT token found in login response for ${credentials.username}.`
    );
  }

  console.log(`Login successful: ${credentials.username}`);

  return token;
}