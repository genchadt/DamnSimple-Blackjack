import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, ArcRotateCamera, Color3, StandardMaterial } from "@babylonjs/core";

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    constructor() {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        
        // Initialize the Babylon engine
        this.engine = new Engine(this.canvas, true);
        
        // Create the scene
        this.scene = this.createScene();
        
        // Run the render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        
        // Handle browser resize
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    createScene(): Scene {
        // Create a new scene
        const scene = new Scene(this.engine);
        
        // Set background color to a dark green (casino table feel)
        scene.clearColor = new Color3(0.05, 0.2, 0.05);
        
        // Create a camera
        const camera = new ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 3, 10, new Vector3(0, 0, 0), scene);
        camera.attachControl(this.canvas, true);
        camera.upperBetaLimit = Math.PI / 2.2; // Limit camera angle
        
        // Create a light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
        
        // Create a table
        const table = MeshBuilder.CreateBox("table", { width: 8, height: 0.2, depth: 4 }, scene);
        const tableMaterial = new StandardMaterial("tableMaterial", scene);
        tableMaterial.diffuseColor = new Color3(0.1, 0.3, 0.1); // Dark green
        table.material = tableMaterial;
        
        return scene;
    }
}

// Start the game when the page loads
window.addEventListener("DOMContentLoaded", () => {
    new Game();
});
