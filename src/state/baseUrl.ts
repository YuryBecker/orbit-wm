const getMiddlePort = () => process.env.NEXT_PUBLIC_MIDDLE_PORT || "4001";

const getMiddleBaseUrl = () => {
    const explicit = process.env.NEXT_PUBLIC_MIDDLE_URL;
    if (explicit) {
        return explicit;
    }

    if (typeof window !== "undefined") {
        const { protocol, hostname, port } = window.location;
        const targetPort = getMiddlePort();
        if (port && port === targetPort) {
            return `${protocol}//${hostname}:${port}`;
        }
        if (!port && (protocol === "http:" || protocol === "https:")) {
            return `${protocol}//${hostname}:${targetPort}`;
        }
        return `${protocol}//${hostname}:${targetPort}`;
    }

    return `http://localhost:${getMiddlePort()}`;
};

export { getMiddleBaseUrl };
