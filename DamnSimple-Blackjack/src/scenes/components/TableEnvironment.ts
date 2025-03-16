// scenes/components/TableEnvironment.ts
import { Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, 
    UniversalCamera, Mesh, PointLight } from "@babylonjs/core";

export class TableEnvironment {
    private scene: Scene;
    private table: Mesh;
    private deckMesh: Mesh;
    private deckPosition: Vector3 = new Vector3(3.5, 0.3, 0);

    /**
     * Creates a new TableEnvironment.
     * 
     * @param scene The Babylon.js scene to add the table environment to.
     */
    constructor(scene: Scene) {
        this.scene = scene;
        
        // Set background color
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05, 1);
        
        // Setup camera and lighting
        this.setupCamera();
        this.setupLighting();
        
        // Create table and deck
        this.table = this.createTable();
        this.deckMesh = this.createDeckVisual();
    }

    /**
     * Sets up the camera for the scene.
     * Creates a top-down UniversalCamera with a narrow FOV to give a more orthographic-like appearance.
     */
    private setupCamera(): void {
        // Create top-down camera
        const camera = new UniversalCamera("camera", new Vector3(0, 15, 0), this.scene);
        camera.setTarget(new Vector3(0, 0, 0));
        camera.fov = 0.4; // Narrow FOV for more orthographic-like appearance
    }

    /**
     * Sets up the lighting for the scene.
     * The scene is given a single ambient light with a soft ground reflection, and a subtle fill light
     * to reduce the appearance of harsh shadows.
     */
    private setupLighting(): void {
        // Add main ambient light for uniform illumination
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.7;
        ambientLight.diffuse = new Color3(1, 1, 1);
        ambientLight.specular = new Color3(0.1, 0.1, 0.1);
        ambientLight.groundColor = new Color3(0.5, 0.5, 0.5); // Softer ground reflection
        
        // Add subtle fill light
        const fillLight = new PointLight("fillLight", new Vector3(0, 8, 0), this.scene);
        fillLight.intensity = 0.3;
        fillLight.diffuse = new Color3(0.9, 0.9, 1.0);
        fillLight.specular = new Color3(0.1, 0.1, 0.1);
        
        // Increase the range for more uniform lighting
        fillLight.range = 20;
    }

    /**
     * Creates a table mesh for the scene with a green color material and positions it below the y-axis.
     * Also creates transparent indicators for dealer and player areas using disc meshes.
     * The dealer area is positioned in front of the table, while the player area is positioned behind.
     * 
     * @returns {Mesh} The mesh representing the table.
     */
    private createTable(): Mesh {
        // Simple green table
        const table = MeshBuilder.CreateBox("table", { width: 10, height: 0.5, depth: 8 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.1, 0.3, 0.1);
        table.material = tableMaterial;
        table.position.y = -0.25; // Move down so cards are at y=0
        
        // Create dealer area indicator
        const dealerArea = MeshBuilder.CreateDisc("dealerArea", { radius: 2.5 }, this.scene);
        const dealerAreaMat = new StandardMaterial("dealerAreaMat", this.scene);
        dealerAreaMat.diffuseColor = new Color3(0.05, 0.25, 0.05);
        dealerAreaMat.alpha = 0.5;
        dealerArea.material = dealerAreaMat;
        dealerArea.position = new Vector3(0, -0.22, -2.5);
        dealerArea.rotation.x = Math.PI/2;
        
        // Create player area indicator
        const playerArea = MeshBuilder.CreateDisc("playerArea", { radius: 2.5 }, this.scene);
        const playerAreaMat = new StandardMaterial("playerAreaMat", this.scene);
        playerAreaMat.diffuseColor = new Color3(0.05, 0.25, 0.05);
        playerAreaMat.alpha = 0.5;
        playerArea.material = playerAreaMat;
        playerArea.position = new Vector3(0, -0.22, 2.5);
        playerArea.rotation.x = Math.PI/2;
        
        return table;
    }

    /**
     * Creates a visual representation of the card deck as a box mesh.
     * The deck is positioned slightly lower than the playing cards and uses a dark red material
     * to match the color of the card backs.
     * 
     * @returns {Mesh} The mesh representing the deck.
     */
    private createDeckVisual(): Mesh {
        // Create a visual representation of the deck
        const deckMesh = MeshBuilder.CreateBox("deck", { width: 1, height: 0.2, depth: 1.4 }, this.scene);
        deckMesh.position = this.deckPosition.clone();
        deckMesh.position.y = 0.1; // Lower than cards
        
        const deckMaterial = new StandardMaterial("deckMaterial", this.scene);
        // Match the card back color
        deckMaterial.diffuseColor = new Color3(0.53, 0, 0); // #880000
        deckMesh.material = deckMaterial;
        
        return deckMesh;
    }

    /**
     * Retrieves the Babylon.js scene instance associated with this table environment.
     * 
     * @returns {Scene} The scene used in this TableEnvironment.
     */
    public getScene(): Scene {
        return this.scene;
    }

    /**
     * Retrieves the position of the deck as a Vector3 instance.
     * The position of the deck is the same as the table's center.
     * 
     * @returns {Vector3} The position of the deck.
     */
    public getDeckPosition(): Vector3 {
        return this.deckPosition;
    }
}
