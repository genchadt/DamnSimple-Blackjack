// ui/BaseUI.ts
import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";

export abstract class BaseUI {
    protected scene: Scene;
    protected guiTexture: AdvancedDynamicTexture;
    
    /**
     * Initializes a new instance of the BaseUI class.
     * 
     * @param {Scene} scene - The Babylon.js scene to which the UI belongs.
     * 
     * This constructor sets up the AdvancedDynamicTexture that will be used
     * to render all UI elements. The texture is created as a fullscreen UI
     * layer, and is set to render on top of all other 3D objects.
     */
    constructor(scene: Scene) {
        this.scene = scene;
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    }
    
    public abstract update(): void;
}
