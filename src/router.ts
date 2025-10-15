import { idbGet } from './services/storage';

type RouteHandler = () => Promise<void>;
interface RouteMap {
    [path: string]: RouteHandler;
}
let routes: RouteMap = {};

const router = async () => {
    const path = window.location.hash.slice(1) || '/';
    const isLoggedIn = !!await idbGet<string>("fitgympro_last_user");

    // Handle routing guards
    if (path.startsWith('/dashboard') && !isLoggedIn) {
        // Not logged in, trying to access protected route -> redirect to home
        window.location.replace('#/');
        return; // Stop further execution
    }
    if (path === '/' && isLoggedIn) {
        // Logged in, trying to access a public route (like '/') -> redirect to dashboard
        window.location.replace('#/dashboard');
        return; // Stop further execution
    }

    const handler = routes[path] || routes['/'];
    if (handler) {
        try {
            await handler();
        } catch (error) {
            console.error(`Error handling route ${path}:`, error);
            // Optionally render an error page, for now redirect home
            window.location.replace('#/');
        }
    } else {
        console.warn(`No route found for ${path}, redirecting home.`);
        window.location.replace('#/');
    }
};

export const navigateTo = (path: string) => {
    // Only change hash if it's different to avoid re-triggering unnecessarily
    if (window.location.hash.slice(1) !== path) {
        window.location.hash = path;
    } else {
        // If navigating to the same page, force a re-render.
        // This is useful after actions like logout that stay on '/' but should change the view.
        router();
    }
};

export const initRouter = (routeFunctions: RouteMap) => {
    routes = routeFunctions;
    window.addEventListener('hashchange', router);
    // Call the router immediately to handle the initial page load,
    // as the module script is deferred and the DOM is ready.
    router();
};