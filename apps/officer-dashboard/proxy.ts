import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isOfficerCaseRoute = createRouteMatcher(["/cases(.*)"]);
export const officerSignInUrl = (request: Request): string => new URL("/", request.url).toString();

export default clerkMiddleware(async (auth, request) => {
  if (isOfficerCaseRoute(request)) {
    await auth.protect({ unauthenticatedUrl: officerSignInUrl(request) });
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
