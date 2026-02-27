import WindowPaneInstance from "./instance";


type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

class WindowNode {
    /** Parent node reference. */
    public parent: WindowNode | null = null;

    /** Child nodes when this is an internal node. */
    public children: [WindowNode | null, WindowNode | null] = [null, null];

    /** Whether this node is an internal split node. */
    public isNode = false;

    /** Whether the split is vertical (top/bottom). */
    public splitTop = false;

    /** Split ratio based on Hyprland's dwindle math. */
    public splitRatio = 1;

    /** Layout box for this node. */
    public box: Rect = { x: 0, y: 0, width: 0, height: 0 };

    /** Window instance if this is a leaf node. */
    public window: WindowPaneInstance | null = null;

    constructor(window?: WindowPaneInstance) {
        this.window = window ?? null;
        this.isNode = !window;
    }
}

export type { Rect };
export default WindowNode;
