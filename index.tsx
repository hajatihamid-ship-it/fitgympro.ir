import { initApp } from './src/main';

// Type declarations for window properties and external libraries
declare global {
    interface Window {
        jspdf: { jsPDF: any };
        lucide: {
            createIcons: () => void;
        };
        html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
        Chart: any;
    }
}

// ES module preload fix
(function() {
    const t = (document.createElement("link") as HTMLLinkElement).relList;
    if (t && t.supports && t.supports("modulepreload")) return;
    for (const a of document.querySelectorAll('link[rel="modulepreload"]')) {
        r(a as HTMLLinkElement);
    }
    new MutationObserver(a => {
        for (const n of a)
            if (n.type === "childList")
                for (const o of n.addedNodes)
                    if (o instanceof HTMLLinkElement && o.rel === "modulepreload") r(o)
    }).observe(document, {
        childList: !0,
        subtree: !0
    });

    function s(a: HTMLLinkElement) {
        const n: RequestInit = {};
        return a.integrity && (n.integrity = a.integrity), a.referrerPolicy && (n.referrerPolicy as ReferrerPolicy), a.crossOrigin === "use-credentials" ? n.credentials = "include" : a.crossOrigin === "anonymous" ? n.credentials = "omit" : n.credentials = "same-origin", n
    }

    function r(a: HTMLLinkElement) {
        if ((a as any).ep) return;
        (a as any).ep = !0;
        const n = s(a);
        fetch(a.href, n)
    }
})();

// Initialize the application
initApp();