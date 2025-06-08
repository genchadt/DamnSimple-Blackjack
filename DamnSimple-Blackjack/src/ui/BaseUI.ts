// src/ui/baseui-ts
import { Scene, Engine } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { UI_IDEAL_WIDTH, UI_IDEAL_HEIGHT } from "../Constants";

export abstract class BaseUI {
    protected scene: Scene;
    protected engine: Engine;
    protected guiTexture: AdvancedDynamicTexture;
    protected name: string;

    protected constructor(scene: Scene, name:string = "BaseUI") {
        this.scene = scene;
        this.engine = scene.getEngine() as Engine;
        this.name = name;

        // Create UI texture
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
            `${name}_UITexture`,
            true, // foreground: true for main UI
            this.scene
        );
        // Set initial ideal dimensions. These will be adjusted by applyUIScale.
        this.guiTexture.idealWidth = UI_IDEAL_WIDTH;
        this.guiTexture.idealHeight = UI_IDEAL_HEIGHT;
        // When false, ideal dimensions are used to scale controls, which is what we want.
        this.guiTexture.renderAtIdealSize = false;
        console.log(`Initialized ${this.name}. UI texture initial ideal size: ${this.guiTexture.idealWidth}x${this.guiTexture.idealHeight}. renderAtIdealSize: false`);
    }

    public abstract update(isAnimating?: boolean): void;

    /**
     * Applies a UI scale factor by adjusting the ideal dimensions of the GUI texture.
     * A larger scale factor makes the UI elements appear larger on screen.
     * @param scaleFactor The desired scale factor (e.g., 1.2 for 120% size).
     */
    public applyUIScale(scaleFactor: number): void {
        if (this.guiTexture) {
            // To make UI elements appear larger (e.g., scaleFactor = 1.2),
            // we make the virtual (ideal) space smaller. This makes controls
            // take up a larger percentage of the virtual space, thus appearing larger.
            this.guiTexture.idealWidth = UI_IDEAL_WIDTH / scaleFactor;
            this.guiTexture.idealHeight = UI_IDEAL_HEIGHT / scaleFactor;
            console.log(`[${this.name}] UI Scale set to ${scaleFactor}. New ideal dimensions: ${this.guiTexture.idealWidth.toFixed(0)}x${this.guiTexture.idealHeight.toFixed(0)}`);
        }
    }

    public dispose(): void {
        console.log(`Disposing ${this.name}`);
        if (this.guiTexture) {
            this.guiTexture.dispose();
        }
    }
}
