// src/ui/baseui-ts (Added optional name and dispose)
import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";

export abstract class BaseUI {
    protected scene: Scene;
    protected guiTexture: AdvancedDynamicTexture;
    protected name: string; // Optional name for debugging

    constructor(scene: Scene, name: string = "BaseUI") {
        this.scene = scene;
        this.name = name;
        // Create a unique name for the texture based on the UI class name
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI(`${name}_UITexture`, true, this.scene);
        console.log(`Initialized ${this.name}`);
    }

    // Make update potentially accept animation state
    public abstract update(isAnimating?: boolean): void;

    /**
     * Disposes the GUI texture associated with this UI component.
     */
    public dispose(): void {
        console.log(`Disposing ${this.name}`);
        if (this.guiTexture) {
            this.guiTexture.dispose();
            // Optional: Nullify reference if needed, though garbage collection should handle it.
            // this.guiTexture = null;
        }
    }
}
