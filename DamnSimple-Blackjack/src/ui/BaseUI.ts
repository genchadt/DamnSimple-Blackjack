// ui/BaseUI.ts
import { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";

export abstract class BaseUI {
    protected scene: Scene;
    protected guiTexture: AdvancedDynamicTexture;
    
    constructor(scene: Scene) {
        this.scene = scene;
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    }
    
    public abstract update(): void;
}
