export const APP_BUILD_INFO = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-dev",
  date: process.env.NEXT_PUBLIC_BUILD_DATE ?? "local build",
};
