// ./scenes/MainMenuScene.ts
import { Scene, Engine, Vector3, HemisphericLight, Color3, Color4,  ArcRotateCamera } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, TextBlock } from "@babylonjs/gui";
import { UI_IDEAL_HEIGHT, UI_IDEAL_WIDTH } from "../Constants";

export class MainMenuScene {
    private scene: Scene;
    private guiTexture!: AdvancedDynamicTexture;

    /**
     * Constructor for the main menu scene.
     * Creates the scene and a camera that is attached to the canvas,
     * and sets up the GUI with a title and a button to start the game.
     *
     * @param engine The Babylon engine.
     * @param canvas The HTML element to render to.
     * @param onStartGame The callback to call when the user clicks the start game button.
     */
    constructor(engine: Engine, canvas: HTMLCanvasElement, onStartGame: () => void) {
        this.scene = new Scene(engine);

        // Set background color
        this.scene.clearColor = new Color4(0.1, 0.1, 0.1);

        // Create camera
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, Vector3.Zero(), this.scene);
        camera.attachControl(canvas, true);

        // Create light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        // Create GUI
        this.createGUI(onStartGame);
    }

    /**
     * Creates the GUI elements for the main menu scene.
     * This includes the title of the game, and a button to start the game.
     *
     * @param onStartGame The callback to call when the user clicks the start game button.
     */
    private createGUI(onStartGame: () => void): void {
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
        // Add ideal size for consistent control scaling, matching the other scenes
        this.guiTexture.idealWidth = UI_IDEAL_WIDTH;
        this.guiTexture.idealHeight = UI_IDEAL_HEIGHT;
        // Set renderAtIdealSize to false so ideal dimensions are used for scaling
        this.guiTexture.renderAtIdealSize = false;


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

    /**
     * Retrieves the current Babylon.js scene instance for the main menu.
     *
     * @returns {Scene} The scene associated with the main menu.
     */
    public getScene(): Scene {
        return this.scene;
    }
}
