// src/ui/baseui-ts
import { Scene, Engine } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { UI_IDEAL_WIDTH, UI_IDEAL_HEIGHT } from "../Constants";

export abstract class BaseUI {
    protected scene: Scene;
    protected engine: Engine;
    protected guiTexture: AdvancedDynamicTexture;
    protected name: string;

    /**
     * Initializes a new instance of the BaseUI class.
     * Sets up the scene, engine, and creates a fullscreen UI texture with specified ideal dimensions.
     *
     * @param scene - The Babylon.js scene where the UI will be rendered.
     * @param name - The name for the UI, defaulting to "BaseUI".
     */
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

    /**
     * Abstract method to update the UI state, optionally indicating if an animation is in progress.
     * Implementing classes should override this method to update the UI state based on the game state
     * and the animation status.
     * @param isAnimating When true, the UI should consider that a visual animation is in progress.
     * @returns void
     */
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

    /**
     * Disposes the UI instance.
     * When called, this method disposes the AdvancedDynamicTexture created by the UI,
     * which is used to render the UI elements. This is necessary to free up memory when
     * the UI is no longer needed.
     */
    public dispose(): void {
        console.log(`Disposing ${this.name}`);
        if (this.guiTexture) {
            this.guiTexture.dispose();
        }
    }
}
