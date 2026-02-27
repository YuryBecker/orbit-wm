"use client";

import { useEffect } from "react";



const PwaRegister = () => {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) {
            return;
        }

        navigator.serviceWorker.register("/sw.js").catch(() => {});
    }, []);

    return null;
};

export default PwaRegister;
