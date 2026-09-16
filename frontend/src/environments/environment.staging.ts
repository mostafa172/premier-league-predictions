export const environment = {
  production: true,
  // Staging API, defined by the staging service in render.yaml. Update this if
  // Render assigns a different hostname.
  apiUrl: "https://premier-league-predictions-staging.onrender.com/api",
};

console.log("🟡 STAGING Environment loaded:", environment);
