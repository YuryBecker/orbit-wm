"use client";

import { useCallback, useEffect, useId } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";

import config from "state/config";
import mirrorTerminal from "state/mirror-terminal";


const MirrorTerminal = observer(() => {
    const id = useId();

    useEffect(() => {
        if (mirrorTerminal.isActive) {
            console.log('\nActivated mirror...');

            setTimeout(() => {
                console.log('Focusing...');

                mirrorTerminal.focus();

                const element = document.getElementById(id);
                console.log('Element:', element);
            }, 300);
        }

    }, [mirrorTerminal.isActive]);

    const handleRef = useCallback(
        (node: HTMLDivElement | null) => {
            mirrorTerminal.setContainer(node);
        },
        [],
    );


    if (!mirrorTerminal.isActive || !mirrorTerminal.mirrorFrom) {
        return null;
    }

    const overlay = (
        <div
            className="fixed left-0 right-0 overflow-hidden"
            style={{
                top: `${mirrorTerminal.top}px`,
                height: `${mirrorTerminal.height}px`,
                zIndex: 2000,
                background: config.terminalColor,
                backdropFilter: `blur(${config.terminalBlur}px)`,
                WebkitBackdropFilter: `blur(${config.terminalBlur}px)`,
            }}
        >
            <div
                id={ id }
                ref={handleRef}
                className="h-full w-full overflow-hidden"
                onPointerDown={() => {
                    mirrorTerminal.focus();
                }}
            />
        </div>
    );

    return typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : null;
});

export default MirrorTerminal;
