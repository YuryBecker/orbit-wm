"use client";

import type { MouseEvent } from "react";

import type { ResizeEdge } from "state/window-manager";
import WindowPaneInstance from "state/window-manager/instance";


type WindowBorderProps = {
    instance: WindowPaneInstance;
    onStartResize: (
        instanceId: string,
        edge: ResizeEdge,
        event: MouseEvent<HTMLDivElement>,
    ) => void;
};

const HANDLE_SIZE_PX = 8;

const WindowBorder = ({
    instance,
    onStartResize,
}: WindowBorderProps) => {
    return (
        <div className="absolute inset-0 pointer-events-none">
            <div
                className="absolute left-0 top-0 bottom-0 pointer-events-auto"
                style={{ width: HANDLE_SIZE_PX, cursor: "ew-resize" }}
                onMouseDown={(event) => onStartResize(instance.id, "left", event)}
            />
            <div
                className="absolute right-0 top-0 bottom-0 pointer-events-auto"
                style={{ width: HANDLE_SIZE_PX, cursor: "ew-resize" }}
                onMouseDown={(event) => onStartResize(instance.id, "right", event)}
            />
            <div
                className="absolute left-0 right-0 top-0 pointer-events-auto"
                style={{ height: HANDLE_SIZE_PX, cursor: "ns-resize" }}
                onMouseDown={(event) => onStartResize(instance.id, "top", event)}
            />
            <div
                className="absolute left-0 right-0 bottom-0 pointer-events-auto"
                style={{ height: HANDLE_SIZE_PX, cursor: "ns-resize" }}
                onMouseDown={(event) => onStartResize(instance.id, "bottom", event)}
            />
        </div>
    );
};

export default WindowBorder;
