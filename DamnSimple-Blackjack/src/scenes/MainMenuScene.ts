// ./scenes/MainMenuScene.ts
import { Scene, Engine, Vector3, HemisphericLight, Color3, ArcRotateCamera } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock } from "@babylonjs/gui";

export class MainMenuScene {
    private scene: Scene;
    private guiTexture: AdvancedDynamicTexture;

    constructor(engine: Engine, canvas: HTMLCanvasElement, onStartGame: () => void) {
        this.scene = new Scene(engine);
        
        // Set background color
        this.scene.clearColor = new Color3(0.1, 0.1, 0.1);
        
        // Create camera
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, Vector3.Zero(), this.scene);
        camera.attachControl(canvas, true);
        
        // Create light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        
        // Create GUI
        this.createGUI(onStartGame);
    }

    private createGUI(onStartGame: () => void): void {
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
        
        // Title
        const titleText = new TextBlock();
        titleText.text = "Damn Simple Blackjack";
        titleText.color = "white";
        titleText.fontSize = 48;
        titleText.top = "-200px";
        titleText.fontStyle = "bold";
        this.guiTexture.addControl(titleText);
        
        // Start Game Button
        const startButton = Button.CreateSimpleButton("startButton", "Start Game");
        startButton.width = "200px";
        startButton.height = "60px";
        startButton.color = "white";
        startButton.cornerRadius = 10;
        startButton.background = "green";
        startButton.onPointerClickObservable.add(() => {
            onStartGame();
        });
        this.guiTexture.addControl(startButton);
    }

    public getScene(): Scene {
        return this.scene;
    }
}
