import "./env";

const secret = process.env.JWT_SECRET?.trim();

if (!secret) {
  throw new Error(
    "JWT_SECRET is required. Set it in the backend environment before starting the server."
  );
}

export const JWT_SECRET = secret;
